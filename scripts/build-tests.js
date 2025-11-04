import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';

const testDir = 'test';
const outDir = 'test.local';

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
  
  const source = readFileSync(inputPath, 'utf8');
  const lines = source.split('\n');
  const output = [];
  const indentStack = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalLine = line;
    
    // Mesure l'indentation (tabs ou espaces)
    const indentMatch = line.match(/^(\t+| +)/);
    const currentIndent = indentMatch ? indentMatch[0].length : 0;
    
    // Ferme les blocs si l'indentation diminue
    while (indentStack.length > 0 && indentStack[indentStack.length - 1] >= currentIndent) {
      const prevIndent = indentStack.pop();
      output.push(' '.repeat(prevIndent) + '});');
    }
    
    // Transforme describe 'text' do
    if (line.match(/describe\s+['"]([^'"]+)['"]\s+do\s*$/)) {
      line = line.replace(/describe\s+'([^']+)'\s+do\s*$/, "describe('$1', () => {");
      line = line.replace(/describe\s+"([^"]+)"\s+do\s*$/, 'describe("$1", () => {');
      indentStack.push(currentIndent);
    }
    // Transforme test 'text' do
    else if (line.match(/test\s+['"]([^'"]+)['"]\s+do\s*$/)) {
      line = line.replace(/test\s+'([^']+)'\s+do\s*$/, "test('$1', () => {");
      line = line.replace(/test\s+"([^"]+)"\s+do\s*$/, 'test("$1", () => {');
      indentStack.push(currentIndent);
    }
    // Nettoie les ! des assertions
    else {
      line = line.replace(/\.toBeDefined!/g, '.toBeDefined()');
      line = line.replace(/\.toBeArray!/g, '.toBeArray()');
    }
    
    // Ajoute la ligne transformée
    if (line.trim()) {
      output.push(line);
    } else if (originalLine.trim() === '') {
      output.push(''); // Garde les lignes vides
    }
  }
  
  // Ferme tous les blocs restants
  while (indentStack.length > 0) {
    const indent = indentStack.pop();
    output.push(' '.repeat(indent) + '});');
  }
  
  const transpiled = output.join('\n');
  
  ensureDir(outputPath);
  writeFileSync(outputPath, transpiled, 'utf8');
  console.log(`  ✓ Written to: ${outputPath}`);
}

// Compile tous les fichiers
try {
  const imbaFiles = findImbaFiles(testDir);
  
  if (imbaFiles.length === 0) {
    console.log('No test files found matching *.test.imba');
    process.exit(0);
  }
  
  console.log(`Found ${imbaFiles.length} test file(s)\n`);
  
  for (const file of imbaFiles) {
    const relativePath = relative(testDir, file);
    const outFile = join(outDir, relativePath).replace('.imba', '.js');
    
    try {
      transpileImba(file, outFile);
    } catch (error) {
      console.error(`Failed to transpile ${file}:`, error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
  
  console.log('\n✓ All tests transpiled successfully');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}