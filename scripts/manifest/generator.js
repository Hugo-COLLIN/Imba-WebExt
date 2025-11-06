import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Fonctions utilitaires inline (pour éviter les imports)
function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function convertSourcePathToOutput(sourcePath) {
  return sourcePath
    .replace(/\.imba$/, '.js')
    .replace(/^src\//, '')
}

function adaptManifestForFirefox(manifest) {
  // Manifest v2 pour Firefox
  if (manifest.manifest_version === 2) {
    // Convertir host_permissions en permissions pour v2
    if (manifest.host_permissions) {
      manifest.permissions = [
        ...(manifest.permissions || []),
        ...manifest.host_permissions
      ]
      delete manifest.host_permissions
    }
  }

  // Convertir service_worker en scripts pour Firefox MV2
  if (manifest.background && manifest.background.service_worker) {
    manifest.background = {
      scripts: [manifest.background.service_worker],
      persistent: false
    };
  }

  // Convertir action en browser_action
  if (manifest.action) {
    manifest.browser_action = manifest.action;
    delete manifest.action;
  }

  // Adapter options_ui
  if (manifest.options_ui && manifest.options_ui.page) {
    manifest.options_ui.open_in_tab = true;
  }
  
  // Ajouter l'ID obligatoire pour Firefox
  if (!manifest.browser_specific_settings) {
    manifest.browser_specific_settings = {
      gecko: {
        id: "save-web-content@example.com",
        strict_min_version: "57.0"
      }
    }
  }
}

/**
 * Génère le manifest.json pour le navigateur cible
 */
export function generateManifest(targetBrowser, version) {
  const srcManifestPath = path.join(process.cwd(), 'src', 'manifest.json')
  const distManifestPath = path.join(process.cwd(), 'dist', 'manifest.json')
  const pkgPath = path.join(process.cwd(), 'package.json')
  
  const srcManifest = readJsonFile(srcManifestPath)
  const pkg = readJsonFile(pkgPath)
  
  console.log(`📋 Generating manifest for ${targetBrowser}...`)
  
  // Manifest de base
  let manifest = {
    manifest_version: srcManifest[`{{${targetBrowser}}}.manifest_version`] || (targetBrowser === 'firefox' ? 2 : 3),
    name: srcManifest.name || pkg.name || 'My Extension',
    version: version || srcManifest.version || pkg.version || '1.0.0',
    description: srcManifest.description || pkg.description || 'Extension developed with Imba',
    homepage_url: srcManifest.homepage_url || pkg.homepage,
  }
  
  // Traitement récursif des propriétés avec la syntaxe {{browser}}
  processObject(srcManifest, manifest, targetBrowser)
  
  // Adaptations spécifiques Firefox
  if (targetBrowser === 'firefox') {
    adaptManifestForFirefox(manifest)
  }
  
  // Nettoyage des propriétés vides
  cleanEmptyProperties(manifest)
  
  writeJsonFile(distManifestPath, manifest)
  console.log(`✅ Manifest generated: ${distManifestPath}`)
}

/**
 * Traite récursivement les propriétés du manifest
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
 * Nettoie les propriétés vides du manifest
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