const fs = require('fs');
const path = require('path');

/**
 * Copie récursivement le contenu d'un dossier vers un autre
 */
function copyAssetsFolder(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    return [];
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const copiedFiles = [];
  const items = fs.readdirSync(srcDir);

  items.forEach(item => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      // Copie récursive des sous-dossiers
      const subFiles = copyAssetsFolder(srcPath, destPath);
      copiedFiles.push(...subFiles);
    } else {
      // Copie du fichier
      fs.copyFileSync(srcPath, destPath);
      copiedFiles.push(path.relative('src/assets', srcPath));
      console.log(`✅ Asset: ${item} → dist/assets/${path.relative('src/assets', srcPath)}`);
    }
  });

  return copiedFiles;
}

/**
 * Combine les assets de src/assets avec ceux générés par Imba
 */
function combineAssets() {
  const srcAssetsDir = 'src/assets';
  const distAssetsDir = 'dist/assets';
  
  console.log('📁 Copying assets from src/assets...');
  const copiedFiles = copyAssetsFolder(srcAssetsDir, distAssetsDir);
  
  if (copiedFiles.length > 0) {
    console.log(`✅ Copied ${copiedFiles.length} asset(s) to dist/assets/`);
  } else {
    console.log('ℹ️  No assets found in src/assets/');
  }
  
  return copiedFiles;
}

module.exports = { copyAssetsFolder, combineAssets };