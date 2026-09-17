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

# Generate the minimal HTML wrapper for an Imba page.
# Styles are bundled into the JS by bimba, so no <style> link needed.
# The src uses only the file basename: HTML and JS live in the same folder.
def pageHtml(jsFile)
	const fileName = jsFile.includes('/') ? jsFile.slice(jsFile.lastIndexOf('/') + 1) : jsFile
	return '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Extension</title>\n  </head>\n  <body>\n    <script type="module" src="./' + fileName + '"></script>\n  </body>\n</html>\n'

# Collect entrypoints from the source manifest (before browser merge).
# .imba pages get a compiled .js entry AND a generated wrapper .html.
# Plain .html/.css entries are copied as-is.
def collectEntries(sourceData)
	const entries = []
	const common = sourceData

	# background
	if common.background..service_worker..endsWith('.imba')
		const name = common.background.service_worker.slice(0, -5)
		entries.push({ source: "app/{name}.imba", output: "{name}.js" })
	for s of (common.background..scripts or [])
		if s.endsWith('.imba')
			const name = s.slice(0, -5)
			entries.push({ source: "app/{name}.imba", output: "{name}.js" })

	# content_scripts
	for cs of (common.content_scripts or [])
		for f of (cs.js or [])
			if f.endsWith('.imba')
				const name = f.slice(0, -5)
				entries.push({ source: "app/{name}.imba", output: "{name}.js" })
		for f of (cs.css or [])
			if f.endsWith('.imba')
				const name = f.slice(0, -5)
				entries.push({ source: "app/{name}.imba", output: "{name}.css" })

	# HTML pages (popup, options, etc.) - just copy, no compilation
	const pages = []
	for k of ['action', 'browser_action', 'side_panel']
		const page = common[k]..default_popup or common[k]..default_page
		pages.push(page) if page
	pages.push(common.options_ui..page) if common.options_ui..page
	pages.push(common.options_page) if common.options_page
	pages.push(common.devtools_page) if common.devtools_page

	for page of pages
		if page.endsWith('.imba')
			const name = page.slice(0, -5)
			entries.push({ source: "app/{page}", output: "{name}.js" })
			entries.push({ wrapperHtml: "{name}.html", wrapperJs: "{name}.js" })
		elif page.endsWith('.html')
			entries.push({ source: "app/{page}", output: "{page}" })

	return entries

# Rewrite .imba references in the merged manifest for final output:
# entrypoints (.js/.css) and page wrappers (.html)
def rewriteManifest(manifest)
	if manifest.background..service_worker..endsWith('.imba')
		manifest.background.service_worker = manifest.background.service_worker.slice(0, -5) + '.js'

	let bgIndex = 0
	for s of (manifest.background and manifest.background.scripts or [])
		if s.endsWith('.imba')
			manifest.background.scripts[bgIndex] = s.slice(0, -5) + '.js'
		bgIndex++

	for cs of (manifest.content_scripts or [])
		let jsIndex = 0
		for f of (cs.js or [])
			if f.endsWith('.imba')
				cs.js[jsIndex] = f.slice(0, -5) + '.js'
			jsIndex++
		let cssIndex = 0
		for f of (cs.css or [])
			if f.endsWith('.imba')
				cs.css[cssIndex] = f.slice(0, -5) + '.css'
			cssIndex++

	# pages: .imba -> .html (we generate the wrapper)
	for k of ['action', 'browser_action', 'side_panel']
		if manifest[k]
			if manifest[k].default_popup and manifest[k].default_popup.endsWith('.imba')
				manifest[k].default_popup = manifest[k].default_popup.slice(0, -5) + '.html'
			if manifest[k].default_page and manifest[k].default_page.endsWith('.imba')
				manifest[k].default_page = manifest[k].default_page.slice(0, -5) + '.html'
	if manifest.options_ui and manifest.options_ui.page and manifest.options_ui.page.endsWith('.imba')
		manifest.options_ui.page = manifest.options_ui.page.slice(0, -5) + '.html'
	if manifest.options_page and manifest.options_page.endsWith('.imba')
		manifest.options_page = manifest.options_page.slice(0, -5) + '.html'
	if manifest.devtools_page and manifest.devtools_page.endsWith('.imba')
		manifest.devtools_page = manifest.devtools_page.slice(0, -5) + '.html'

	return manifest

# Slugify a manifest name for use in a filename (no spaces, they break unquoted shell args)
def slugify(name)
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const ignoredDirs = ['node_modules', 'out', 'releases', 'test.local', '.git']

# Recursive scan of the repo for a given suffix (used by test mode)
def scanFiles(suffix)
	readdirSync('.', recursive: true).filter do(f)
		const path = String(f)
		path.endsWith(suffix) and !ignoredDirs.some do(dir) path.startsWith(dir)

# Ensure the parent folder of an out/ path exists
def ensureOutDir(output)
	if output.includes('/')
		mkdirSync("out/{output.slice(0, output.lastIndexOf('/'))}", recursive: true)

# Run bimba for one entry (outdir preserves the subfolder structure)
def runBimba(entry, buildFlags, async)
	const outDir = entry.output.includes('/') ? "out/{entry.output.slice(0, entry.output.lastIndexOf('/'))}" : 'out'
	if async
		spawn("bimba \"{entry.source}\" --outdir \"{outDir}\"{buildFlags}", stdio: 'inherit', shell: true)
	else
		execSync("bimba \"{entry.source}\" --outdir \"{outDir}\"{buildFlags}", stdio: 'inherit')

# Process one entry: compile .imba (js), generate wrapper .html, or copy asset
def processEntry(entry, buildFlags, async)
	if entry.wrapperHtml
		ensureOutDir(entry.wrapperHtml)
		writeFileSync("out/{entry.wrapperHtml}", pageHtml(entry.wrapperJs))
	elif entry.output.endsWith('.js')
		runBimba(entry, buildFlags, async)
	elif entry.output.endsWith('.css') and existsSync(entry.source)
		ensureOutDir(entry.output)
		cpSync(entry.source, "out/{entry.output}")
	elif existsSync(entry.source)
		ensureOutDir(entry.output)
		cpSync(entry.source, "out/{entry.output}")
	else
		console.warn "✗ Entry source not found: {entry.source or entry.wrapperJs}"


# 1. Parse flags (--chrome / --firefox / --watch / --prod / --pack / --test)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')
const packMode = args.includes('--pack')
const prodMode = packMode or args.includes('--prod')
const testMode = args.includes('--test')

if testMode
	# === TEST MODE ===
	# Transpile all *.test.imba from the repo to test.local/ (counts then summarizes syntax failures if any), then bun test
	rmSync('test.local', recursive: true, force: true)
	mkdirSync('test.local', recursive: true)

	const testFiles = scanFiles('.test.imba')

	if testFiles.length == 0
		console.log "No .test.imba file found"
		process.exit(0)

	console.log "-> Transpiling {testFiles.length} test file(s)..."
	let failures = 0
	for file of testFiles
		const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
		mkdirSync("test.local/{dir}", recursive: true)
		try
			execSync("imbac --platform node -m -o \"test.local/{dir}\" \"{file}\"", stdio: 'inherit')
		catch err
			failures += 1
			console.error "✗ Transpilation failed: {file}"

	if failures > 0
		console.error "\n✗ {failures}/{testFiles.length} file(s) failed to transpile - fix the syntax and rerun"
		process.exit(1)

	if watchMode
		console.log "-> Watch: one imbac watcher per file + bun test --watch"
		console.log "   Note: a new .test.imba added during watch is not detected"
		for file of testFiles
			const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
			spawn("imbac --platform node -m -w -o \"test.local/{dir}\" \"{file}\"", stdio: 'inherit', shell: true)
		spawn("bun test --watch test.local", stdio: 'inherit', shell: true)
		console.log "\n👀 Watch mode active (Ctrl+C to stop)..."
		process.stdin.resume()
	else
		console.log "-> Running tests..."
		try
			execSync("bun test test.local", stdio: 'inherit')
		catch err
			# bun test already printed the failure summary; just propagate its exit code
			process.exit(err.status or 1)
		process.exit(0)
else
	# === BUILD EXTENSION MODE ===
	# Flags for bimba:
	# - dev: readable code (--no-minify) + external sourcemaps
	# - prod: minified (bimba default), except Firefox (AMO review requires readable code)
	let buildFlags = ' --target browser'
	if watchMode
		buildFlags += ' --watch'
	# Add --no-minify in dev, and ALWAYS for Firefox (AMO review)
	const minify = prodMode and browser != 'firefox'
	unless minify
		buildFlags += ' --no-minify'
	unless prodMode
		buildFlags += ' --sourcemap external'

	console.log "== Building for {browser} ({prodMode ? 'prod' : 'dev'}{watchMode ? ', watch' : ''}) =="

	# 2. Recreate output directory from scratch (removes stale files)
	rmSync('out', recursive: true, force: true)
	mkdirSync('out')

	# 3. Copy static assets
	if existsSync('app/assets')
		cpSync('app/assets', 'out/assets', recursive: true)
		console.log "-> Assets copied to out/assets/"

	# 4. Generate manifest
	let finalManifest = {}
	let entries = []
	console.log "-> Generating manifest..."
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
			console.warn "⚠️  No browser_specific_settings.gecko.id set; required to publish on addons.mozilla.org"

		# Collect entrypoints BEFORE rewriting manifest (need .imba sources)
		entries = collectEntries(finalManifest)

		# Rewrite .imba → .js/.html in the final manifest for output
		finalManifest = rewriteManifest(finalManifest)

		writeFileSync('out/manifest.json', JSON.stringify(finalManifest, null, 2))
		console.log "-> Manifest {browser} written to out/manifest.json"
	catch err
		console.error "Manifest generation failed:", err.message
		process.exit(1)

	# 5. Compile / copy entries
	# Note: bimba only monitors the entrypoint folder; a modification of
	# metadata.json or app/assets/ requires a manual restart
	console.log "-> Processing {entries.length} entr(ies)..."
	try
		if entries.length == 0
			console.warn "No entrypoint declared in the manifest"
			process.exit(0)

		for entry of entries
			processEntry(entry, buildFlags, watchMode)

		process.stdin.resume() if watchMode
	catch err
		console.error "Compilation failed:", err.message
		process.exit(1)

	# 6. Package the extension into releases/ (--pack)
	# Name/version read from the generated manifest
	if packMode and !watchMode
		mkdirSync('releases') unless existsSync('releases')
		const archiveName = "{slugify(finalManifest.name)}_{finalManifest.version}_{browser}.zip"
		try
			# cwd=out puts manifest.json at the root of the archive; path is quoted
			execSync("zip -r -q \"../releases/{archiveName}\" .", cwd: 'out', stdio: 'inherit')
			console.log "-> Archive releases/{archiveName} created"
		catch err
			console.error "Archiving failed (is zip installed?) :", err.message
			process.exit(1)
