const fs = require('fs');
const path = require('path');
const { readJsonFile, writeJsonFile } = require('./json-utils');
const { convertSourcePathToOutput } = require('./path-converter');
const { adaptManifestForFirefox } = require('./firefox-adapter');

/**
 * Génère le manifest.json pour le navigateur cible
 */
function generateManifest(targetBrowser, version) {
  const srcManifestPath = path.join(process.cwd(), 'src', 'manifest.json');
  const distManifestPath = path.join(process.cwd(), 'dist', 'manifest.json');
  const pkgPath = path.join(process.cwd(), 'package.json');

  const srcManifest = readJsonFile(srcManifestPath);
  const pkg = readJsonFile(pkgPath);

  console.log(`📋 Generating manifest for ${targetBrowser}...`);

  // Manifest de base
  let manifest = {
    manifest_version: srcManifest[`{{${targetBrowser}}}.manifest_version`] || (targetBrowser === 'firefox' ? 2 : 3),
    name: srcManifest.name || pkg.name || 'My Extension',
    version: version || srcManifest.version || pkg.version || '1.0.0',
    description: srcManifest.description || pkg.description || 'Extension developed with Imba',
    homepage_url: srcManifest.homepage_url || pkg.homepage,
  };

  // Traitement récursif des propriétés avec la syntaxe {{browser}}
  processObject(srcManifest, manifest, targetBrowser);

  // Adaptations spécifiques Firefox
  if (targetBrowser === 'firefox') {
    adaptManifestForFirefox(manifest);
  }

  // Nettoyage des propriétés vides
  cleanEmptyProperties(manifest);

  writeJsonFile(distManifestPath, manifest);
  console.log(`✅ Manifest generated: ${distManifestPath}`);
}

/**
 * Traite récursivement les propriétés du manifest
 */
function processObject(obj, targetObj, targetBrowser) {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const isBrowserSpecificKey = key.startsWith(`{{${targetBrowser}}}`);
    const isOtherBrowserKey = key.startsWith('{{') && !isBrowserSpecificKey;

    if (isOtherBrowserKey) continue;

    let manifestKey;
    if (isBrowserSpecificKey) {
      manifestKey = key.replace(`{{${targetBrowser}}}.`, '');
    } else if (!key.startsWith('{{')) {
      manifestKey = key;
    } else {
      continue;
    }

    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      targetObj[manifestKey] = {};
      processObject(value, targetObj[manifestKey], targetBrowser);
    } else if (Array.isArray(value)) {
      targetObj[manifestKey] = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          const processedItem = {};
          processObject(item, processedItem, targetBrowser);
          return processedItem;
        } else if (typeof item === 'string') {
          return convertSourcePathToOutput(item);
        }
        return item;
      });
    } else if (typeof value === 'string') {
      targetObj[manifestKey] = convertSourcePathToOutput(value);
    } else {
      targetObj[manifestKey] = value;
    }
  }
}

/**
 * Nettoie les propriétés vides du manifest
 */
function cleanEmptyProperties(obj) {
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value === null || value === undefined) {
      delete obj[key];
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      cleanEmptyProperties(value);
      if (Object.keys(value).length === 0) {
        delete obj[key];
      }
    }
  });
}

module.exports = { generateManifest };