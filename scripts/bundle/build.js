#!/usr/bin/env node

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Retrieve the arguments
const args = process.argv.slice(2)
const isWatch = args.includes('--watch')

// Extract mode
const modeArg = args.find(arg => arg.startsWith('--mode='))
const mode = modeArg ? modeArg.split('=')[1] : 'development'

// Extract browser (prioritize flag over env variable)
const browserArg = args.find(arg => arg.startsWith('--browser='))
const browser = browserArg ? browserArg.split('=')[1] : (process.env.BROWSER || 'chrome')


console.log(`\n🎯 Starting ${isWatch ? 'watch' : 'build'} for ${browser} (${mode})\n`)

/**
 * Clean the dist/ folder
 */
function cleanDist() {
  const distPath = resolve(dirname(__dirname), 'dist')
  if (fs.existsSync(distPath)) {
    console.log('🧹 Cleaning dist folder...')
    fs.rmSync(distPath, { recursive: true, force: true })
    console.log('✅ Dist folder cleaned\n')
  }
}

/**
 * Function to execute a Vite build
 */
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
      // In watch mode, do not wait for the end of the process
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

/**
 * Main function
 */
async function main() {
  cleanDist();
  try {
    if (isWatch) {
      // Watch mode: launch parallel builds
      console.log('🔄 Starting watch mode for all builds...\n')
      
      // Launch the 3 watchers in parallel
      await Promise.all([
        runViteBuild('background'),
        runViteBuild('content'),
        runViteBuild('ui')
      ])
      
      console.log('\n👀 Watching for changes...')
      
      // Keep the process alive
      process.stdin.resume()
    } else {
      // Normal build mode: sequential
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