const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  generateTempDir, 
  findGeneratedFile, 
  copyAssetsRecursively,
  fixBackslashesInHtml,
  cleanupTempDir 
} = require('../utils/fs');

function buildHtmlFile(file, config) {
  return new Promise((resolve) => {
    const fileName = path.basename(file, '.html');
    const tempDir = generateTempDir();
    const outputHtmlFile = path.join('dist', `${fileName}.html`);
    
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (config.isDev) {
      buildOptions += ' -d';
    }
    
    const command = `npx imba build ${buildOptions} -o "${tempDir}" "${file}"`;
    
    exec(command, { 
      timeout: 15000, // 15 secondes pour les HTML (plus longs à compiler)
      maxBuffer: 1024 * 1024 * 10
    }, (error, stdout, stderr) => {
      try {
        // Vérifier si c'est une vraie erreur ou juste des warnings
        const isRealError = error && (
          !fs.existsSync(tempDir) || 
          fs.readdirSync(tempDir).length === 0 ||
          (stderr && stderr.includes('Error:') && !stderr.includes('[WARNING]'))
        );
        
        if (isRealError) {
          console.log(`❌ ${file} compilation failed: ${error.message}`);
          if (stderr && !stderr.includes('[WARNING]')) {
            console.log(`   Error: ${stderr.trim()}`);
          }
        } else if (stderr && stderr.includes('[WARNING]')) {
          // Afficher les warnings mais ne pas les traiter comme des erreurs
          console.log(`⚠️  ${file} compiled with warnings:`);
          console.log(`   ${stderr.trim()}`);
        }
        
        // S'assurer que le dossier dist existe
        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist', { recursive: true });
        }
        
        // Copier le fichier HTML
        const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
        if (fs.existsSync(tempHtmlFile)) {
          fs.copyFileSync(tempHtmlFile, outputHtmlFile);
          fixBackslashesInHtml(outputHtmlFile);
          console.log(`✅ ${file} → ${outputHtmlFile}`);
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
        
        // Chercher le fichier JS principal
        const generatedJsFile = findGeneratedFile(tempDir, fileName);
        if (generatedJsFile && !generatedJsFile.includes('assets')) {
          const outputJsFile = path.join('dist', `${fileName}.js`);
          fs.copyFileSync(generatedJsFile, outputJsFile);
          console.log(`✅ JS: ${fileName}.js → ${outputJsFile}`);
        }
        
      } catch (processError) {
        console.log(`⚠️ Warning processing ${file}: ${processError.message}`);
      } finally {
        cleanupTempDir(tempDir);
        resolve();
      }
    });
  });
}

module.exports = { buildHtmlFile };