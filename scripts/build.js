const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const files = [
  'src/background.imba',
  'src/content.imba', 
  'src/popup.imba',
  'src/options.imba'
];

const isWatchMode = process.argv.includes('--watch') || process.argv.includes('-w');
const isDev = process.argv.includes('--dev') || process.argv.includes('-d');

// Créer le dossier dist vierge
if (fs.existsSync('dist')) fs.rmdirSync('dist', { recursive: true });
fs.mkdirSync('dist', { recursive: true });

function generateTempDir() {
  return `temp/${crypto.randomBytes(8).toString('hex')}`;
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
  
  // Chercher n'importe quel fichier .mjs ou .js
  const files = fs.readdirSync(tempDir);
  const moduleFiles = files.filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  
  if (moduleFiles.length > 0) {
    return path.join(tempDir, moduleFiles[0]);
  }
  
  return null;
}

function buildFile(file) {
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

function buildAll() {
  console.log('🚀 Starting Imba compilation...\n');
  
  // Nettoyer les anciens fichiers JS dans dist
  if (fs.existsSync('dist')) {
    const distFiles = fs.readdirSync('dist').filter(f => f.endsWith('.js'));
    distFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join('dist', file));
      } catch (e) {
        console.warn(`⚠️  Could not remove ${file}`);
      }
    });
  }
  
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
  
  console.log('\n👁️  Watching for changes... (Press Ctrl+C to stop)');
  
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    files.forEach(file => fs.unwatchFile(file));
    process.exit();
  });
}

// Exécution
if (isWatchMode) {
  startWatchMode();
} else {
  buildAll();
}