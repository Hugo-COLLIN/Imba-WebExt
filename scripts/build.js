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

// Déterminer le navigateur cible
const targetBrowser = process.env.TARGET_BROWSER || 
  (process.argv.find(arg => arg.startsWith('--browser='))?.split('=')[1]) || 
  'chrome';

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

// === GÉNÉRATION DU MANIFEST ===
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Unable to read ${filePath}:`, error.message);
    return {};
  }
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Convertit les chemins sources (.imba) en chemins de sortie (.js)
function convertSourcePathToOutput(sourcePath) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    return sourcePath;
  }

  // Convertir les chemins relatifs src/ vers les chemins de sortie
  if (sourcePath.startsWith('src/')) {
    const relativePath = sourcePath.substring(4); // Enlever 'src/'
    
    if (sourcePath.endsWith('.imba')) {
      return relativePath.replace(/\.imba$/, '.js');
    } else if (sourcePath.endsWith('.html')) {
      return relativePath;
    }
  }

  // Pour les fichiers .imba sans préfixe src/
  if (sourcePath.endsWith('.imba')) {
    return sourcePath.replace(/\.imba$/, '.js');
  }

  return sourcePath;
}

function generateManifest(targetBrowser, version) {
  const srcManifestPath = path.join(process.cwd(), 'src', 'manifest.json');
  const distManifestPath = path.join(process.cwd(), 'dist', 'manifest.json');
  const pkgPath = path.join(process.cwd(), 'package.json');

  const srcManifest = readJsonFile(srcManifestPath);
  const pkg = readJsonFile(pkgPath);

  console.log(`📋 Generating manifest for ${targetBrowser}...`);

  // Manifest de base
  let manifest = {
    manifest_version: srcManifest[`{{${targetBrowser}}}.manifest_version`] || (targetBrowser === 'firefox' ? 2 : 3),
    name: srcManifest.name || pkg.name || 'My Extension',
    version: version || srcManifest.version || pkg.version || '1.0.0',
    description: srcManifest.description || pkg.description || 'Extension developed with Imba',
    homepage_url: srcManifest.homepage_url || pkg.homepage,
  };

  // Traitement récursif des propriétés avec la syntaxe {{browser}}
  function processObject(obj, targetObj) {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      const isBrowserSpecificKey = key.startsWith(`{{${targetBrowser}}}`);
      const isOtherBrowserKey = key.startsWith('{{') && !isBrowserSpecificKey;

      if (isOtherBrowserKey) continue;

      let manifestKey;
      if (isBrowserSpecificKey) {
        manifestKey = key.replace(`{{${targetBrowser}}}.`, '');
      } else if (!key.startsWith('{{')) {
        manifestKey = key;
      } else {
        continue;
      }

      const value = obj[key];

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        targetObj[manifestKey] = {};
        processObject(value, targetObj[manifestKey]);
      } else if (Array.isArray(value)) {
        targetObj[manifestKey] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            const processedItem = {};
            processObject(item, processedItem);
            return processedItem;
          } else if (typeof item === 'string') {
            return convertSourcePathToOutput(item);
          }
          return item;
        });
      } else if (typeof value === 'string') {
        targetObj[manifestKey] = convertSourcePathToOutput(value);
      } else {
        targetObj[manifestKey] = value;
      }
    }
  }

  processObject(srcManifest, manifest);

  // Adaptations spécifiques Firefox
  if (targetBrowser === 'firefox') {
    // Convertir service_worker en scripts pour Firefox MV2
    if (manifest.background && manifest.background.service_worker) {
      manifest.background = {
        scripts: [manifest.background.service_worker],
        persistent: false
      };
    }

    // Convertir action en browser_action
    if (manifest.action) {
      manifest.browser_action = manifest.action;
      delete manifest.action;
    }

    // Adapter options_ui
    if (manifest.options_ui && manifest.options_ui.page) {
      manifest.options_ui.open_in_tab = true;
    }
  }

  // Nettoyage des propriétés vides
  function cleanEmptyProperties(obj) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value === null || value === undefined) {
        delete obj[key];
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        cleanEmptyProperties(value);
        if (Object.keys(value).length === 0) {
          delete obj[key];
        }
      }
    });
  }

  cleanEmptyProperties(manifest);

  writeJsonFile(distManifestPath, manifest);
  console.log(`✅ Manifest generated: ${distManifestPath}`);
}

// === FONCTIONS DE BUILD ===
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
  console.log(`🚀 Starting Imba compilation for ${targetBrowser}...\n`);
  
  // Compiler tous les fichiers séquentiellement
  for (const file of files) {
    if (fs.existsSync(file)) {
      buildFile(file);
    } else {
      console.warn(`⚠️  File not found: ${file}`);
    }
  }
  
  // Générer le manifest après la compilation
  console.log('');
  generateManifest(targetBrowser);
  
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