const { spawn } = require('child_process');
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
 * Compile un fichier HTML avec Imba (version asynchrone)
 */
function buildHtmlFile(file, config) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(file, '.html');
    const tempDir = generateTempDir();
    const outputHtmlFile = path.join('dist', `${fileName}.html`);
    
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (config.isDev) {
      buildOptions += ' -d';
    }
    
    // Compiler le fichier HTML avec Imba
    const args = ['build', ...buildOptions.split(' '), '-o', tempDir, file];
    const imbaProcess = spawn('npx', ['imba', ...args], {
      stdio: 'pipe',
      shell: true
    });
    
    let stderr = '';
    
    imbaProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    imbaProcess.on('close', (code) => {
      try {
        if (code !== 0) {
          throw new Error(`Imba compilation failed with code ${code}\n${stderr}`);
        }
        
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
        
        resolve();
        
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
          reject(error);
        } else {
          resolve(); // En mode watch, on continue malgré l'erreur
        }
      } finally {
        cleanupTempDir(tempDir);
      }
    });
    
    imbaProcess.on('error', (error) => {
      console.error(`❌ Failed to start Imba compiler for ${file}:`, error.message);
      cleanupTempDir(tempDir);
      reject(error);
    });
  });
}

module.exports = { buildHtmlFile };