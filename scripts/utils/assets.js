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
 * Copie un fichier individuel vers dist/
 */
function copyRootFile(fileName) {
  const srcFile = fileName;
  const destFile = path.join('dist', fileName);
  
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`✅ Root file: ${fileName} → dist/${fileName}`);
    return true;
  } else {
    console.log(`⚠️  Root file not found: ${fileName}`);
    return false;
  }
}

/**
 * Combine les assets de src/assets avec ceux générés par Imba et copie les fichiers racine
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
  
  // Copier les fichiers racine
  console.log('📄 Copying root files...');
  const rootFiles = ['LICENSE'];
  let rootFilesCopied = 0;
  
  rootFiles.forEach(file => {
    if (copyRootFile(file)) {
      rootFilesCopied++;
    }
  });
  
  if (rootFilesCopied > 0) {
    console.log(`✅ Copied ${rootFilesCopied} root file(s) to dist/`);
  }
  
  return { assets: copiedFiles, rootFiles: rootFilesCopied };
}

module.exports = { copyAssetsFolder, combineAssets, copyRootFile };