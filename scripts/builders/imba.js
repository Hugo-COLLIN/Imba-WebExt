const { exec } = require('child_process');
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
    
    const command = `npx imba build ${buildOptions} -o "${tempDir}" "${file}"`;
    
    let hasResolved = false;
    let childProcess = null;
    
    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;
      
      try {
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
      } catch (error) {
        console.log(`⚠️ Warning processing ${file}: ${error.message}`);
      } finally {
        // Tuer le processus s'il est encore en cours
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
        }
        cleanupTempDir(tempDir);
        resolve();
      }
    };
    
    // Surveiller la création du fichier de sortie
    const expectedExtensions = ['.mjs', '.js'];
    const checkInterval = setInterval(() => {
      if (hasResolved) {
        clearInterval(checkInterval);
        return;
      }
      
      // Vérifier si un fichier a été généré
      for (const ext of expectedExtensions) {
        const expectedFile = path.join(tempDir, `${fileName}${ext}`);
        if (fs.existsSync(expectedFile)) {
          clearInterval(checkInterval);
          // Attendre un peu pour s'assurer que l'écriture est terminée
          setTimeout(resolveOnce, 200);
          return;
        }
      }
    }, 100); // Vérifier toutes les 100ms
    
    // Timeout de sécurité (plus long mais ne devrait pas être atteint)
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!hasResolved) {
        console.log(`⏰ Timeout for ${file} (fallback)`);
        resolveOnce();
      }
    }, 15000);
    
    // Lancer la compilation
    childProcess = exec(command, { 
      maxBuffer: 1024 * 1024 * 10
    }, (error, stdout, stderr) => {
      clearTimeout(timeout);
      clearInterval(checkInterval);
      
      // Si le fichier n'a pas encore été traité, le faire maintenant
      if (!hasResolved) {
        if (stderr && stderr.includes('[WARNING]')) {
          console.log(`⚠️ ${file} compiled with warnings`);
        }
        resolveOnce();
      }
    });
  });
}

module.exports = { buildImbaFile };