// builders/watch.js (modifié)
const fs = require('fs');
const { buildFile } = require('./build-all');
const { generateManifest } = require('../manifest/generator');
const { ImbaWatcher } = require('./imba-watch');

/**
 * Démarre le mode watch hybride
 */
async function startWatchMode(files, config) {
  console.log(`👀 Starting hybrid watch mode for ${config.targetBrowser}...\n`);
  
  // Build initial
  const { buildAll } = require('./build-all');
  await buildAll(files, config);
  
  console.log('\n🎉 Initial build completed!');
  console.log('👁️  Starting watchers... (Press Ctrl+C to stop)\n');
  
  const imbaWatcher = new ImbaWatcher();
  
  // Séparer les fichiers Imba des autres
  const imbaFiles = files.filter(file => 
    file.endsWith('.imba') || 
    (file.endsWith('.html') && fs.existsSync(file.replace('.html', '.imba')))
  );
  const otherFiles = files.filter(file => !imbaFiles.includes(file));
  
  // Démarrer les watchers Imba natifs pour les fichiers .imba et .html avec composants Imba
  imbaFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🎯 Starting Imba native watcher for ${file}...`);
      imbaWatcher.startWatching(file, config);
    }
  });
  
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