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

/**
 * Compile un fichier .imba ou .html
 */
function buildFile(file, config) {
  return new Promise((resolve) => {
    const ext = path.extname(file);
    const fileName = path.basename(file, ext);
    const tempDir = generateTempDir();
    const isHtml = ext === '.html';
    
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
    let hasDisplayedError = false;
    
    const displayErrorOnce = () => {
      if (hasDisplayedError || !capturedStderr) return;
      hasDisplayedError = true;
      
      console.log('\n❌ STDERR from Imba compiler:');
      console.log('─'.repeat(60));
      console.log(capturedStderr);
      console.log('─'.repeat(60));
    };
    
    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;
      
      try {
        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist', { recursive: true });
        }
        
        let filesFound = { html: false, js: false };
        
        if (isHtml) {
          // Logique spécifique aux fichiers HTML
          const outputHtmlFile = path.join('dist', `${fileName}.html`);
          const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
          
          if (fs.existsSync(tempHtmlFile)) {
            fs.copyFileSync(tempHtmlFile, outputHtmlFile);
            fixBackslashesInHtml(outputHtmlFile);
            console.log(`✅ ${file} → ${outputHtmlFile}`);
            filesFound.html = true;
          }
          
          // Copier assets si existants
          const assetsDir = path.join(tempDir, 'assets');
          if (fs.existsSync(assetsDir)) {
            const distAssetsDir = path.join('dist', 'assets');
            copyAssetsRecursively(assetsDir, distAssetsDir);
            const assetFiles = fs.readdirSync(assetsDir);
            assetFiles.forEach(asset => {
              console.log(`✅ Asset: ${asset} → dist/assets/${asset}`);
            });
          }
          
          // Copier fichier JS principal hors assets
          const generatedJsFile = findGeneratedFile(tempDir, fileName);
          if (generatedJsFile && !generatedJsFile.includes('assets')) {
            const outputJsFile = path.join('dist', `${fileName}.js`);
            fs.copyFileSync(generatedJsFile, outputJsFile);
            console.log(`✅ JS: ${fileName}.js → ${outputJsFile}`);
            filesFound.js = true;
          }
          
          // Gestion des avertissements pour HTML
          if (!filesFound.html) {
            console.log(`⚠️ No HTML output file found for ${file}`);
          }
          
          if (!filesFound.html || !filesFound.js) {
            displayErrorOnce();
          }
          
        } else {
          // Logique spécifique aux fichiers .imba
          const outputFile = path.join('dist', `${fileName}.js`);
          const generatedFile = findGeneratedFile(tempDir, fileName);
          
          if (generatedFile) {
            fs.copyFileSync(generatedFile, outputFile);
            console.log(`✅ ${file} → ${outputFile}`);
            filesFound.js = true;
          } else {
            console.log(`⚠️ No output file found for ${file}`);
            displayErrorOnce();
            
            // Debug pour fichiers .imba
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
        }
        
      } catch (error) {
        console.log(`⚠️ Warning processing ${file}: ${error.message}`);
        displayErrorOnce();
      } finally {
        // Tuer le processus s'il est encore en cours
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
        }
        cleanupTempDir(tempDir);
        resolve();
      }
    };
    
    // Fonction de vérification adaptée au type de fichier
    const checkForCompletion = () => {
      if (hasResolved) return false;
      
      if (isHtml) {
        const htmlFile = path.join(tempDir, `${fileName}.html`);
        const assetsDir = path.join(tempDir, 'assets');
        
        const htmlExists = fs.existsSync(htmlFile);
        if (htmlExists) {
          if (fs.existsSync(assetsDir)) {
            try {
              const assetFiles = fs.readdirSync(assetsDir);
              const hasAssets = assetFiles.some(file =>
                file.endsWith('.js') || file.endsWith('.css')
              );
              if (hasAssets) {
                return true;
              }
            } catch (e) {
              // Ignore error reading assets
            }
          } else {
            return true;
          }
        }
      } else {
        // Pour les fichiers .imba
        const expectedExtensions = ['.mjs', '.js'];
        for (const ext of expectedExtensions) {
          const expectedFile = path.join(tempDir, `${fileName}${ext}`);
          if (fs.existsSync(expectedFile)) {
            return true;
          }
        }
      }
      return false;
    };
    
    // Surveillance adaptée
    const checkInterval = setInterval(() => {
      if (checkForCompletion()) {
        clearInterval(checkInterval);
        setTimeout(resolveOnce, isHtml ? 500 : 200);
      }
    }, isHtml ? 200 : 100);
    
    // Timeout adapté
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!hasResolved) {
        console.log(`⏰ Timeout for ${file} (fallback)`);
        resolveOnce();
      }
    }, isHtml ? 20000 : 15000);
    
    // Lancement de la compilation
    childProcess = exec(command, {
      maxBuffer: 1024 * 1024 * 10
    }, (error, stdout, stderr) => {
      clearTimeout(timeout);
      clearInterval(checkInterval);
      capturedStdout = stdout || '';
      capturedStderr = stderr || '';
      
      if (error) {
        console.log(`\n❌ Compilation error for ${file}:`);
        console.log(`   Exit code: ${error.code}`);
        console.log(`   Signal: ${error.signal}`);
      }
      
      if (!hasResolved) {
        if (stderr && stderr.includes('[WARNING]')) {
          console.log(`⚠️ ${file} compiled with warnings`);
        }
        setTimeout(() => {
          if (!hasResolved) {
            resolveOnce();
          }
        }, 300);
      }
    });
    
    // Capture des sorties
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

// Fonctions de compatibilité pour maintenir l'API existante
function buildImbaFile(file, config) {
  return buildFile(file, config);
}

function buildHtmlFile(file, config) {
  return buildFile(file, config);
}

module.exports = { buildFile, buildImbaFile, buildHtmlFile };