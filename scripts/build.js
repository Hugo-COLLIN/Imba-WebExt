const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const files = [
  'src/background.imba',
  'src/content.imba', 
  'src/popup/popup.html',
  'src/options/options.html'
];

const isWatchMode = process.argv.includes('--watch') || process.argv.includes('-w');
const isDev = process.argv.includes('--dev') || process.argv.includes('-d');

// Créer le dossier dist vierge
if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });

// Créer le dossier temp s'il n'existe pas
if (!fs.existsSync('temp.local')) fs.mkdirSync('temp.local', { recursive: true });

function generateTempDir() {
  return `temp.local/${crypto.randomBytes(8).toString('hex')}`;
}

function findGeneratedFile(tempDir, expectedName) {
  if (!fs.existsSync(tempDir)) return null;
  
  // Chercher d'abord le fichier .mjs (format ESM)
  const mjsFile = path.join(tempDir, `${expectedName}.mjs`);
  if (fs.existsSync(mjsFile)) {
    return mjsFile;
  }
  
  // Puis chercher le fichier .js
  const jsFile = path.join(tempDir, `${expectedName}.js`);
  if (fs.existsSync(jsFile)) {
    return jsFile;
  }
  
  // Chercher dans le dossier assets
  const assetsDir = path.join(tempDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsFiles = assetFiles.filter(f => f.includes(expectedName) && f.endsWith('.js'));
    if (jsFiles.length > 0) {
      return path.join(assetsDir, jsFiles[0]);
    }
  }
  
  // Chercher n'importe quel fichier .mjs ou .js
  const files = fs.readdirSync(tempDir);
  const moduleFiles = files.filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  
  if (moduleFiles.length > 0) {
    return path.join(tempDir, moduleFiles[0]);
  }
  
  return null;
}

function copyAssetsRecursively(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const items = fs.readdirSync(srcDir);
  
  items.forEach(item => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyAssetsRecursively(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function buildImbaFile(file) {
  const fileName = path.basename(file, '.imba');
  const tempDir = generateTempDir();
  const outputFile = path.join('dist', `${fileName}.js`);
  
  try {
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (isDev) {
      buildOptions += ' -d';
    }
    
    // Compiler dans le dossier temporaire unique
    const command = `npx imba build ${buildOptions} -o ${tempDir} ${file}`;
    execSync(command, { stdio: 'pipe' });
    
    // Trouver le fichier généré (.mjs ou .js)
    const generatedFile = findGeneratedFile(tempDir, fileName);
    
    if (generatedFile) {
      // Copier le fichier en le renommant en .js
      fs.copyFileSync(generatedFile, outputFile);
      console.log(`✅ ${file} → ${outputFile}`);
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
    
    if (!isWatchMode) {
      process.exit(1);
    }
  } finally {
    // Nettoyer le dossier temporaire
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`⚠️  Could not clean temp dir ${tempDir}`);
      }
    }
  }
}

function buildHtmlFile(file) {
  const fileName = path.basename(file, '.html');
  const tempDir = generateTempDir();
  const outputHtmlFile = path.join('dist', `${fileName}.html`);
  
  try {
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (isDev) {
      buildOptions += ' -d';
    }
    
    // Compiler le fichier HTML avec Imba
    const command = `npx imba build ${buildOptions} -o ${tempDir} ${file}`;
    execSync(command, { stdio: 'pipe' });
    
    // Copier le fichier HTML
    const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
    if (fs.existsSync(tempHtmlFile)) {
      fs.copyFileSync(tempHtmlFile, outputHtmlFile);
      console.log(`✅ ${file} → ${outputHtmlFile}`);
    }
    
    // Copier les assets (CSS, JS) générés
    const assetsDir = path.join(tempDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const distAssetsDir = path.join('dist', 'assets');
      copyAssetsRecursively(assetsDir, distAssetsDir);
      
      const assetFiles = fs.readdirSync(assetsDir);
      assetFiles.forEach(asset => {
        console.log(`✅ Asset: ${asset} → dist/assets/${asset}`);
      });
    }
    
    // Chercher et copier le fichier JS principal s'il existe
    const generatedJsFile = findGeneratedFile(tempDir, fileName);
    if (generatedJsFile && !generatedJsFile.includes('assets')) {
      const outputJsFile = path.join('dist', `${fileName}.js`);
      fs.copyFileSync(generatedJsFile, outputJsFile);
      console.log(`✅ JS: ${fileName}.js → ${outputJsFile}`);
    }
    
  } catch (error) {
    console.error(`❌ Error building ${file}:`);
    console.error(`   ${error.message}`);
    
    // Debug: lister le contenu du dossier temp
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir);
      console.error(`   Temp dir contents: ${tempFiles.join(', ')}`);
      
      // Lister aussi le contenu des sous-dossiers
      tempFiles.forEach(item => {
        const itemPath = path.join(tempDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          const subFiles = fs.readdirSync(itemPath);
          console.error(`   ${item}/ contents: ${subFiles.join(', ')}`);
        }
      });
    }
    
    if (!isWatchMode) {
      process.exit(1);
    }
  } finally {
    // Nettoyer le dossier temporaire
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`⚠️  Could not clean temp dir ${tempDir}`);
      }
    }
  }
}

function buildFile(file) {
  const ext = path.extname(file);
  
  if (ext === '.imba') {
    buildImbaFile(file);
  } else if (ext === '.html') {
    buildHtmlFile(file);
  } else {
    console.warn(`⚠️  Unsupported file type: ${file}`);
  }
}

function buildAll() {
  console.log('🚀 Starting Imba compilation...\n');
  
  // Compiler tous les fichiers séquentiellement
  for (const file of files) {
    if (fs.existsSync(file)) {
      buildFile(file);
    } else {
      console.warn(`⚠️  File not found: ${file}`);
    }
  }
  
  console.log('\n🎉 All files compiled successfully!');
}

function startWatchMode() {
  console.log('👀 Starting watch mode...\n');
  
  buildAll();
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file}...`);
      fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`\n🔄 File changed: ${file}`);
          buildFile(file);
        }
      });
    }
  });
  
  // Surveiller aussi les fichiers .imba référencés par les HTML
  const imbaFilesToWatch = [
    'src/options/options.imba', // Si options.html référence options.imba
    'src/popup/popup.imba'      // Si popup.html référence popup.imba
  ];
  
  imbaFilesToWatch.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`🔍 Watching ${file} (referenced by HTML)...`);
      fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`\n🔄 Imba file changed: ${file}`);
          // Recompiler le fichier HTML correspondant
          const htmlFile = file.replace('.imba', '.html');
          if (files.includes(htmlFile)) {
            buildFile(htmlFile);
          }
        }
      });
    }
  });
  
  console.log('\n👁️  Watching for changes... (Press Ctrl+C to stop)');
  
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    files.forEach(file => fs.unwatchFile(file));
    imbaFilesToWatch.forEach(file => fs.unwatchFile(file));
    process.exit();
  });
}

// Exécution
if (isWatchMode) {
  startWatchMode();
} else {
  buildAll();
}