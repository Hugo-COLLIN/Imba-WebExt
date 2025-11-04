const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Crée le dossier dist vierge
 */
function cleanDist() {
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  fs.mkdirSync('dist', { recursive: true });
}

/**
 * Crée le dossier temp s'il n'existe pas
 */
function ensureTempDir() {
  if (!fs.existsSync('temp.local')) {
    fs.mkdirSync('temp.local', { recursive: true });
  }
}

/**
 * Génère un nom de dossier temporaire unique
 */
function generateTempDir() {
  return `temp.local/${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Cherche le fichier généré par Imba dans un dossier temporaire
 */
function findGeneratedFile(tempDir, expectedName) {
  if (!fs.existsSync(tempDir)) return null;
  
  // Chercher d'abord le fichier .mjs (format ESM)
  const mjsFile = path.join(tempDir, `${expectedName}.mjs`);
  if (fs.existsSync(mjsFile)) {
    return mjsFile;
  }
  
  // Puis chercher le fichier .js
  const jsFile = path.join(tempDir, `${expectedName}.js`);
  if (fs.existsSync(jsFile)) {
    return jsFile;
  }
  
  // Chercher dans le dossier assets
  const assetsDir = path.join(tempDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsFiles = assetFiles.filter(f => f.includes(expectedName) && f.endsWith('.js'));
    if (jsFiles.length > 0) {
      return path.join(assetsDir, jsFiles[0]);
    }
  }
  
  // Chercher n'importe quel fichier .mjs ou .js
  const files = fs.readdirSync(tempDir);
  const moduleFiles = files.filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  
  if (moduleFiles.length > 0) {
    return path.join(tempDir, moduleFiles[0]);
  }
  
  return null;
}

/**
 * Copie récursivement tous les assets d'un dossier
 */
function copyAssetsRecursively(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const items = fs.readdirSync(srcDir);
  
  items.forEach(item => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyAssetsRecursively(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

/**
 * Corrige les backslashes dans les fichiers HTML
 */
function fixBackslashesInHtml(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remplacer tous les backslashes par des slashes dans les attributs href et src
    content = content.replace(/(href|src)=['"]([^'"]*)['"]/g, (match, attr, path) => {
      const fixedPath = path.replace(/\\/g, '/');
      return `${attr}='${fixedPath}'`;
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`🔧 Fixed backslashes in ${filePath}`);
  } catch (error) {
    console.warn(`⚠️  Could not fix backslashes in ${filePath}:`, error.message);
  }
}

/**
 * Nettoie un dossier temporaire
 */
function cleanupTempDir(tempDir) {
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn(`⚠️  Could not clean temp dir ${tempDir}`);
    }
  }
}

module.exports = {
  cleanDist,
  ensureTempDir,
  generateTempDir,
  findGeneratedFile,
  copyAssetsRecursively,
  fixBackslashesInHtml,
  cleanupTempDir
};