const fs = require('fs');
const path = require('path');
const { 
  findGeneratedFile, 
  copyAssetsRecursively,
  fixBackslashesInHtml 
} = require('../utils/fs');

class FileCopier {
  /**
   * Copie les fichiers générés vers le dossier dist
   */
  static async copyGeneratedFiles(file, tempDir, fileName) {
    const ext = path.extname(file);
    const isHtml = ext === '.html';
    
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }
    
    let filesFound = { html: false, js: false };
    
    if (isHtml) {
      filesFound = await this.copyHtmlFiles(fileName, tempDir);
    } else {
      filesFound = await this.copyImbaFiles(fileName, tempDir);
    }
    
    return filesFound;
  }
  
  /**
   * Copie les fichiers HTML et leurs assets
   */
  static async copyHtmlFiles(fileName, tempDir) {
    let filesFound = { html: false, js: false };
    
    // Copier le fichier HTML
    const outputHtmlFile = path.join('dist', `${fileName}.html`);
    const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
    
    if (fs.existsSync(tempHtmlFile)) {
      fs.copyFileSync(tempHtmlFile, outputHtmlFile);
      fixBackslashesInHtml(outputHtmlFile);
      console.log(`✅ ${fileName}.html → ${outputHtmlFile}`);
      filesFound.html = true;
    }
    
    // Copier les assets
    const assetsDir = path.join(tempDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const distAssetsDir = path.join('dist', 'assets');
      copyAssetsRecursively(assetsDir, distAssetsDir);
      const assetFiles = fs.readdirSync(assetsDir);
      assetFiles.forEach(asset => {
        console.log(`✅ Asset: ${asset} → dist/assets/${asset}`);
      });
    }
    
    // Copier le JS principal
    const generatedJsFile = findGeneratedFile(tempDir, fileName);
    if (generatedJsFile && !generatedJsFile.includes('assets')) {
      const outputJsFile = path.join('dist', `${fileName}.js`);
      fs.copyFileSync(generatedJsFile, outputJsFile);
      console.log(`✅ JS: ${fileName}.js → ${outputJsFile}`);
      filesFound.js = true;
    }
    
    return filesFound;
  }
  
  /**
   * Copie les fichiers Imba compilés
   */
  static async copyImbaFiles(fileName, tempDir) {
    const outputFile = path.join('dist', `${fileName}.js`);
    const generatedFile = findGeneratedFile(tempDir, fileName);
    
    if (generatedFile) {
      fs.copyFileSync(generatedFile, outputFile);
      console.log(`✅ ${fileName}.imba → ${outputFile}`);
      return { js: true };
    }
    
    return { js: false };
  }
}

module.exports = { FileCopier };