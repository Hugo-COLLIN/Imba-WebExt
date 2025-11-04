const fs = require('fs');
const archiver = require('archiver');
const { parseArguments } = require('./utils/args');

(async () => {
  try {
    // Parse les arguments de la ligne de commande
    const config = parseArguments(process.argv);
    
    // Lire le package.json
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    
    // Créer le nom de l'archive
    const archiveName = `${pkg.name}_${pkg.version}_${config.targetBrowser}.zip`;

    // S'assurer que les dossiers releases et dist existent
    if (!fs.existsSync('releases')) fs.mkdirSync('releases');
    if (!fs.existsSync('dist')) throw new Error('dist folder not found');

    console.log(`📦 Creating archive for ${config.targetBrowser}...`);

    // Créer l'archive
    const output = fs.createWriteStream(`releases/${archiveName}`);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory('dist/', false);
    await archive.finalize();

    // Afficher la taille du fichier
    const stats = fs.statSync(`releases/${archiveName}`);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Created ${archiveName} (${sizeMB} MB)`);
    
  } catch (err) {
    console.error('❌ Error creating archive:', err.message);
    process.exit(1);
  }
})();
