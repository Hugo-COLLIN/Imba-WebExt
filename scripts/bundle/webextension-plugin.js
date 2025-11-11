import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateManifest } from '../manifest/generator.js';

// Get the current file path and project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// Helper to resolve paths from the project root
const fromRoot = (...paths) => resolve(projectRoot, ...paths);

/**
 * Custom plugin to manage the manifest and assets
 */
export function webExtensionPlugin(browser, buildType) {
  return {
    name: 'web-extension-plugin',

    async writeBundle() {
      // Generate the manifest only during the last build (UI)
      if (buildType === 'ui') {
        await generateManifest(browser);

        // Copy assets
        const assetsSource = fromRoot('src/assets');
        const assetsDest = fromRoot('dist/assets');

        if (fs.existsSync(assetsSource)) {
          copyRecursive(assetsSource, assetsDest);
          console.log('✅ Assets copied');
        }

        // Copy README et LICENSE
        copyRootFiles();

        // Reorganize output structure
        reorganizeDistFolder();

        // Fix paths in HTML files
        fixHtmlAssetPaths();

        console.log(`✅ Build completed for ${browser}`);
      }
    },

    // Manage dev mode with watch
    async buildStart() {
      // Generate the manifest at the start of the first build
      if (buildType === 'background') {
        await generateManifest(browser);
      }

      // Copy the assets at the start of the UI build
      if (buildType === 'ui') {
        const assetsSource = fromRoot('src/assets');
        const assetsDest = fromRoot('dist/assets');

        if (fs.existsSync(assetsSource)) {
          copyRecursive(assetsSource, assetsDest);
        }

        // Also copy README and LICENSE at startup
        copyRootFiles();
      }
    }
  };
}

/**
 * Function to copy README and LICENSE
 */
function copyRootFiles() {
  const rootFiles = ['README.md', 'README', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'];
  const distPath = fromRoot('dist');

  // Create the dist/ folder if it does not exist
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

/**
 * Improved function to fix paths in HTML files
 */
function fixHtmlAssetPaths() {
  const distPath = fromRoot('dist');

  // List of HTML files to process
  const htmlFiles = ['popup.html', 'options.html'];

  htmlFiles.forEach(htmlFile => {
    const htmlPath = resolve(distPath, htmlFile);

    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8');
      let modified = false;

      // Search to find all the src and href attributes
      const assetRegex = /(src|href)="([^"]+\.(js|css|png|jpg|jpeg|gif|svg|ico))"/g;

      content = content.replace(assetRegex, (match, attr, path, ext) => {
        // If the path does not already start with "assets/
        if (!path.startsWith('assets/')) {
          // Pour les chunks
          if (path.startsWith('chunks/')) {
            modified = true;
            return `${attr}="assets/${path}"`;
          }

          // For the page files (popup.js, options.js, etc.)
          else if (path.match(/^(popup|options)\.(js|css)$/)) {
            modified = true;
            return `${attr}="assets/${path}"`;
          }

          // For the other assets (except background and content)
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

/**
 * Reorganize dist/ forlder after Imba builds
 */
function reorganizeDistFolder() {
  const distPath = fromRoot('dist');

  // Move the HTML files to the root
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

  // Clean the src/ folder
  const srcDir = resolve(distPath, 'src');
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true });
  }

  console.log('✅ Dist folder reorganized');
}

/**
 * Recursively copy a file
 */
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