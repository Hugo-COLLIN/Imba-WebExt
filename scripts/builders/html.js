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
    
    const command = `npx imba build ${buildOptions} -o "${tempDir}" "${file}"`;
    
    let hasResolved = false;
    let childProcess = null;
    
    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;
      
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
        // Tuer le processus s'il est encore en cours
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
        }
        cleanupTempDir(tempDir);
        resolve();
      }
    };
    
    // Surveiller la création des fichiers HTML et assets
    const checkForCompletion = () => {
      if (hasResolved) return false;
      
      const htmlFile = path.join(tempDir, `${fileName}.html`);
      const assetsDir = path.join(tempDir, 'assets');
      
      // Vérifier si le fichier HTML existe
      const htmlExists = fs.existsSync(htmlFile);
      
      // Pour les fichiers HTML, on attend aussi que les assets soient générés
      // ou qu'au moins le fichier HTML soit présent
      if (htmlExists) {
        // Si le dossier assets existe, attendre qu'il contienne des fichiers
        if (fs.existsSync(assetsDir)) {
          try {
            const assetFiles = fs.readdirSync(assetsDir);
            // Attendre qu'il y ait au moins un fichier JS ou CSS
            const hasAssets = assetFiles.some(file => 
              file.endsWith('.js') || file.endsWith('.css')
            );
            
            if (hasAssets) {
              return true; // Compilation terminée
            }
          } catch (error) {
            // Si on ne peut pas lire le dossier assets, continuer
          }
        } else {
          // Pas de dossier assets attendu, le HTML suffit
          return true;
        }
      }
      
      return false;
    };
    
    const checkInterval = setInterval(() => {
      if (checkForCompletion()) {
        clearInterval(checkInterval);
        // Attendre un peu pour s'assurer que tous les fichiers sont écrits
        setTimeout(resolveOnce, 500);
      }
    }, 200); // Vérifier toutes les 200ms
    
    // Timeout de sécurité (plus long pour les HTML qui prennent plus de temps)
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!hasResolved) {
        console.log(`⏰ Timeout for ${file} (fallback)`);
        resolveOnce();
      }
    }, 20000); // 20 secondes pour les HTML
    
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
        // Attendre un peu avant de traiter au cas où les fichiers seraient encore en cours d'écriture
        setTimeout(() => {
          if (!hasResolved) {
            resolveOnce();
          }
        }, 300);
      }
    });
  });
}

module.exports = { buildHtmlFile };