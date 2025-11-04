const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  generateTempDir, 
  findGeneratedFile, 
  copyAssetsRecursively,
  fixBackslashesInHtml,
  cleanupTempDir 
} = require('../utils/fs');

/**
 * Compile un fichier HTML avec Imba
 */
function buildHtmlFile(file, config) {
  const fileName = path.basename(file, '.html');
  const tempDir = generateTempDir();
  const outputHtmlFile = path.join('dist', `${fileName}.html`);
  
  try {
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (config.isDev) {
      buildOptions += ' -d';
    }
    
    // Compiler le fichier HTML avec Imba
    const command = `npx imba build ${buildOptions} -o ${tempDir} ${file}`;
    execSync(command, { stdio: 'pipe' });
    
    // Copier le fichier HTML
    const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
    if (fs.existsSync(tempHtmlFile)) {
      fs.copyFileSync(tempHtmlFile, outputHtmlFile);
      fixBackslashesInHtml(outputHtmlFile);
      console.log(`✅ ${file} → ${outputHtmlFile}`);
    }
    
    // Copier les assets (CSS, JS) générés
    const assetsDir = path.join(tempDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const distAssetsDir = path.join('dist', 'assets');
      copyAssetsRecursively(assetsDir, distAssetsDir);
      
      const assetFiles = fs.readdirSync(assetsDir);
      assetFiles.forEach(asset => {
        console.log(`✅ Asset: ${asset} → dist/assets/${asset}`);
      });
    }
    
    // Chercher et copier le fichier JS principal s'il existe
    const generatedJsFile = findGeneratedFile(tempDir, fileName);
    if (generatedJsFile && !generatedJsFile.includes('assets')) {
      const outputJsFile = path.join('dist', `${fileName}.js`);
      fs.copyFileSync(generatedJsFile, outputJsFile);
      console.log(`✅ JS: ${fileName}.js → ${outputJsFile}`);
    }
    
  } catch (error) {
    console.error(`❌ Error building ${file}:`);
    console.error(`   ${error.message}`);
    
    // Debug: lister le contenu du dossier temp
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir);
      console.error(`   Temp dir contents: ${tempFiles.join(', ')}`);
      
      // Lister aussi le contenu des sous-dossiers
      tempFiles.forEach(item => {
        const itemPath = path.join(tempDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          const subFiles = fs.readdirSync(itemPath);
          console.error(`   ${item}/ contents: ${subFiles.join(', ')}`);
        }
      });
    }
    
    if (!config.isWatchMode) {
      process.exit(1);
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

module.exports = { buildHtmlFile };