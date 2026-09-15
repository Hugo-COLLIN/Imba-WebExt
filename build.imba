import { execSync } from 'child_process'
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync, cpSync, readdirSync } from 'fs'

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

# 1. Parse flags (--chrome / --firefox / --watch / --prod / --pack / --test)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')
const packMode = args.includes('--pack')
const prodMode = packMode or args.includes('--prod')
const testMode = args.includes('--test')

# Flags for bimba:
# - dev: readable code (--no-minify) + external sourcemaps
# - prod: minified (bimba default), except Firefox (AMO review requires readable code)
let buildFlags = ' --target browser'
if watchMode
	buildFlags += ' --watch'
unless prodMode or browser == 'firefox'
	buildFlags += ' --no-minify'
unless prodMode
	buildFlags += ' --sourcemap external'

# === TEST MODE ===
# Transpile all *.test.imba from the repo to test.local/, then bun test
if testMode
	rmSync('test.local', recursive: true, force: true)
	mkdirSync('test.local', recursive: true)

	const ignoredDirs = ['node_modules', 'out', 'releases', 'test.local', '.git']
	const testFiles = readdirSync('.', recursive: true).filter do(f)
		const path = String(f)
		path.endsWith('.test.imba') and !ignoredDirs.some do(dir) path.startsWith(dir)

	if testFiles.length == 0
		console.log "Aucun fichier .test.imba trouvé"
		process.exit(0)

	console.log "-> Transpilation de {testFiles.length} fichier(s) de test..."
	for file of testFiles
		const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
		mkdirSync("test.local/{dir}", recursive: true)
		execSync("imbac --platform node -m -o test.local/{dir} {file}", stdio: 'inherit')

	unless watchMode
		console.log "-> Exécution des tests..."
		execSync("bun test test.local", stdio: 'inherit')
	process.exit(0)

# === BUILD EXTENSION MODE ===
console.log "Début de la compilation pour {browser} ({prodMode ? 'prod' : 'dev'}{watchMode ? ', watch' : ''})..."

# 2. Recreate output directory from scratch (removes stale files)
rmSync('out', recursive: true, force: true)
mkdirSync('out')

# 3. Copy static assets (icons, images...)
if existsSync('app/assets')
	cpSync('app/assets', 'out/assets', recursive: true)
	console.log "-> Assets copiés dans out/assets/"

# 4. Generate manifest (in watch mode, the compile below blocks forever)
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

# 5. Compile Imba entrypoints sequentially
# TODO Note: --watch only works for the first entrypoint (execSync is blocking)
console.log "-> Compilation des scripts Imba..."
try
	const entries = ['background']
	for entry of entries
		execSync("bimba app/{entry}.imba --outdir out{buildFlags}", stdio: 'inherit')
catch err
	console.error "Erreur lors de la compilation :", err.message
	process.exit(1)

# 6. Package the extension into releases/ (--pack)
# Name/version read from the generated manifest: only reliable source of truth
if packMode and !watchMode
	mkdirSync('releases') unless existsSync('releases')
	const m = JSON.parse(readFileSync('out/manifest.json', 'utf8'))
	const archiveName = "{m.name}_{m.version}_{browser}.zip"
	try
		# zip from out/ so manifest.json is at the root of the archive
		execSync("cd out && zip -r ../releases/{archiveName} .", stdio: 'inherit')
		console.log "-> Archive releases/{archiveName} créée !"
	catch err
		console.error "Erreur lors de l'archivage (zip est-il installé ?) :", err.message
		process.exit(1)
