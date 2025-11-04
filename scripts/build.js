const fs = require('fs');
const { parseArguments } = require('./utils/args');
const { cleanDist, ensureTempDir } = require('./utils/fs');
const { buildAll } = require('./builders/build-all');
const { startWatchMode } = require('./builders/watch');
const { generateManifest } = require('./manifest/generator');

// Configuration des fichiers à compiler
const files = [
  'src/background.imba',
  'src/content.imba', 
  'src/popup/popup.html',
  'src/options/options.html'
];

// Parse les arguments
const config = parseArguments(process.argv);

// Initialisation
cleanDist();
ensureTempDir();

// Exécution
if (config.isWatchMode) {
  startWatchMode(files, config);
} else {
  buildAll(files, config).catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

// Générer le manifest
console.log('');
generateManifest(config.targetBrowser);