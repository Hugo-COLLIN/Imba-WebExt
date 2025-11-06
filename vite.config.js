import { defineConfig } from 'vite'
import { imba } from 'vite-plugin-imba'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import du générateur de manifest existant (en CommonJS)
async function generateManifestWrapper(browser) {
  // Utiliser import dynamique pour charger le module CommonJS
  const { generateManifest } = await import('./scripts/manifest/generator.js')
  generateManifest(browser)
}

// Plugin custom pour gérer le manifest et les assets
function webExtensionPlugin(browser) {
  return {
    name: 'web-extension-plugin',
    
    // Générer le manifest après le build
    async writeBundle() {
      // Utiliser le générateur existant
      await generateManifestWrapper(browser)
      
      // Copier les assets
      const assetsSource = resolve(__dirname, 'src/assets')
      const assetsDest = resolve(__dirname, 'dist/assets')
      
      if (fs.existsSync(assetsSource)) {
        copyRecursive(assetsSource, assetsDest)
        console.log('✅ Assets copied')
      }
      
      // Réorganiser la structure de sortie
      reorganizeDistFolder()
      
      console.log('✅ Build completed for', browser)
    },
    
    // Gérer le mode dev
    async configureServer(server) {
      // Générer le manifest initial en mode dev
      await generateManifestWrapper(browser)
      
      // Copier les assets en mode dev
      const assetsSource = resolve(__dirname, 'src/assets')
      const assetsDest = resolve(__dirname, 'dist/assets')
      
      if (fs.existsSync(assetsSource)) {
        copyRecursive(assetsSource, assetsDest)
      }
      
      // Watcher pour le manifest
      const manifestPath = resolve(__dirname, 'src/manifest.json')
      
      server.watcher.add(manifestPath)
      server.watcher.on('change', async (file) => {
        if (file === manifestPath) {
          await generateManifestWrapper(browser)
          console.log('✅ Manifest updated for', browser)
        }
      })
    }
  }
}

// Fonction pour réorganiser le dossier dist
function reorganizeDistFolder() {
  const distPath = resolve(__dirname, 'dist')
  
  // 1. Déplacer popup.html et options.html à la racine
  const popupHtmlSrc = resolve(distPath, 'src/popup/popup.html')
  const popupHtmlDest = resolve(distPath, 'popup.html')
  if (fs.existsSync(popupHtmlSrc)) {
    fs.renameSync(popupHtmlSrc, popupHtmlDest)
  }
  
  const optionsHtmlSrc = resolve(distPath, 'src/options/options.html')
  const optionsHtmlDest = resolve(distPath, 'options.html')
  if (fs.existsSync(optionsHtmlSrc)) {
    fs.renameSync(optionsHtmlSrc, optionsHtmlDest)
  }
  
  // 2. Nettoyer le dossier src/
  const srcDir = resolve(distPath, 'src')
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true })
  }
  
  // 3. Déplacer CSS et JS vers assets/
  const assetsDir = resolve(distPath, 'assets')
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }
  
  moveFileToAssets(distPath, 'popup.css')
  moveFileToAssets(distPath, 'popup.js')
  moveFileToAssets(distPath, 'options.css')
  moveFileToAssets(distPath, 'options.js')
  
  console.log('✅ Dist folder reorganized')
}

// Fonction pour déplacer un fichier vers assets/
function moveFileToAssets(distPath, filename) {
  const src = resolve(distPath, filename)
  const dest = resolve(distPath, 'assets', filename)
  
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest)
  }
}

// Fonction pour copier récursivement
function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name)
    const destPath = resolve(dest, entry.name)
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'
  const browser = process.env.BROWSER || 'chrome'
  
  console.log(`\n🚀 Building for ${browser} in ${isDev ? 'development' : 'production'} mode\n`)
  
  return {
    plugins: [
      imba(),
      webExtensionPlugin(browser)
    ],
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev ? 'inline' : false,
      minify: isDev ? false : 'esbuild',
      
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.imba'),
          content: resolve(__dirname, 'src/content.imba'),
          popup: resolve(__dirname, 'src/popup/popup.html'),
          options: resolve(__dirname, 'src/options/options.html')
        },
        output: {
          entryFileNames: (chunkInfo) => {
            // Scripts à la racine
            return '[name].js'
          },
          chunkFileNames: 'chunks/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || ''
            
            // HTML, CSS et JS à la racine (seront déplacés après)
            if (name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.js')) {
              return '[name][extname]'
            }
            
            // Autres assets dans assets/
            return 'assets/[name][extname]'
          }
        }
      }
    },
    
    resolve: {
      extensions: ['.imba', '.js', '.json']
    },
    
    optimizeDeps: {
      include: ['webextension-polyfill', 'turndown']
    },
    
    server: {
      port: 3000,
      strictPort: false
    }
  }
})