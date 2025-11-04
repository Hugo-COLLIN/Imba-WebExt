const fs = require('fs');
const path = require('path');

/**
 * Lit un fichier JSON
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Unable to read ${filePath}:`, error.message);
    return {};
  }
}

/**
 * Écrit un fichier JSON avec formatage
 */
function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readJsonFile, writeJsonFile };