import { execSync, spawn } from 'child_process'
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

# Collect entrypoints from the generated manifest
def collectEntries(manifest)
	const entries = []

	if manifest.background..service_worker
		entries.push(manifest.background.service_worker)
	for s of (manifest.background..scripts or [])
		entries.push(s)
	for cs of (manifest.content_scripts or [])
		for f of (cs.js or []).concat(cs.css or [])
			entries.push(f)

	const pages = []
	for k of ['action', 'browser_action', 'side_panel']
		const page = manifest[k]..default_popup or manifest[k]..default_page
		pages.push(page) if page
	pages.push(manifest.options_ui..page) if manifest.options_ui..page
	pages.push(manifest.options_page) if manifest.options_page
	pages.push(manifest.devtools_page) if manifest.devtools_page

	for page of pages
		const name = page.slice(0, page.lastIndexOf('.'))
		entries.push("{name}.js") if existsSync("app/{name}.imba")

	return [...new Set(entries)]

const ignoredDirs = ['node_modules', 'out', 'releases', 'test.local', '.git']

# Recursive scan of the repo for a given suffix (used by test mode)
def scanFiles(suffix)
	readdirSync('.', recursive: true).filter do(f)
		const path = String(f)
		path.endsWith(suffix) and !ignoredDirs.some do(dir) path.startsWith(dir)


# 1. Parse flags (--chrome / --firefox / --watch / --prod / --pack / --test)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')
const packMode = args.includes('--pack')
const prodMode = packMode or args.includes('--prod')
const testMode = args.includes('--test')

if testMode
	# === TEST MODE ===
	# Transpile all *.test.imba from the repo to test.local/, then bun test
	# Note: a new .test.imba added during the watch is not detected.
	rmSync('test.local', recursive: true, force: true)
	mkdirSync('test.local', recursive: true)

	const testFiles = scanFiles('.test.imba')

	if testFiles.length == 0
		console.log "Aucun fichier .test.imba trouvé"
		process.exit(0)

	console.log "-> Transpilation de {testFiles.length} fichier(s) de test..."
	for file of testFiles
		const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
		mkdirSync("test.local/{dir}", recursive: true)
		execSync("imbac --platform node -m -o \"test.local/{dir}\" \"{file}\"", stdio: 'inherit')

	if watchMode
		console.log "-> Watch : un watcher imbac par fichier + bun test --watch"
		for file of testFiles
			const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
			spawn("imbac --platform node -m -w -o \"test.local/{dir}\" \"{file}\"", stdio: 'inherit', shell: true)
		spawn("bun test --watch test.local", stdio: 'inherit', shell: true)
		console.log "\n👀 Watch mode actif (Ctrl+C pour arrêter)..."
		process.stdin.resume()
	else
		console.log "-> Exécution des tests..."
		execSync("bun test test.local", stdio: 'inherit')
		process.exit(0)
else
	# === BUILD EXTENSION MODE ===
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

	console.log "Début de la compilation pour {browser} ({prodMode ? 'prod' : 'dev'}{watchMode ? ', watch' : ''})..."

	# 2. Recreate output directory from scratch (removes stale files)
	rmSync('out', recursive: true, force: true)
	mkdirSync('out')

	# 3. Copy static assets (icons, images...)
	if existsSync('app/assets')
		cpSync('app/assets', 'out/assets', recursive: true)
		console.log "-> Assets copiés dans out/assets/"

	# 4. Generate manifest (in watch mode, the compile below blocks forever)
	let finalManifest = {}
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

		finalManifest = smartMerge(common, sourceData[browser])
		cleanEmptyProperties(finalManifest)

		# Firefox: a Gecko ID is required to sign on AMO
		if browser == 'firefox' and !finalManifest.browser_specific_settings..gecko..id
			console.warn "⚠️  Aucun browser_specific_settings.gecko.id défini : requis pour publier sur addons.mozilla.org"

		writeFileSync('out/manifest.json', JSON.stringify(finalManifest, null, 2))
		console.log "-> Manifest {browser} généré avec succès dans out/manifest.json!"
	catch err
		console.error "Erreur lors de la création du manifest :", err.message
		process.exit(1)

	# 5. Compile Imba entrypoints
	# Note: bimba only monitors the entrypoint folder; a modification of metadata.json or app/assets/ requires a manual restart.
	console.log "-> Compilation des scripts Imba..."
	try
		const entries = collectEntries(finalManifest)
		if entries.length == 0
			console.warn "Aucun entrypoint déclaré dans le manifest"
			process.exit(0)

		if watchMode
			for entry of entries
				const name = entry.slice(0, entry.lastIndexOf('.'))
				if entry.endsWith('.js') and existsSync("app/{name}.imba")
					spawn("bimba \"app/{name}.imba\" --outdir out{buildFlags}", stdio: 'inherit', shell: true)
			process.stdin.resume()
		else
			for entry of entries
				const name = entry.slice(0, entry.lastIndexOf('.'))
				if entry.endsWith('.js') and existsSync("app/{name}.imba")
					execSync("bimba \"app/{name}.imba\" --outdir out{buildFlags}", stdio: 'inherit')
				elif entry.endsWith('.css') and existsSync("app/{name}.css")
					cpSync("app/{name}.css", "out/{name}.css")
	catch err
		console.error "Erreur lors de la compilation :", err.message
		process.exit(1)

	# 6. Package the extension into releases/ (--pack)
	# Name/version read from the generated manifest: only reliable source of truth
	if packMode and !watchMode
		mkdirSync('releases') unless existsSync('releases')
		const m = finalManifest
		const archiveName = "{m.name}_{m.version}_{browser}.zip"
		try
			# zip from out/ so manifest.json is at the root of the archive
			execSync("cd out && zip -r ../releases/{archiveName} .", stdio: 'inherit')
			console.log "-> Archive releases/{archiveName} créée !"
		catch err
			console.error "Erreur lors de l'archivage (zip est-il installé ?) :", err.message
			process.exit(1)
