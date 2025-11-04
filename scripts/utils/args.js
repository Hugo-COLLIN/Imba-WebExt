/**
 * Parse les arguments de ligne de commande
 */
function parseArguments(argv) {
  const isWatchMode = argv.includes('--watch') || argv.includes('-w');
  const isDev = argv.includes('--dev') || argv.includes('-d');
  
  const targetBrowser = process.env.TARGET_BROWSER || 
    (argv.find(arg => arg.startsWith('--browser='))?.split('=')[1]) || 
    'chrome';
  
  return {
    isWatchMode,
    isDev,
    targetBrowser
  };
}

module.exports = { parseArguments };