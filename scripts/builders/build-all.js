const fs = require('fs');
const path = require('path');
const { buildFile } = require('./imba');
const { combineAssets } = require('../utils/assets');

/**
 * Compile un fichier en fonction de son extension
 */
async function buildSingleFile(file, config) {
  const ext = path.extname(file);

  if (ext === '.imba' || ext === '.html') {
    await buildFile(file, config);
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
    await Promise.all(existingFiles.map(file => buildSingleFile(file, config)));

    console.log('\n🎉 All files compiled successfully!');
    
    console.log('');
    combineAssets();

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    if (!config.isWatchMode) {
      process.exit(1);
    }
  }
}

module.exports = { buildSingleFile, buildAll };