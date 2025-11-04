const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  generateTempDir, 
  findGeneratedFile, 
  cleanupTempDir 
} = require('../utils/fs');

/**
 * Compile un fichier .imba
 */
function buildImbaFile(file, config) {
  const fileName = path.basename(file, '.imba');
  const tempDir = generateTempDir();
  const outputFile = path.join('dist', `${fileName}.js`);
  
  try {
    console.log(`📦 Building ${file}...`);
    
    let buildOptions = '--esm -M --base .';
    if (config.isDev) {
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
    
    if (!config.isWatchMode) {
      process.exit(1);
    }
  } finally {
    cleanupTempDir(tempDir);
  }
}

module.exports = { buildImbaFile };