import path from 'path'
import { readJsonFile, writeJsonFile } from '../utils/json'

/**
 * Converts source paths to actual output paths
 */
export function convertSourcePathToOutput(sourcePath) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    return sourcePath
  }

  // Convert relative src/ paths to output paths
  if (sourcePath.startsWith('src/')) {
    const relativePath = sourcePath.substring(4) // Enlever 'src/'
    
    if (sourcePath.endsWith('.imba')) {
      // The .imba files become .js at the dist/ root
      const fileName = path.basename(relativePath, '.imba')
      return `${fileName}.js`
    } else if (sourcePath.endsWith('.html')) {
      // HTML files go to the root of dist/ with just the file name
      const fileName = path.basename(relativePath)
      return fileName
    }
  }

  // For .imba files without src/ prefix
  if (sourcePath.endsWith('.imba')) {
    const fileName = path.basename(sourcePath, '.imba')
    return `${fileName}.js`
  }

  return sourcePath
}

/**
 * Adapt manifest for Firefox
 */
function adaptManifestForFirefox(manifest) {
  // Manifest v2 for Firefox
  if (manifest.manifest_version === 2) {
    // Convert host_permissions to permissions for v2
    if (manifest.host_permissions) {
      manifest.permissions = [
        ...(manifest.permissions || []),
        ...manifest.host_permissions
      ]
      delete manifest.host_permissions
    }
  }

  // Convert service_worker to scripts for Firefox MV2
  if (manifest.background && manifest.background.service_worker) {
    manifest.background = {
      scripts: [manifest.background.service_worker],
      persistent: false
    }
  }

  // Convert action to browser_action
  if (manifest.action) {
    manifest.browser_action = manifest.action
    delete manifest.action
  }

  // Adapt options_ui
  if (manifest.options_ui && manifest.options_ui.page) {
    manifest.options_ui.open_in_tab = true
  }
  
  // Add required ID for Firefox
  if (!manifest.browser_specific_settings) {
    console.warn("⚠️  Please add a Firefox ID in your manifest, a temporary one is provided as an example")
    manifest.browser_specific_settings = {
      gecko: {
        id: "extension@example.com",
        strict_min_version: "109.0"
      }
    }
  }
}

/**
 * Generate manifest.json for the target browser
 */
export function generateManifest(targetBrowser, version) {
  const srcManifestPath = path.join(process.cwd(), 'src', 'manifest.json')
  const distManifestPath = path.join(process.cwd(), 'dist', 'manifest.json')
  const pkgPath = path.join(process.cwd(), 'package.json')
  
  const srcManifest = readJsonFile(srcManifestPath)
  const pkg = readJsonFile(pkgPath)
  
  console.log(`📋 Generating manifest for ${targetBrowser}...`)
  
  // Base manifest
  let manifest = {
    manifest_version: srcManifest[`{{${targetBrowser}}}.manifest_version`] || (targetBrowser === 'firefox' ? 2 : 3),
    name: srcManifest.name || pkg.name || 'My Extension',
    version: version || srcManifest.version || pkg.version || '1.0.0',
    description: srcManifest.description || pkg.description || 'Extension developed with Imba',
    homepage_url: srcManifest.homepage_url || pkg.homepage,
  }
  
  // Recursive processing of properties with {{browser}} syntax
  processObject(srcManifest, manifest, targetBrowser)
  
  // Firefox specific adaptations
  if (targetBrowser === 'firefox') {
    adaptManifestForFirefox(manifest)
  }
  
  // Cleaning up empty properties
  cleanEmptyProperties(manifest)
  
  // Post-processing to correct HTML paths after reorganization
  fixHtmlPaths(manifest)
  
  writeJsonFile(distManifestPath, manifest)
  console.log(`✅ Manifest generated: ${distManifestPath}`)
}

/**
 * Correct the HTML paths in the manifest after reorganization
 */
function fixHtmlPaths(manifest) {
  // Fix popup paths
  if (manifest.action && manifest.action.default_popup) {
    manifest.action.default_popup = path.basename(manifest.action.default_popup)
  }
  if (manifest.browser_action && manifest.browser_action.default_popup) {
    manifest.browser_action.default_popup = path.basename(manifest.browser_action.default_popup)
  }
  
  // Fix options paths
  if (manifest.options_ui && manifest.options_ui.page) {
    manifest.options_ui.page = path.basename(manifest.options_ui.page)
  }
}

/**
 * Recursively process the properties of the manifest
 */
function processObject(obj, targetObj, targetBrowser) {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue
    
    const isBrowserSpecificKey = key.startsWith(`{{${targetBrowser}}}.`)
    const isOtherBrowserKey = key.startsWith('{{') && !isBrowserSpecificKey
    
    if (isOtherBrowserKey) continue
    
    let manifestKey
    if (isBrowserSpecificKey) {
      manifestKey = key.replace(`{{${targetBrowser}}}.`, '')
    } else if (!key.startsWith('{{')) {
      manifestKey = key
    } else {
      continue
    }
    
    const value = obj[key]
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      targetObj[manifestKey] = {}
      processObject(value, targetObj[manifestKey], targetBrowser)
    } else if (Array.isArray(value)) {
      targetObj[manifestKey] = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          const processedItem = {}
          processObject(item, processedItem, targetBrowser)
          return processedItem
        } else if (typeof item === 'string') {
          return convertSourcePathToOutput(item)
        }
        return item
      })
    } else if (typeof value === 'string') {
      targetObj[manifestKey] = convertSourcePathToOutput(value)
    } else {
      targetObj[manifestKey] = value
    }
  }
}

/**
 * Clean up empty properties from the manifest
 */
function cleanEmptyProperties(obj) {
  Object.keys(obj).forEach(key => {
    const value = obj[key]
    if (value === null || value === undefined) {
      delete obj[key]
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      cleanEmptyProperties(value)
      if (Object.keys(value).length === 0) {
        delete obj[key]
      }
    }
  })
}