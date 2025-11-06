import { defineConfig } from 'vite'
import { imba } from 'vite-plugin-imba'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import du générateur de manifest existant
async function generateManifestWrapper(browser) {
  const { generateManifest } = await import('./scripts/manifest/generator.js')
  generateManifest(browser)
}

// Plugin custom pour gérer le manifest et les assets
function webExtensionPlugin(browser, buildType) {
  return {
    name: 'web-extension-plugin',
    
    async writeBundle() {
      // Générer le manifest seulement lors du dernier build (UI)
      if (buildType === 'ui') {
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
        
        // Corriger les chemins dans les fichiers HTML
        fixHtmlAssetPaths()
        
        console.log(`✅ Build completed for ${browser}`)
      }
    },
    
    // Gérer le mode dev avec watch
    async buildStart() {
      // Générer le manifest au démarrage du premier build
      if (buildType === 'background') {
        await generateManifestWrapper(browser)
      }
      
      // Copier les assets au démarrage du build UI
      if (buildType === 'ui') {
        const assetsSource = resolve(__dirname, 'src/assets')
        const assetsDest = resolve(__dirname, 'dist/assets')
        
        if (fs.existsSync(assetsSource)) {
          copyRecursive(assetsSource, assetsDest)
        }
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
  const buildType = process.env.BUILD_TYPE || 'all'
  
  console.log(`\n🚀 Building ${buildType} for ${isDev ? 'development' : 'production'} mode for ${browser}\n`)
  
  // Déterminer si on est en mode watch
  const isWatch = process.env.VITE_WATCH === 'true'
  
  // Configuration de base commune
  const baseConfig = {
    plugins: [imba()],
    build: {
      outDir: 'dist',
      emptyOutDir: buildType === 'background' && !isWatch, // Ne jamais vider en watch
      sourcemap: false,
      minify: !isDev && browser !== "firefox",
    },
    resolve: {
      extensions: ['.imba', '.js', '.json']
    },
    optimizeDeps: {
      include: ['webextension-polyfill', 'turndown']
    }
  }
  
  // Configuration spécifique selon le type de build
  if (buildType === 'background' || buildType === 'content') {
    // Build IIFE pour background et content scripts
    return {
      ...baseConfig,
      plugins: [...baseConfig.plugins, webExtensionPlugin(browser, buildType)],
      build: {
        ...baseConfig.build,
        rollupOptions: {
          input: {
            [buildType]: resolve(__dirname, `src/${buildType}.imba`)
          },
          output: {
            format: 'iife', // ✅ IIFE fonctionne avec une seule entrée
            entryFileNames: '[name].js',
            globals: {
              'webextension-polyfill': 'browser'
            }
          },
          external: ['webextension-polyfill'] // Externaliser le polyfill
        }
      }
    }
  }
  
  // Build ES pour l'UI (popup, options) - permet le code-splitting
  return {
    ...baseConfig,
    plugins: [...baseConfig.plugins, webExtensionPlugin(browser, 'ui')],
    build: {
      ...baseConfig.build,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/popup.html'),
          options: resolve(__dirname, 'src/options/options.html')
        },
        output: {
          format: 'es', // ES module pour l'UI (supporté par les extensions modernes)
          inlineDynamicImports: false,
          entryFileNames: 'assets/[name].js',
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
    }
  }
})