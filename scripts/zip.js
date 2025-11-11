import fs from 'fs'
import archiver from 'archiver'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Create a zip of the dist/ folder
 */
async function createZip() {
  try {
    // Parse arguments
    const args = process.argv.slice(2)
    const browserArg = args.find(arg => arg.startsWith('--browser='))
    const browser = browserArg ? browserArg.split('=')[1] : 'chrome'
    
    // Read package.json
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    
    // Create archive name
    const archiveName = `${pkg.name}_${pkg.version}_${browser}.zip`
    const releasesDir = join(__dirname, '..', 'releases')
    const distDir = join(__dirname, '..', 'dist')
    
    // Ensure the folders exist
    if (!fs.existsSync(releasesDir)) {
      fs.mkdirSync(releasesDir, { recursive: true })
    }
    
    if (!fs.existsSync(distDir)) {
      throw new Error('dist folder not found. Run build first.')
    }
    
    console.log(`📦 Creating archive for ${browser}...`)
    
    // Create archive
    const outputPath = join(releasesDir, archiveName)
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    // Promise the 'close' event
    await new Promise((resolve, reject) => {
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('error', reject)
      
      archive.pipe(output)
      archive.directory(distDir, false)
      archive.finalize()
    })
    
    // Display file size
    const stats = fs.statSync(outputPath)
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    console.log(`✅ Created ${archiveName} (${sizeMB} MB)`)
    
  } catch (err) {
    console.error('❌ Error creating archive:', err.message)
    process.exit(1)
  }
}

createZip()