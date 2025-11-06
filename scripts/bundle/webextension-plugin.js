import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateManifest } from '../manifest/generator.js';

// Obtenir le chemin du fichier actuel et la racine du projet
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// Helper pour résoudre les chemins depuis la racine du projet
const fromRoot = (...paths) => resolve(projectRoot, ...paths);

// Plugin custom pour gérer le manifest et les assets
export function webExtensionPlugin(browser, buildType) {
  return {
    name: 'web-extension-plugin',

    async writeBundle() {
      // Générer le manifest seulement lors du dernier build (UI)
      if (buildType === 'ui') {
        await generateManifest(browser);

        // Copier les assets
        const assetsSource = fromRoot('src/assets');
        const assetsDest = fromRoot('dist/assets');

        if (fs.existsSync(assetsSource)) {
          copyRecursive(assetsSource, assetsDest);
          console.log('✅ Assets copied');
        }

        // Copier README et LICENSE
        copyRootFiles();

        // Réorganiser la structure de sortie
        reorganizeDistFolder();

        // Corriger les chemins dans les fichiers HTML
        fixHtmlAssetPaths();

        console.log(`✅ Build completed for ${browser}`);
      }
    },

    // Gérer le mode dev avec watch
    async buildStart() {
      // Générer le manifest au démarrage du premier build
      if (buildType === 'background') {
        await generateManifest(browser);
      }

      // Copier les assets au démarrage du build UI
      if (buildType === 'ui') {
        const assetsSource = fromRoot('src/assets');
        const assetsDest = fromRoot('dist/assets');

        if (fs.existsSync(assetsSource)) {
          copyRecursive(assetsSource, assetsDest);
        }

        // Copier README et LICENSE aussi au démarrage
        copyRootFiles();
      }
    }
  };
}

// Fonction pour copier README et LICENSE
function copyRootFiles() {
  const rootFiles = ['README.md', 'README', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'];
  const distPath = fromRoot('dist');

  // Créer le dossier dist s'il n'existe pas
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }

  rootFiles.forEach(fileName => {
    const sourcePath = fromRoot(fileName);
    const destPath = fromRoot('dist', fileName);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ ${fileName} copied to dist/`);
    }
  });
}

// Fonction améliorée pour corriger les chemins dans les fichiers HTML
function fixHtmlAssetPaths() {
  const distPath = fromRoot('dist');

  // Liste des fichiers HTML à traiter
  const htmlFiles = ['popup.html', 'options.html'];

  htmlFiles.forEach(htmlFile => {
    const htmlPath = resolve(distPath, htmlFile);

    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8');
      let modified = false;

      // Regex pour trouver tous les attributs src et href
      const assetRegex = /(src|href)="([^"]+\.(js|css|png|jpg|jpeg|gif|svg|ico))"/g;

      content = content.replace(assetRegex, (match, attr, path, ext) => {
        // Si le chemin ne commence pas déjà par "assets/"
        if (!path.startsWith('assets/')) {
          // Pour les chunks
          if (path.startsWith('chunks/')) {
            modified = true;
            return `${attr}="assets/${path}"`;
          }

          // Pour les fichiers des pages (popup.js, options.js, etc.)
          else if (path.match(/^(popup|options)\.(js|css)$/)) {
            modified = true;
            return `${attr}="assets/${path}"`;
          }

          // Pour les autres assets (sauf background et content)
          else if (path.match(/^[^\/]+\.(js|css)$/) && !path.match(/^(background|content)\.js$/)) {
            modified = true;
            return `${attr}="assets/${path}"`;
          }
        }
        return match;
      });

      if (modified) {
        fs.writeFileSync(htmlPath, content, 'utf8');
        console.log(`✅ ${htmlFile} paths fixed`);
      }
    }
  });
}

function reorganizeDistFolder() {
  const distPath = fromRoot('dist');

  // Déplacer les fichiers HTML à la racine
  const popupHtmlSrc = resolve(distPath, 'src/popup/popup.html');
  const popupHtmlDest = resolve(distPath, 'popup.html');
  if (fs.existsSync(popupHtmlSrc)) {
    fs.renameSync(popupHtmlSrc, popupHtmlDest);
  }

  const optionsHtmlSrc = resolve(distPath, 'src/options/options.html');
  const optionsHtmlDest = resolve(distPath, 'options.html');
  if (fs.existsSync(optionsHtmlSrc)) {
    fs.renameSync(optionsHtmlSrc, optionsHtmlDest);
  }

  // Nettoyer le dossier src/
  const srcDir = resolve(distPath, 'src');
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true });
  }

  console.log('✅ Dist folder reorganized');
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}