import fs from 'fs'
import path from 'path'

/**
 * Read a JSON file
 */
export function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Unable to read ${filePath}:`, error.message);
    return {};
  }
}

/**
 * Write a JSON file with formatting
 */
export function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}