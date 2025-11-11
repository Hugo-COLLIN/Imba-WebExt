import { defineConfig } from 'vite'
import { imba } from 'vite-plugin-imba'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { webExtensionPlugin } from './scripts/bundle/webextension-plugin.js'

const __filename = fileURLToPath(import.meta.url)
export const __dirname = dirname(__filename)


export default defineConfig(({ command, mode }) => {
  const isDev = mode === 'development'
  const browser = process.env.BROWSER || 'chrome'
  const buildType = process.env.BUILD_TYPE || 'all'
  
  console.log(`\n🚀 Building ${buildType} for ${isDev ? 'development' : 'production'} mode for ${browser}\n`)
  
  // Determine if we are in watch mode
  const isWatch = process.env.VITE_WATCH === 'true'
  
  // Common basic configuration
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
      include: ['webextension-polyfill']
    }
  }
  
  // Build for background and content scripts (IIFE, without bundled packages for Chrome compatibility)
  if (buildType === 'background' || buildType === 'content') {
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
            format: 'iife', // IIFE fonctionne avec une seule entrée
            entryFileNames: '[name].js',
            // No globals
          },
          // DO NOT outsource packages
        }
      }
    }
  }
  
  // ES Build for UI (popup, options)
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
          format: 'es', // ES module for UI (supported by modern extensions)
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