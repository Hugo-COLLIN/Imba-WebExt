#!/usr/bin/env node

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Récupérer les arguments
const args = process.argv.slice(2)
const isWatch = args.includes('--watch')
const mode = args.includes('--mode=production') ? 'production' : 'development'
const browser = process.env.BROWSER || 'chrome'

console.log(`\n🎯 Starting ${isWatch ? 'watch' : 'build'} for ${browser} (${mode})\n`)

// Fonction pour nettoyer le dossier dist
function cleanDist() {
  const distPath = resolve(dirname(__dirname), 'dist')
  if (fs.existsSync(distPath)) {
    console.log('🧹 Cleaning dist folder...')
    fs.rmSync(distPath, { recursive: true, force: true })
    console.log('✅ Dist folder cleaned\n')
  }
}

// Fonction pour exécuter un build Vite
function runViteBuild(buildType, isFirst = false) {
  return new Promise((resolve, reject) => {
    const viteArgs = [
      'vite',
      'build',
      '--mode', mode
    ]
    
    if (isWatch && !isFirst) {
      viteArgs.push('--watch')
    }
    
    const env = {
      ...process.env,
      BUILD_TYPE: buildType,
      BROWSER: browser,
      VITE_WATCH: isWatch ? 'true' : 'false'
    }
    
    const proc = spawn('bun', viteArgs, {
      stdio: 'inherit',
      env,
      shell: true
    })
    
    if (isWatch && !isFirst) {
      // En mode watch, ne pas attendre la fin du processus
      console.log(`✅ ${buildType} watch started`)
      resolve()
    } else {
      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${buildType} build completed`)
          resolve()
        } else {
          reject(new Error(`${buildType} build failed with code ${code}`))
        }
      })
    }
  })
}

// Fonction principale
async function main() {
  try {
    if (isWatch) {
      // Mode watch : lancer les 3 builds en parallèle
      console.log('🔄 Starting watch mode for all builds...\n')
      
      // Premier build séquentiel pour initialiser
      await runViteBuild('background', true)
      await runViteBuild('content', true)
      await runViteBuild('ui', true)
      
      console.log('\n✅ Initial build completed, starting watchers...\n')
      
      // Puis lancer les watchers en parallèle
      await Promise.all([
        runViteBuild('background'),
        runViteBuild('content'),
        runViteBuild('ui')
      ])
      
      console.log('\n👀 Watching for changes...')
      
      // Garder le processus vivant
      process.stdin.resume()
    } else {
      // Mode build normal : séquentiel
      console.log('🔨 Building all targets...\n')
      
      await runViteBuild('background')
      await runViteBuild('content')
      await runViteBuild('ui')
      
      console.log('\n✅ All builds completed successfully!')
    }
  } catch (error) {
    console.error('\n❌ Build failed:', error.message)
    process.exit(1)
  }
}

main()