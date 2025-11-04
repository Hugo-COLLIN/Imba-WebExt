const fs = require('fs');
const path = require('path');
const { buildImbaFile } = require('./imba');
const { buildHtmlFile } = require('./html');
const { generateManifest } = require('../manifest/generator');

/**
 * Compile un fichier en fonction de son extension
 */
function buildFile(file, config) {
  const ext = path.extname(file);
  
  if (ext === '.imba') {
    buildImbaFile(file, config);
  } else if (ext === '.html') {
    buildHtmlFile(file, config);
  } else {
    console.warn(`⚠️  Unsupported file type: ${file}`);
  }
}

/**
 * Compile tous les fichiers
 */
function buildAll(files, config) {
  console.log(`🚀 Starting Imba compilation for ${config.targetBrowser}...\n`);
  
  // Compiler tous les fichiers séquentiellement
  for (const file of files) {
    if (fs.existsSync(file)) {
      buildFile(file, config);
    } else {
      console.warn(`⚠️  File not found: ${file}`);
    }
  }
  
  // Générer le manifest après la compilation
  console.log('');
  generateManifest(config.targetBrowser);
  
  console.log('\n🎉 All files compiled successfully!');
}

module.exports = { buildFile, buildAll };