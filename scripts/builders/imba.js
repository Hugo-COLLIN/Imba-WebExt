const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  generateTempDir, 
  findGeneratedFile, 
  cleanupTempDir 
} = require('../utils/fs');

function buildImbaFile(file, config) {
  return new Promise((resolve) => {
    const fileName = path.basename(file, '.imba');
    const tempDir = generateTempDir();
    const outputFile = path.join('dist', `${fileName}.js`);
    
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (config.isDev) {
      buildOptions += ' -d';
    }
    
    const command = `npx imba build ${buildOptions} -o "${tempDir}" "${file}"`;
    
    exec(command, { 
      timeout: 10000, // Réduire à 10 secondes
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
          console.log(`⚠️ ${file}  compiled with warnings:`);
          console.log(`   ${stderr.trim()}`);
        }
        
        // Traitement des fichiers (même s'il y a eu des warnings)
        const generatedFile = findGeneratedFile(tempDir, fileName);
        
        if (generatedFile) {
          if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist', { recursive: true });
          }
          
          fs.copyFileSync(generatedFile, outputFile);
          console.log(`✅ ${file} → ${outputFile}`);
        } else {
          console.log(`⚠️ No output file found for ${file}`);
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

module.exports = { buildImbaFile };