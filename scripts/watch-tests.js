import { watch } from 'fs';
import { spawn } from 'child_process';

const testDir = 'test';
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
  const build = spawn('bun', ['run', 'scripts/build-tests.js'], {
    stdio: 'inherit',
    shell: true
  });
  
  build.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build successful, running tests...\n');
      
      // Run tests
      const test = spawn('bun', ['test', 'test.local'], {
        stdio: 'inherit',
        shell: true
      });
      
      test.on('close', () => {
        console.log('\n👀 Watching for changes...\n');
        isBuilding = false;
        
        // Si un build était en attente, le lancer
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
  });
}

// Lance une première fois
buildAndTest();

// Watch le dossier test/ avec debouncing
watch(testDir, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.imba')) {
    // Annule le timer précédent
    clearTimeout(debounceTimer);
    
    // Attend 100ms avant de rebuild (pour regrouper les événements multiples)
    debounceTimer = setTimeout(() => {
      console.log(`📝 Changed: ${filename}`);
      buildAndTest();
    }, 100);
  }
});

// Empêche le script de se terminer
process.stdin.resume();