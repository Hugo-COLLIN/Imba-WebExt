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
  
  // Surveiller les fichiers principaux
  files.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file}...`);
      fs.watchFile(file, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`\n🔄 File changed: ${file}`);
          try {
            await buildFile(file, config);
            
            // Régénérer le manifest après chaque changement
            console.log('');
            generateManifest(config.targetBrowser);
          } catch (error) {
            console.error('Build failed:', error.message);
          }
        }
      });
    }
  });
  
  // Surveiller les fichiers .imba référencés par les HTML
  const imbaFilesToWatch = [
    'src/options/options.imba',
    'src/popup/popup.imba'
  ];
  
  imbaFilesToWatch.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file} (referenced by HTML)...`);
      fs.watchFile(file, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`\n🔄 Imba file changed: ${file}`);
          // Recompiler le fichier HTML correspondant
          const htmlFile = file.replace('.imba', '.html');
          if (files.includes(htmlFile)) {
            try {
              await buildFile(htmlFile, config);
              
              // Régénérer le manifest
              console.log('');
              generateManifest(config.targetBrowser);
            } catch (error) {
              console.error('Build failed:', error.message);
            }
          }
        }
      });
    }
  });
  
  // Surveiller le manifest source
  const manifestFile = 'src/manifest.json';
  if (fs.existsSync(manifestFile)) {
    console.log(`🔍 Watching ${manifestFile}...`);
    fs.watchFile(manifestFile, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log(`\n🔄 Manifest changed: ${manifestFile}`);
        generateManifest(config.targetBrowser);
      }
    });
  }
  
  console.log('\n👁️  Watching for changes... (Press Ctrl+C to stop)');
  
  // Gestion de l'arrêt propre
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    files.forEach(file => fs.unwatchFile(file));
    imbaFilesToWatch.forEach(file => fs.unwatchFile(file));
    fs.unwatchFile(manifestFile);
    process.exit();
  });
}

module.exports = { startWatchMode };