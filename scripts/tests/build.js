import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, watch } from 'fs';
import { join, dirname, relative } from 'path';
import { spawn } from 'child_process';
import { compile } from 'imba/compiler';

const testDir = 'test';
const outDir = 'test.local';
const watchMode = process.argv.includes('--watch');

// Trouve tous les fichiers .imba
function findImbaFiles(dir, base = dir) {
  const files = [];
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findImbaFiles(fullPath, base));
    } else if (item.endsWith('.test.imba')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Crée les répertoires nécessaires
function ensureDir(filePath) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
}

// Transpile un fichier Imba en JS
function transpileImba(inputPath, outputPath) {
  console.log(`Transpiling: ${inputPath}`);
  
  try {
    const source = readFileSync(inputPath, 'utf8');
    
    // Utilise le compilateur Imba
    const result = compile(source, {
      filename: inputPath,
      sourcePath: inputPath,
      format: 'esm',
      platform: 'node',
      sourcemap: false,
      imbaPath: 'imba'
    });
    
    // Récupère le code JavaScript généré
    const jsCode = result.js || result.toString();
    
    ensureDir(outputPath);
    writeFileSync(outputPath, jsCode, 'utf8');
    console.log(`  ✓ Written to: ${outputPath}`);
    
    return true;
  } catch (error) {
    console.error(`  ✗ Error transpiling ${inputPath}:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

// Compile tous les fichiers
function buildAll() {
  const imbaFiles = findImbaFiles(testDir);
  
  if (imbaFiles.length === 0) {
    console.log('No test files found matching *.test.imba');
    return false;
  }
  
  console.log(`Found ${imbaFiles.length} test file(s)\n`);
  
  let allSuccess = true;
  
  for (const file of imbaFiles) {
    const relativePath = relative(testDir, file);
    const outFile = join(outDir, relativePath).replace('.imba', '.js');
    
    const success = transpileImba(file, outFile);
    if (!success) {
      allSuccess = false;
    }
  }
  
  if (allSuccess) {
    console.log('\n✓ All tests transpiled successfully');
  } else {
    console.log('\n✗ Some tests failed to transpile');
  }
  
  return allSuccess;
}

// Mode watch
if (watchMode) {
  let isBuilding = false;
  let buildQueued = false;
  let debounceTimer = null;
  
  console.log('👀 Watching test files for changes...\n');
  
  // Fonction pour builder et lancer les tests
  function buildAndTest() {
    if (isBuilding) {
      buildQueued = true;
      return;
    }
    
    isBuilding = true;
    console.log('🔄 Rebuilding tests...');
    
    // Build
    const success = buildAll();
    
    if (success) {
      console.log('✅ Build successful, running tests...\n');
      
      // Run tests
      const test = spawn('bun', ['test', 'test.local'], {
        stdio: 'inherit',
        shell: true
      });
      
      test.on('close', () => {
        console.log('\n👀 Watching for changes...\n');
        isBuilding = false;
        
        if (buildQueued) {
          buildQueued = false;
          buildAndTest();
        }
      });
    } else {
      console.error('❌ Build failed\n');
      console.log('👀 Watching for changes...\n');
      isBuilding = false;
      
      if (buildQueued) {
        buildQueued = false;
        buildAndTest();
      }
    }
  }
  
  // Lance une première fois
  buildAndTest();
  
  // Watch le dossier test/ avec debouncing
  watch(testDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.imba')) {
      clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(() => {
        console.log(`📝 Changed: ${filename}`);
        buildAndTest();
      }, 100);
    }
  });
  
  // Empêche le script de se terminer
  process.stdin.resume();
  
} else {
  // Mode build simple
  try {
    const success = buildAll();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}