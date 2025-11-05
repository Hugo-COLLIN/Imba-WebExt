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

    let hasResolved = false;
    let childProcess = null;
    let capturedStdout = '';
    let capturedStderr = '';

    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;

      try {
        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist', { recursive: true });
        }

        // Copier fichier HTML
        const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
        if (fs.existsSync(tempHtmlFile)) {
          fs.copyFileSync(tempHtmlFile, outputHtmlFile);
          fixBackslashesInHtml(outputHtmlFile);
          console.log(`✅ ${file} → ${outputHtmlFile}`);
        } else {
          console.log(`⚠️ No HTML output file found for ${file}`);

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

          // Afficher contenu dossier temporaire
          console.log(`\n📂 Contents of temp directory (${tempDir}):`);
          try {
            const files = fs.readdirSync(tempDir, { withFileTypes: true });
            if (files.length === 0) {
              console.log('  (empty directory)');
            } else {
              files.forEach(file => {
                console.log(`  - ${file.name}`);
              });
            }
          } catch (e) {
            console.log(`  Error reading directory: ${e.message}`);
          }
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
        } else {
          console.log(`⚠️ No JS output file found for ${file}`);

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
        }

      } catch (error) {
        console.log(`⚠️ Warning processing ${file}: ${error.message}`);

        if (capturedStderr) {
          console.log('\n❌ STDERR:');
          console.log(capturedStderr);
        }
        if (capturedStdout) {
          console.log('\n📝 STDOUT:');
          console.log(capturedStdout);
        }
      } finally {
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
        }
        cleanupTempDir(tempDir);
        resolve();
      }
    };

    const checkForCompletion = () => {
      if (hasResolved) return false;

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
      return false;
    };

    const checkInterval = setInterval(() => {
      if (checkForCompletion()) {
        clearInterval(checkInterval);
        setTimeout(resolveOnce, 500);
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!hasResolved) {
        console.log(`⏰ Timeout for ${file} (fallback)`);
        resolveOnce();
      }
    }, 20000); // 20s timeout

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

module.exports = { buildHtmlFile };
