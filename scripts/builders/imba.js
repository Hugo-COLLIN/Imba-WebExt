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
  return new Promise((resolve) => {
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
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let stderr = '';
    let stdout = '';
    let hasResolved = false; // Flag pour éviter les résolutions multiples
    
    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;
      
      // Traitement des fichiers après un petit délai
      setTimeout(() => {
        try {
          const generatedFile = findGeneratedFile(tempDir, fileName);
          
          if (generatedFile) {
            if (!fs.existsSync('dist')) {
              fs.mkdirSync('dist', { recursive: true });
            }
            
            fs.copyFileSync(generatedFile, outputFile);
            console.log(`✅ ${file} → ${outputFile}`);
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
    
    // Timeout de sécurité
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        console.log(`⏰ Timeout for ${file}`);
        imbaProcess.kill('SIGTERM');
        resolveOnce();
      }
    }, 15000);
    
    // Écouter seulement l'événement 'close' qui est le dernier à être émis
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

module.exports = { buildImbaFile };