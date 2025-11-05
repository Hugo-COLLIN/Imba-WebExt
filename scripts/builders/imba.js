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
    let capturedStdout = '';
    let capturedStderr = '';
    
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
          
          // Afficher les erreurs capturées
          if (capturedStderr) {
            console.log('\n❌ STDERR from Imba compiler:');
            console.log('─'.repeat(60));
            console.log(capturedStderr);
            console.log('─'.repeat(60));
          }
          
          // if (capturedStdout) {
          //   console.log('\n📝 STDOUT from Imba compiler:');
          //   console.log('─'.repeat(60));
          //   console.log(capturedStdout);
          //   console.log('─'.repeat(60));
          // }
          
          // Lister le contenu du tempDir pour déboguer
          console.log(`\n📂 Contents of temp directory (${tempDir}):`);
          try {
            const files = fs.readdirSync(tempDir, { withFileTypes: true, recursive: true });
            if (files.length === 0) {
              console.log('  (empty directory)');
            } else {
              files.forEach(file => {
                const fullPath = path.join(file.path || tempDir, file.name);
                const relativePath = path.relative(tempDir, fullPath);
                console.log(`  - ${relativePath}`);
              });
            }
          } catch (e) {
            console.log(`  Error reading directory: ${e.message}`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Warning processing ${file}: ${error.message}`);
        
        // Afficher les captures si disponibles
        if (capturedStderr) {
          console.log('\n❌ STDERR:');
          console.log(capturedStderr);
        }
        // if (capturedStdout) {
        //   console.log('\n📝 STDOUT:');
        //   console.log(capturedStdout);
        // }
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
    
    // Timeout de sécurité
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
      
      // Capturer les sorties
      capturedStdout = stdout || '';
      capturedStderr = stderr || '';
      
      // Afficher les erreurs immédiatement si présentes
      if (error) {
        console.log(`\n❌ Compilation error for ${file}:`);
        console.log(`   Exit code: ${error.code}`);
        console.log(`   Signal: ${error.signal}`);
      }
      
      // Si le fichier n'a pas encore été traité, le faire maintenant
      if (!hasResolved) {
        if (stderr && stderr.includes('[WARNING]')) {
          console.log(`⚠️ ${file} compiled with warnings`);
        }
        resolveOnce();
      }
    });
    
    // Capturer stdout et stderr en temps réel
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        capturedStdout += data.toString();
      });
    }
    
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        capturedStderr += data.toString();
      });
    }
  });
}

module.exports = { buildImbaFile };