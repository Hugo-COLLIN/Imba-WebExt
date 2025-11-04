const path = require('path');

/**
 * Convertit les chemins sources vers les chemins de sortie réels
 */
function convertSourcePathToOutput(sourcePath) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    return sourcePath;
  }

  // Convertir les chemins relatifs src/ vers les chemins de sortie
  if (sourcePath.startsWith('src/')) {
    const relativePath = sourcePath.substring(4); // Enlever 'src/'
    
    if (sourcePath.endsWith('.imba')) {
      // Les fichiers .imba deviennent .js à la racine de dist/
      const fileName = path.basename(relativePath, '.imba');
      return `${fileName}.js`;
    } else if (sourcePath.endsWith('.html')) {
      // Les fichiers HTML vont à la racine de dist/ avec juste le nom de fichier
      const fileName = path.basename(relativePath);
      return fileName;
    }
  }

  // Pour les fichiers .imba sans préfixe src/
  if (sourcePath.endsWith('.imba')) {
    const fileName = path.basename(sourcePath, '.imba');
    return `${fileName}.js`;
  }

  return sourcePath;
}

module.exports = { convertSourcePathToOutput };