const fs = require('fs');
const path = require('path');
const { buildImbaFile } = require('./imba');
const { buildHtmlFile } = require('./html');
const { combineAssets } = require('../utils/assets');

/**
 * Compile un fichier en fonction de son extension
 */
async function buildFile(file, config) {
  const ext = path.extname(file);

  if (ext === '.imba') {
    await buildImbaFile(file, config);
  } else if (ext === '.html') {
    await buildHtmlFile(file, config);
  } else {
    console.warn(`⚠️  Unsupported file type: ${file}`);
  }
}

/**
 * Compile tous les fichiers en parallèle et copie les assets
 */
async function buildAll(files, config) {
  console.log(`🚀 Starting Imba compilation for ${config.targetBrowser}...\n`);

  const existingFiles = files.filter(file => {
    if (fs.existsSync(file)) {
      return true;
    } else {
      console.warn(`⚠️  File not found: ${file}`);
      return false;
    }
  });

  try {
    // Attendre que toutes les builds soient vraiment terminées
    await Promise.all(existingFiles.map(file => buildFile(file, config)));

    console.log('\n🎉 All files compiled successfully!');
    
    // Copier les assets après la compilation
    console.log('');
    combineAssets();

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    if (!config.isWatchMode) {
      process.exit(1);
    }
  }
}

module.exports = { buildFile, buildAll };