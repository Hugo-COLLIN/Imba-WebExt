import { execSync } from 'child_process'
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync } from 'fs'

# Smart merge: recursive for objects, concatenates + dedupes arrays,
# scalar values from `source` override `target`.
def smartMerge(target, source)
	const result = { ...target }
	for own key, value of source
		if Array.isArray(result[key]) and Array.isArray(value)
			result[key] = [...new Set([...result[key], ...value])]
		elif result[key] isa Object and value isa Object
			result[key] = smartMerge(result[key], value)
		else
			result[key] = value
	return result

# Remove keys with null / undefined / empty objects (recursive)
def cleanEmptyProperties(obj)
	for own key, value of obj
		if value == null
			delete obj[key]
		elif value isa Object and !Array.isArray(value)
			cleanEmptyProperties(value)
			delete obj[key] if Object.keys(value).length == 0

# 1. Parse flags (--chrome / --firefox / --watch)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')
const watchFlag = watchMode ? ' --watch' : ''

console.log "Début de la compilation pour {browser}{watchMode ? ' (mode watch)' : ''}..."

# 2. Recreate output directory from scratch (removes stale files)
rmSync('out', recursive: true, force: true)
mkdirSync('out')

# 3. Generate manifest (in watch mode, the compile below blocks forever)
console.log "-> Génération du manifest.json..."
try
	const sourceData = JSON.parse(readFileSync('app/metadata.json', 'utf8'))
	const { chrome, firefox, ...common } = sourceData

	# package.json is optional: read only if it exists
	let pkg = {}
	if existsSync('package.json')
		pkg = JSON.parse(readFileSync('package.json', 'utf8'))

	# Fallbacks from package.json or default values if missing from metadata.json
	common.name = common.name or pkg.name or 'my-extension'
	common.version = common.version or pkg.version or '0.0.1'
	common.description = common.description or pkg.description or ''

	const finalManifest = smartMerge(common, sourceData[browser])
	cleanEmptyProperties(finalManifest)

	# Firefox: a Gecko ID is required to sign on AMO
	if browser == 'firefox' and !finalManifest.browser_specific_settings..gecko..id
		console.warn "⚠️  Aucun browser_specific_settings.gecko.id défini : requis pour publier sur addons.mozilla.org"

	writeFileSync('out/manifest.json', JSON.stringify(finalManifest, null, 2))
	console.log "-> Manifest {browser} généré avec succès dans out/manifest.json!"
catch err
	console.error "Erreur lors de la création du manifest :", err.message
	process.exit(1)

# 4. Compile Imba entrypoints sequentially
# TODO Note: --watch only works for the first entrypoint (execSync is blocking)
console.log "-> Compilation des scripts Imba..."
try
	const entries = ['background']
	for entry of entries
		execSync("bimba app/{entry}.imba --outdir out{watchFlag}", stdio: 'inherit')
catch err
	console.error "Erreur lors de la compilation :", err.message
	process.exit(1)
