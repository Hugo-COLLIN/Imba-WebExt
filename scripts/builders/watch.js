const fs = require('fs');
const path = require('path');
const { buildSingleFile } = require('./build-all');
const { generateManifest } = require('../manifest/generator');
const { ImbaWatcher } = require('./imba-watch');
const { combineAssets } = require('../utils/assets');

/**
 * Démarre le mode watch hybride optimisé avec gestion des assets
 */
async function startWatchMode(files, config) {
  console.log(`👀 Starting optimized watch mode for ${config.targetBrowser}...\n`);
  
  const imbaWatcher = new ImbaWatcher();
  
  // Séparer les fichiers Imba des autres (SANS DOUBLONS)
  const imbaFiles = [...new Set(files.filter(file => 
    file.endsWith('.imba') || 
    (file.endsWith('.html') && fs.existsSync(file.replace('.html', '.imba')))
  ))];
  
  const otherFiles = [...new Set(files.filter(file => !imbaFiles.includes(file)))];
  
  // S'assurer que le dossier dist existe
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  // Démarrer tous les watchers Imba en parallèle (SANS DOUBLONS)
  const watcherPromises = imbaFiles
    .filter(file => fs.existsSync(file))
    .map(file => {
      console.log(`🎯 Starting Imba native watcher for ${file}...`);
      return imbaWatcher.startWatching(file, config);
    });
  
  // Compiler les autres fichiers en parallèle avec les watchers Imba
  const otherFilesPromise = Promise.all(
    otherFiles
      .filter(file => fs.existsSync(file))
      .map(async (file) => {
        console.log(`📦 Building ${file}...`);
        await buildSingleFile(file, config);
        return file;
      })
  );
  
  // Attendre que tous les builds initiaux soient terminés
  try {
    const [imbaResults, otherResults] = await Promise.all([
      Promise.all(watcherPromises),
      otherFilesPromise
    ]);
    
    console.log(`\n🎉 Initial compilation completed!`);
    console.log(`   - Imba files: ${imbaResults.length} watchers started`);
    console.log(`   - Other files: ${otherResults.length} files built`);
    
  } catch (error) {
    console.error('❌ Error during initial compilation:', error.message);
  }
  
  // Copier les assets initiaux UNE SEULE FOIS
  console.log('');
  combineAssets();
  
  // Générer le manifest initial
  generateManifest(config.targetBrowser);
  console.log('\n👁️  Watching for changes... (Press Ctrl+C to stop)\n');
  
  // Fonction pour rebuild les autres fichiers
  async function rebuildFile(file, reason = 'File changed') {
    console.log(`\n🔄 ${reason}: ${file}`);
    try {
      await buildSingleFile(file, config);
      generateManifest(config.targetBrowser);
      console.log('✅ Rebuild completed\n');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
    }
  }
  
  // Fonction pour recopier les assets
  function rebuildAssets() {
    console.log(`\n🔄 Assets changed`);
    try {
      combineAssets();
      console.log('✅ Assets updated\n');
    } catch (error) {
      console.error('❌ Assets copy failed:', error.message);
    }
  }
  
  // Surveiller les autres fichiers avec polling
  otherFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file} with polling...`);
      fs.watchFile(file, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          await rebuildFile(file);
        }
      });
    }
  });
  
  // Surveiller le dossier assets avec polling récursif
  const assetsDir = 'src/assets';
  if (fs.existsSync(assetsDir)) {
    console.log(`🔍 Watching ${assetsDir} with polling...`);
    watchAssetsRecursively(assetsDir, rebuildAssets);
  }
  
  // Surveiller le manifest avec polling
  const manifestFile = 'src/manifest.json';
  if (fs.existsSync(manifestFile)) {
    console.log(`🔍 Watching ${manifestFile} with polling...`);
    fs.watchFile(manifestFile, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log(`\n🔄 Manifest changed: ${manifestFile}`);
        generateManifest(config.targetBrowser);
        console.log('✅ Manifest updated\n');
      }
    });
  }

  // Surveiller le fichier LICENSE avec polling
  const licenseFile = 'LICENSE';
  if (fs.existsSync(licenseFile)) {
    console.log(`🔍 Watching ${licenseFile} with polling...`);
    fs.watchFile(licenseFile, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log(`\n🔄 LICENSE file changed: ${licenseFile}`);
        const { copyRootFile } = require('../utils/assets');
        copyRootFile('LICENSE');
        console.log('✅ LICENSE updated\n');
      }
    });
  }
  
  // Gestion propre de l'arrêt
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    imbaWatcher.stopAll();
    process.exit(0);
  });
  
  // Maintenir le processus actif
  process.stdin.resume();
}

/**
 * Surveille récursivement un dossier et ses sous-dossiers
 */
function watchAssetsRecursively(dir, callback) {
  if (!fs.existsSync(dir)) return;
  
  const watchedPaths = new Set(); // Éviter les doublons
  
  // Surveiller récursivement tous les fichiers et sous-dossiers
  function watchDirectory(directory) {
    if (watchedPaths.has(directory)) return;
    watchedPaths.add(directory);
    
    try {
      const items = fs.readdirSync(directory);
      
      items.forEach(item => {
        const itemPath = path.join(directory, item);
        
        if (watchedPaths.has(itemPath)) return;
        watchedPaths.add(itemPath);
        
        try {
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            // Surveiller le sous-dossier
            fs.watchFile(itemPath, { interval: 1000 }, callback);
            watchDirectory(itemPath); // Récursion
          } else {
            // Surveiller le fichier
            fs.watchFile(itemPath, { interval: 1000 }, callback);
          }
        } catch (error) {
          // Ignorer les erreurs de fichiers temporaires
        }
      });
    } catch (error) {
      console.warn(`⚠️ Cannot watch directory ${directory}:`, error.message);
    }
  }
  
  watchDirectory(dir);
}

module.exports = { startWatchMode };