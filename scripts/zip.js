import fs from 'fs'
import archiver from 'archiver'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function createZip() {
  try {
    // Parse les arguments
    const args = process.argv.slice(2)
    const browserArg = args.find(arg => arg.startsWith('--browser='))
    const browser = browserArg ? browserArg.split('=')[1] : 'chrome'
    
    // Lire le package.json
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    
    // Créer le nom de l'archive
    const archiveName = `${pkg.name}_${pkg.version}_${browser}.zip`
    const releasesDir = join(__dirname, '..', 'releases')
    const distDir = join(__dirname, '..', 'dist')
    
    // S'assurer que les dossiers existent
    if (!fs.existsSync(releasesDir)) {
      fs.mkdirSync(releasesDir, { recursive: true })
    }
    
    if (!fs.existsSync(distDir)) {
      throw new Error('dist folder not found. Run build first.')
    }
    
    console.log(`📦 Creating archive for ${browser}...`)
    
    // Créer l'archive
    const outputPath = join(releasesDir, archiveName)
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    // Promisifier l'événement 'close'
    await new Promise((resolve, reject) => {
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('error', reject)
      
      archive.pipe(output)
      archive.directory(distDir, false)
      archive.finalize()
    })
    
    // Afficher la taille du fichier
    const stats = fs.statSync(outputPath)
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    console.log(`✅ Created ${archiveName} (${sizeMB} MB)`)
    
  } catch (err) {
    console.error('❌ Error creating archive:', err.message)
    process.exit(1)
  }
}

createZip()