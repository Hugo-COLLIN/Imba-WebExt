import { defineConfig } from 'vite'
import { imba } from 'vite-plugin-imba'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import du générateur de manifest existant (en CommonJS)
async function generateManifestWrapper(browser) {
  const { generateManifest } = await import('./scripts/manifest/generator.js')
  generateManifest(browser)
}

// Fonction pour convertir ESM en IIFE (version robuste)
function convertEsmToIife(filePath, filename) {
  if (!fs.existsSync(filePath)) {
    return false
  }
  
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false
  
  // Vérifier si le fichier contient des imports/exports ESM
  const hasEsmImports = /^import\s+.*?from\s+['"].*?['"];?\s*$/m.test(content)
  const hasEsmExports = /^export\s+/m.test(content)
  
  if (hasEsmImports || hasEsmExports) {
    console.log(`🔄 Converting ${filename} from ESM to IIFE...`)
    
    // 1. Supprimer les imports ESM
    content = content.replace(/^import\s+.*?from\s+['"]webextension-polyfill['"];?\s*$/gm, '')
    content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    
    // 2. Supprimer les exports
    content = content.replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
    content = content.replace(/^export\s+default\s+/gm, '')
    content = content.replace(/^export\s+/gm, '')
    
    // 3. Analyser les déclarations existantes
    const existingDeclarations = {
      browser: /(?:const|let|var)\s+browser\s*=/.test(content),
      chrome: /(?:const|let|var)\s+chrome\s*=/.test(content)
    }
    
    // 4. Préparer les déclarations globales nécessaires
    let globalDeclarations = []
    
    if (!existingDeclarations.browser) {
      globalDeclarations.push('const browser = globalThis.browser || globalThis.chrome;')
    }
    
    // 5. Ajouter d'autres déclarations si nécessaire
    if (content.includes('require(') && !content.includes('const require')) {
      globalDeclarations.push('// Note: require() calls have been removed for web extension compatibility')
    }
    
    const declarationsBlock = globalDeclarations.length > 0 
      ? `\n// Déclarations globales pour l'extension web\n${globalDeclarations.join('\n')}\n`
      : ''
    
    // 6. Wrapper IIFE
    content = `(function() {
'use strict';${declarationsBlock}
${content}
})();`
    
    fs.writeFileSync(filePath, content, 'utf8')
    modified = true
    console.log(`✅ ${filename} converted to IIFE format`)
  }
  
  return modified
}

// Plugin custom pour gérer le manifest et les assets
function webExtensionPlugin(browser) {
  return {
    name: 'web-extension-plugin',
    
    // Générer le manifest après le build
    async writeBundle() {
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
      
      // POST-PROCESSING : Convertir les scripts ESM en IIFE
      console.log('🔧 Post-processing: Converting ESM to IIFE...')
      const distPath = resolve(__dirname, 'dist')
      
      // Fichiers à convertir (scripts de background et content)
      const filesToConvert = [
        { name: 'background.js', path: resolve(distPath, 'background.js') },
        { name: 'content.js', path: resolve(distPath, 'content.js') }
      ]
      
      let convertedCount = 0
      filesToConvert.forEach(({ name, path }) => {
        if (convertEsmToIife(path, name)) {
          convertedCount++
        }
      })
      
      if (convertedCount > 0) {
        console.log(`✅ ${convertedCount} file(s) converted from ESM to IIFE`)
      } else {
        console.log('ℹ️  No ESM conversion needed')
      }
      
      // Corriger les chemins dans les fichiers HTML
      fixHtmlAssetPaths()
      
      console.log('✅ Build completed for', browser)
    },
    
    // Gérer le mode dev avec watch
    async buildStart() {
      // Générer le manifest au démarrage du build
      await generateManifestWrapper(browser)
      
      // Copier les assets
      const assetsSource = resolve(__dirname, 'src/assets')
      const assetsDest = resolve(__dirname, 'dist/assets')
      
      if (fs.existsSync(assetsSource)) {
        copyRecursive(assetsSource, assetsDest)
      }
    }
  }
}

// Fonction améliorée pour corriger les chemins dans les fichiers HTML
function fixHtmlAssetPaths() {
  const distPath = resolve(__dirname, 'dist')
  
  // Liste des fichiers HTML à traiter
  const htmlFiles = ['popup.html', 'options.html']
  
  htmlFiles.forEach(htmlFile => {
    const htmlPath = resolve(distPath, htmlFile)
    
    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8')
      let modified = false
      
      // Regex pour trouver tous les attributs src et href
      const assetRegex = /(src|href)="([^"]+\.(js|css|png|jpg|jpeg|gif|svg|ico))"/g
      
      content = content.replace(assetRegex, (match, attr, path, ext) => {
        // Si le chemin ne commence pas déjà par "assets/"
        if (!path.startsWith('assets/')) {
          // Pour les chunks
          if (path.startsWith('chunks/')) {
            modified = true
            return `${attr}="assets/${path}"`
          }
          // Pour les fichiers des pages (popup.js, options.js, etc.)
          else if (path.match(/^(popup|options)\.(js|css)$/)) {
            modified = true
            return `${attr}="assets/${path}"`
          }
          // Pour les autres assets (sauf background et content)
          else if (path.match(/^[^\/]+\.(js|css)$/) && !path.match(/^(background|content)\.js$/)) {
            modified = true
            return `${attr}="assets/${path}"`
          }
        }
        return match
      })
      
      if (modified) {
        fs.writeFileSync(htmlPath, content, 'utf8')
        console.log(`✅ ${htmlFile} paths fixed`)
      }
    }
  })
}

function reorganizeDistFolder() {
  const distPath = resolve(__dirname, 'dist')
  
  // Déplacer les fichiers HTML à la racine
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
  
  // Nettoyer le dossier src/
  const srcDir = resolve(distPath, 'src')
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true })
  }
  
  console.log('✅ Dist folder reorganized')
}

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
  const isDev = mode === 'development'
  const browser = process.env.BROWSER || 'chrome'
  
  console.log(`\n🚀 Building for ${isDev ? 'development' : 'production'} mode for ${browser}\n`)
  
  return {
    plugins: [
      imba(),
      webExtensionPlugin(browser)
    ],
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: !isDev && browser !== "firefox",
      
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.imba'),
          content: resolve(__dirname, 'src/content.imba'),
          popup: resolve(__dirname, 'src/popup/popup.html'),
          options: resolve(__dirname, 'src/options/options.html')
        },
        output: {
          format: 'es',                 // Utiliser 'es' au lieu de 'iife' pour éviter les conflits
          // format: 'iife',
          inlineDynamicImports: false,  // Forcer l'inline des imports pour éviter les modules ESM
          entryFileNames: (chunkInfo) => {
            // Scripts de background et content à la racine
            if (chunkInfo.name === 'background' || chunkInfo.name === 'content') {
              return '[name].js'
            }
            // Scripts des pages dans assets/
            return 'assets/[name].js'
          },
          chunkFileNames: 'assets/chunks/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || ''
            
            if (name.endsWith('.html')) {
              return '[name][extname]'
            }
            
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