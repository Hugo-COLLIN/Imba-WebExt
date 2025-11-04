const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  generateTempDir, 
  findGeneratedFile, 
  cleanupTempDir 
} = require('../utils/fs');

/**
 * Compile un fichier .imba (version asynchrone)
 */
function buildImbaFile(file, config) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(file, '.imba');
    const tempDir = generateTempDir();
    const outputFile = path.join('dist', `${fileName}.js`);
    
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (config.isDev) {
      buildOptions += ' -d';
    }
    
    // Compiler dans le dossier temporaire unique
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
        
        // Trouver le fichier généré (.mjs ou .js)
        const generatedFile = findGeneratedFile(tempDir, fileName);
        
        if (generatedFile) {
          // Copier le fichier en le renommant en .js
          fs.copyFileSync(generatedFile, outputFile);
          console.log(`✅ ${file} → ${outputFile}`);
          resolve();
        } else {
          throw new Error(`No module file generated in ${tempDir}`);
        }
      } catch (error) {
        console.error(`❌ Error building ${file}:`);
        console.error(`   ${error.message}`);
        
        // Debug: lister le contenu du dossier temp
        if (fs.existsSync(tempDir)) {
          const tempFiles = fs.readdirSync(tempDir);
          console.error(`   Temp dir contents: ${tempFiles.join(', ')}`);
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

module.exports = { buildImbaFile };