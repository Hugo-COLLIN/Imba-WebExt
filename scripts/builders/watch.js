const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { buildSingleFile } = require('./build-all');
const { generateManifest } = require('../manifest/generator');
const { combineAssets } = require('../utils/assets');
const { 
  generateTempDir, 
  findGeneratedFile, 
  cleanupTempDir,
  copyAssetsRecursively,
  fixBackslashesInHtml
} = require('../utils/fs');

class UnifiedWatcher {
  constructor() {
    this.imbaWatchers = new Map();
    this.tempDirs = new Map();
    this.initialBuildComplete = new Map();
    this.fileWatchers = new Set();
  }

  /**
   * Démarre un watcher Imba natif pour un fichier spécifique
   */
  startImbaWatcher(file, config) {
    return new Promise((resolve) => {
      const fileName = path.basename(file, path.extname(file));
      const tempDir = generateTempDir();
      this.tempDirs.set(file, tempDir);
      this.initialBuildComplete.set(file, false);
      
      let buildOptions = '--esm -M --base . --watch';
      if (config.isDev) {
        buildOptions += ' -d';
      }
      
      console.log(`🎯 Starting Imba native watcher for ${file}...`);
      
      const watcher = spawn('npx', [
        'imba', 'build', 
        ...buildOptions.split(' ').filter(opt => opt),
        '-o', tempDir,
        file
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      watcher.stdout.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('built') || output.includes('compiled')) {
          this.handleImbaFileChange(file, config);
          
          if (!this.initialBuildComplete.get(file)) {
            this.initialBuildComplete.set(file, true);
            console.log(`✅ Initial build completed for ${file}`);
            resolve();
          }
        }
      });

      watcher.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('[WARNING]')) {
          console.error(`❌ Imba watcher error for ${file}:`, error);
        }
      });

      watcher.on('close', (code) => {
        console.log(`🛑 Imba watcher for ${file} stopped (code: ${code})`);
      });

      watcher.on('error', (error) => {
        console.error(`❌ Failed to start watcher for ${file}:`, error);
        resolve();
      });

      this.imbaWatchers.set(file, watcher);
      
      setTimeout(() => {
        if (!this.initialBuildComplete.get(file)) {
          console.log(`⏰ Initial build timeout for ${file}, continuing...`);
          this.initialBuildComplete.set(file, true);
          resolve();
        }
      }, 10000);
    });
  }

  /**
   * Gère les changements détectés par Imba
   */
  async handleImbaFileChange(file, config) {
    const fileName = path.basename(file, path.extname(file));
    const tempDir = this.tempDirs.get(file);
    const ext = path.extname(file);
    
    try {
      if (ext === '.imba') {
        await this.copyImbaOutput(file, fileName, tempDir);
      } else if (ext === '.html') {
        await this.copyHtmlOutput(file, fileName, tempDir);
      }
      
      if (this.initialBuildComplete.get(file)) {
        console.log(`✅ ${file} recompiled and copied`);
      }
    } catch (error) {
      console.error(`❌ Error handling change for ${file}:`, error.message);
    }
  }

  /**
   * Copie la sortie d'un fichier Imba
   */
  async copyImbaOutput(file, fileName, tempDir) {
    const outputFile = path.join('dist', `${fileName}.js`);
    const generatedFile = findGeneratedFile(tempDir, fileName);
    
    if (generatedFile && fs.existsSync(generatedFile)) {
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true });
      }
      fs.copyFileSync(generatedFile, outputFile);
    }
  }

  /**
   * Copie la sortie d'un fichier HTML
   */
  async copyHtmlOutput(file, fileName, tempDir) {
    // Copier le fichier HTML
    const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
    const outputHtmlFile = path.join('dist', `${fileName}.html`);
    
    if (fs.existsSync(tempHtmlFile)) {
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true });
      }
      fs.copyFileSync(tempHtmlFile, outputHtmlFile);
      fixBackslashesInHtml(outputHtmlFile);
    }
    
    // Copier les assets
    const assetsDir = path.join(tempDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const distAssetsDir = path.join('dist', 'assets');
      copyAssetsRecursively(assetsDir, distAssetsDir);
    }
    
    // Copier le JS principal
    const generatedJsFile = findGeneratedFile(tempDir, fileName);
    if (generatedJsFile && !generatedJsFile.includes('assets')) {
      const outputJsFile = path.join('dist', `${fileName}.js`);
      fs.copyFileSync(generatedJsFile, outputJsFile);
    }
  }

  /**
   * Démarre la surveillance d'un fichier avec polling
   */
  startPollingWatcher(file, callback) {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file} with polling...`);
      fs.watchFile(file, { interval: 1000 }, callback);
      this.fileWatchers.add(file);
    }
  }

  /**
   * Surveille récursivement un dossier
   */
  watchDirectoryRecursively(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    const watchedPaths = new Set();
    
    const watchDirectory = (directory) => {
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
              fs.watchFile(itemPath, { interval: 1000 }, callback);
              watchDirectory(itemPath);
            } else {
              fs.watchFile(itemPath, { interval: 1000 }, callback);
            }
            this.fileWatchers.add(itemPath);
          } catch (error) {
            // Ignorer les erreurs de fichiers temporaires
          }
        });
      } catch (error) {
        console.warn(`⚠️ Cannot watch directory ${directory}:`, error.message);
      }
    };
    
    watchDirectory(dir);
  }

  /**
   * Arrête tous les watchers
   */
  stopAll() {
    // Arrêter les watchers Imba
    this.imbaWatchers.forEach((watcher, file) => {
      watcher.kill('SIGTERM');
      const tempDir = this.tempDirs.get(file);
      if (tempDir) {
        cleanupTempDir(tempDir);
      }
    });
    
    // Arrêter les watchers de fichiers
    this.fileWatchers.forEach(file => {
      fs.unwatchFile(file);
    });
    
    // Nettoyer les maps
    this.imbaWatchers.clear();
    this.tempDirs.clear();
    this.initialBuildComplete.clear();
    this.fileWatchers.clear();
  }
}

/**
 * Démarre le mode watch hybride optimisé
 */
async function startWatchMode(files, config) {
  console.log(`👀 Starting optimized watch mode for ${config.targetBrowser}...\n`);
  
  const watcher = new UnifiedWatcher();
  
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
  
  // Démarrer tous les watchers Imba en parallèle
  const watcherPromises = imbaFiles
    .filter(file => fs.existsSync(file))
    .map(file => watcher.startImbaWatcher(file, config));
  
  // Compiler les autres fichiers en parallèle
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
  
  // Copier les assets initiaux
  console.log('');
  combineAssets();
  
  // Générer le manifest initial
  generateManifest(config.targetBrowser);
  console.log('\n👁️  Watching for changes... (Press Ctrl+C to stop)\n');
  
  // Fonctions de callback pour les changements
  const rebuildFile = async (file, reason = 'File changed') => {
    console.log(`\n🔄 ${reason}: ${file}`);
    try {
      await buildSingleFile(file, config);
      generateManifest(config.targetBrowser);
      console.log('✅ Rebuild completed\n');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
    }
  };
  
  const rebuildAssets = () => {
    console.log(`\n🔄 Assets changed`);
    try {
      combineAssets();
      console.log('✅ Assets updated\n');
    } catch (error) {
      console.error('❌ Assets copy failed:', error.message);
    }
  };
  
  const rebuildManifest = () => {
    console.log(`\n🔄 Manifest changed`);
    generateManifest(config.targetBrowser);
    console.log('✅ Manifest updated\n');
  };
  
  const rebuildLicense = () => {
    console.log(`\n🔄 LICENSE file changed`);
    const { copyRootFile } = require('../utils/assets');
    copyRootFile('LICENSE');
    console.log('✅ LICENSE updated\n');
  };
  
  // Surveiller les autres fichiers
  otherFiles.forEach(file => {
    watcher.startPollingWatcher(file, async (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        await rebuildFile(file);
      }
    });
  });
  
  // Surveiller les différents dossiers et fichiers
  watcher.watchDirectoryRecursively('src/assets', rebuildAssets);
  watcher.startPollingWatcher('src/manifest.json', rebuildManifest);
  watcher.startPollingWatcher('LICENSE', rebuildLicense);
  
  // Gestion propre de l'arrêt
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    watcher.stopAll();
    process.exit(0);
  });
  
  // Maintenir le processus actif
  process.stdin.resume();
}

module.exports = { startWatchMode };