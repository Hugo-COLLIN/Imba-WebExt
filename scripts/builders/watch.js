const fs = require('fs');
const { buildFile } = require('./build-all');
const { generateManifest } = require('../manifest/generator');

/**
 * Démarre le mode watch
 */
async function startWatchMode(files, config) {
  console.log(`👀 Starting watch mode for ${config.targetBrowser}...\n`);
  
  // Build initial
  const { buildAll } = require('./build-all');
  await buildAll(files, config);
  
  console.log('\n🎉 Initial build completed!');
  console.log('👁️  Watching for changes... (Press Ctrl+C to stop)\n');
  
  // Fonction pour rebuild
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
  
  // Surveiller les fichiers
  files.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file}...`);
      fs.watchFile(file, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          await rebuildFile(file);
        }
      });
    }
  });
  
  // Surveiller les fichiers .imba référencés
  const imbaFilesToWatch = [
    'src/options/options.imba',
    'src/popup/popup.imba'
  ];
  
  imbaFilesToWatch.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file} (referenced by HTML)...`);
      fs.watchFile(file, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          const htmlFile = file.replace('.imba', '.html');
          if (files.includes(htmlFile)) {
            await rebuildFile(htmlFile, `Imba file changed`);
          }
        }
      });
    }
  });
  
  // Surveiller le manifest
  const manifestFile = 'src/manifest.json';
  if (fs.existsSync(manifestFile)) {
    console.log(`🔍 Watching ${manifestFile}...`);
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
    process.exit(0);
  });
  
  // Maintenir le processus actif
  process.stdin.resume();
}

module.exports = { startWatchMode };