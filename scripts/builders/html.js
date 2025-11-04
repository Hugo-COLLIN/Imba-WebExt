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
  return new Promise((resolve) => {
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
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let stderr = '';
    let stdout = '';
    let hasResolved = false;
    
    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;
      
      setTimeout(() => {
        try {
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
          
        } catch (error) {
          console.log(`⚠️ Warning processing ${file}: ${error.message}`);
        } finally {
          cleanupTempDir(tempDir);
          resolve();
        }
      }, 100);
    };
    
    imbaProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    imbaProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        console.log(`⏰ Timeout for ${file}`);
        imbaProcess.kill('SIGTERM');
        resolveOnce();
      }
    }, 15000);
    
    imbaProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code !== 0 && code !== null) {
        console.log(`❌ ${file} compilation failed with code ${code}`);
        if (stderr) console.log(`   Error: ${stderr.trim()}`);
      }
      
      resolveOnce();
    });
    
    imbaProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ Failed to start compiler for ${file}: ${error.message}`);
      resolveOnce();
    });
  });
}

module.exports = { buildHtmlFile };