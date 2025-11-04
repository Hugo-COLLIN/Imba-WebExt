const fs = require('fs');
const { buildFile } = require('./build-all');
const { generateManifest } = require('../manifest/generator');
const { ImbaWatcher } = require('./imba-watch');

/**
 * Démarre le mode watch hybride sans build initial
 */
async function startWatchMode(files, config) {
  console.log(`👀 Starting hybrid watch mode for ${config.targetBrowser}...\n`);
  
  const imbaWatcher = new ImbaWatcher();
  
  // Séparer les fichiers Imba des autres
  const imbaFiles = files.filter(file => 
    file.endsWith('.imba') || 
    (file.endsWith('.html') && fs.existsSync(file.replace('.html', '.imba')))
  );
  const otherFiles = files.filter(file => !imbaFiles.includes(file));
  
  // S'assurer que le dossier dist existe
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  // Démarrer tous les watchers Imba en parallèle
  const watcherPromises = imbaFiles
    .filter(file => fs.existsSync(file))
    .map(file => {
      return imbaWatcher.startWatching(file, config);
    });
  
  // Compiler les autres fichiers en parallèle avec les watchers Imba
  const otherFilesPromise = Promise.all(
    otherFiles
      .filter(file => fs.existsSync(file))
      .map(async (file) => {
        console.log(`📦 Building ${file}...`);
        await buildFile(file, config);
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
  
  // Générer le manifest initial
  generateManifest(config.targetBrowser);
  console.log('\n👁️  Watching for changes... (Press Ctrl+C to stop)\n');
  
  // Fonction pour rebuild les autres fichiers
  async function rebuildFile(file, reason = 'File changed') {
    console.log(`\n🔄 ${reason}: ${file}`);
    try {
      await buildFile(file, config);
      generateManifest(config.targetBrowser);
      console.log('✅ Rebuild completed\n');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
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
  
  // Gestion propre de l'arrêt
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    imbaWatcher.stopAll();
    process.exit(0);
  });
  
  // Maintenir le processus actif
  process.stdin.resume();
}

module.exports = { startWatchMode };