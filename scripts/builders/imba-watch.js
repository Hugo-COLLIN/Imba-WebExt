const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  generateTempDir, 
  findGeneratedFile, 
  cleanupTempDir 
} = require('../utils/fs');

class ImbaWatcher {
  constructor() {
    this.watchers = new Map();
    this.tempDirs = new Map();
    this.initialBuildComplete = new Map();
  }

  /**
   * Démarre un watcher Imba pour un fichier spécifique
   */
  startWatching(file, config) {
    return new Promise((resolve) => {
      const fileName = path.basename(file, path.extname(file));
      const tempDir = generateTempDir();
      this.tempDirs.set(file, tempDir);
      this.initialBuildComplete.set(file, false);
      
      let buildOptions = '--esm -M --base . --watch';
      if (config.isDev) {
        buildOptions += ' -d';
      }
      
      console.log(`🎯 Starting Imba watcher for ${file}...`);
      
      const watcher = spawn('npx', [
        'imba', 'build', 
        ...buildOptions.split(' ').filter(opt => opt),
        '-o', tempDir,
        file
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      // Gérer la sortie du processus
      watcher.stdout.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('built') || output.includes('compiled')) {
          this.handleFileChange(file, config);
          
          // Résoudre la promesse après le premier build
          if (!this.initialBuildComplete.get(file)) {
            this.initialBuildComplete.set(file, true);
            console.log(`✅ Initial build completed for ${file}`);
            resolve();
          }
        }
      });

      watcher.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('[WARNING]')) {
          console.error(`❌ Imba watcher error for ${file}:`, error);
        }
      });

      watcher.on('close', (code) => {
        console.log(`🛑 Imba watcher for ${file} stopped (code: ${code})`);
      });

      watcher.on('error', (error) => {
        console.error(`❌ Failed to start watcher for ${file}:`, error);
        resolve(); // Résoudre même en cas d'erreur pour ne pas bloquer
      });

      this.watchers.set(file, watcher);
      
      // Timeout de sécurité pour le build initial
      setTimeout(() => {
        if (!this.initialBuildComplete.get(file)) {
          console.log(`⏰ Initial build timeout for ${file}, continuing...`);
          this.initialBuildComplete.set(file, true);
          resolve();
        }
      }, 10000); // 10 secondes max pour le build initial
    });
  }

  /**
   * Gère les changements détectés par Imba
   */
  async handleFileChange(file, config) {
    const fileName = path.basename(file, path.extname(file));
    const tempDir = this.tempDirs.get(file);
    const ext = path.extname(file);
    
    try {
      if (ext === '.imba') {
        await this.copyImbaOutput(file, fileName, tempDir);
      } else if (ext === '.html') {
        await this.copyHtmlOutput(file, fileName, tempDir);
      }
      
      // Ne pas afficher le message pour le build initial
      if (this.initialBuildComplete.get(file)) {
        console.log(`✅ ${file} recompiled and copied`);
      }
    } catch (error) {
      console.error(`❌ Error handling change for ${file}:`, error.message);
    }
  }

  /**
   * Copie la sortie d'un fichier Imba
   */
  async copyImbaOutput(file, fileName, tempDir) {
    const outputFile = path.join('dist', `${fileName}.js`);
    const generatedFile = findGeneratedFile(tempDir, fileName);
    
    if (generatedFile && fs.existsSync(generatedFile)) {
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true });
      }
      fs.copyFileSync(generatedFile, outputFile);
    }
  }

  /**
   * Copie la sortie d'un fichier HTML
   */
  async copyHtmlOutput(file, fileName, tempDir) {
    const { copyAssetsRecursively, fixBackslashesInHtml } = require('../utils/fs');
    
    // Copier le fichier HTML
    const tempHtmlFile = path.join(tempDir, `${fileName}.html`);
    const outputHtmlFile = path.join('dist', `${fileName}.html`);
    
    if (fs.existsSync(tempHtmlFile)) {
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true });
      }
      fs.copyFileSync(tempHtmlFile, outputHtmlFile);
      fixBackslashesInHtml(outputHtmlFile);
    }
    
    // Copier les assets
    const assetsDir = path.join(tempDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const distAssetsDir = path.join('dist', 'assets');
      copyAssetsRecursively(assetsDir, distAssetsDir);
    }
    
    // Copier le JS principal
    const generatedJsFile = findGeneratedFile(tempDir, fileName);
    if (generatedJsFile && !generatedJsFile.includes('assets')) {
      const outputJsFile = path.join('dist', `${fileName}.js`);
      fs.copyFileSync(generatedJsFile, outputJsFile);
    }
  }

  /**
   * Arrête tous les watchers
   */
  stopAll() {
    this.watchers.forEach((watcher, file) => {
      watcher.kill('SIGTERM');
      const tempDir = this.tempDirs.get(file);
      if (tempDir) {
        cleanupTempDir(tempDir);
      }
    });
    this.watchers.clear();
    this.tempDirs.clear();
    this.initialBuildComplete.clear();
  }
}

module.exports = { ImbaWatcher };