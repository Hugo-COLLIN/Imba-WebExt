/**
 * Adapte le manifest pour Firefox
 */
function adaptManifestForFirefox(manifest) {
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
}

module.exports = { adaptManifestForFirefox };