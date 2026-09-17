import { execSync, spawn } from 'child_process'
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync, cpSync, readdirSync, watch as fsWatch } from 'fs'
import { imbaPlugin, setTarget } from './imba-plugin.js'
import * as imbaCompiler from 'imba/compiler'

# Output roots (single source of truth)
const APP_DIR = 'out/app'
const TEST_DIR = 'out/test'

# ANSI colors for logs
def green(t)  
	"\x1b[32m{t}\x1b[0m"
def red(t)    
	"\x1b[31m{t}\x1b[0m"
def yellow(t) 
	"\x1b[33m{t}\x1b[0m"
def cyan(t)   
	"\x1b[36m{t}\x1b[0m"
def dim(t)    
	"\x1b[2m{t}\x1b[0m"

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
# The src uses only the file basename: HTML and JS live in the same folder.
def pageHtml(jsFile)
	const fileName = jsFile.includes('/') ? jsFile.slice(jsFile.lastIndexOf('/') + 1) : jsFile
	return '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Extension</title>\n  </head>\n  <body>\n    <script type="module" src="./' + fileName + '"></script>\n  </body>\n</html>\n'

# Collect entrypoints from the source manifest (before browser merge).
# .imba pages get a compiled .js entry AND a generated wrapper .html.
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

	# Pages (popup, options, etc.)
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

# Rewrite .imba references in the merged manifest for final output
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

# Slugify a manifest name for use in a filename (no spaces)
def slugify(name)
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const ignoredDirs = ['node_modules', 'out', 'releases', '.git']

# Recursive scan of the repo for a given suffix (used by test mode)
def scanFiles(suffix)
	readdirSync('.', recursive: true).filter do(f)
		const path = String(f)
		path.endsWith(suffix) and !ignoredDirs.some do(dir) path.startsWith(dir)

# Ensure the parent folder of an out/app path exists
def ensureOutDir(output)
	if output.includes('/')
		mkdirSync("{APP_DIR}/{output.slice(0, output.lastIndexOf('/'))}", recursive: true)

# Copy-only entries (html, css, wrappers)
def processEntry(entry)
	if entry.wrapperHtml
		ensureOutDir(entry.wrapperHtml)
		writeFileSync("{APP_DIR}/{entry.wrapperHtml}", pageHtml(entry.wrapperJs))
	elif existsSync(entry.source)
		ensureOutDir(entry.output)
		cpSync(entry.source, "{APP_DIR}/{entry.output}")
	else
		console.warn yellow("✗ Entry source not found: {entry.source or entry.wrapperJs}")

# Debounce: collapses bursts of fs events into a single run
def debounce(fn, ms)
	let timer = null
	return do
		clearTimeout(timer) if timer
		timer = setTimeout(fn, ms)

# Recursively watch a directory; `fn` runs on any change (debounced by caller)
def watchDir(path, fn)
	fsWatch(path, recursive: true) do(eventType, filename)
		fn() if filename

# Transpile one test file with the Imba compiler, in-process
def compileTestFile(source, dest)
	mkdirSync(dest.slice(0, dest.lastIndexOf('/')), recursive: true)
	try
		const out = imbaCompiler.compile(readFileSync(source, 'utf8'),
			sourcePath: source
			platform: 'node'
			comments: false
		)
		if out.errors and out.errors.length > 0
			for e of out.errors
				console.error "  {e.message}" if e
			return false
		writeFileSync(dest, out.js)
		return true
	catch err
		console.error red("✗ {source}: {err.message}")
		return false


# --- Flags ---
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')
const packMode = args.includes('--pack')
const prodMode = packMode or args.includes('--prod')
const testMode = args.includes('--test')

if testMode
	# === TEST MODE ===
	# Transpile all *.test.imba from the repo to out/test/, then bun test
	rmSync(TEST_DIR, recursive: true, force: true)
	mkdirSync(TEST_DIR, recursive: true)

	const testFiles = scanFiles('.test.imba')

	if testFiles.length == 0
		console.log yellow("No .test.imba file found")
		process.exit(0)

	console.log cyan("-> Transpiling {testFiles.length} test file(s)...")
	let failures = 0
	for file of testFiles
		const dest = "{TEST_DIR}/{file.replace('.test.imba', '.test.js')}"
		failures += 1 unless compileTestFile(file, dest)

	if failures > 0
		console.error red("\n✗ {failures}/{testFiles.length} test file(s) failed to transpile")
		process.exit(1)

	if watchMode
		def recompileAll
			let fails = 0
			for file of testFiles
				const dest = "{TEST_DIR}/{file.replace('.test.imba', '.test.js')}"
				fails += 1 unless compileTestFile(file, dest)
			console.log green("-> Recompiled {testFiles.length - fails}/{testFiles.length} test file(s)")

		const debounced = debounce(recompileAll, 120)
		for file of testFiles
			const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.'
			watchDir(dir, debounced)

		spawn("bun test --watch {TEST_DIR}", stdio: 'inherit', shell: true)
		console.log "\n👀 Watch mode active (Ctrl+C to stop)..."
		process.stdin.resume()
	else
		console.log cyan("-> Running tests...")
		try
			execSync("bun test {TEST_DIR}", stdio: 'inherit')
		catch err
			# bun test already printed the failure summary; just propagate its exit code
			process.exit(err.status or 1)
		process.exit(0)
else
	# === BUILD EXTENSION MODE ===
	setTarget('browser')
	const minify = prodMode and browser != 'firefox'
	const sourcemap = prodMode ? 'none' : 'linked'

	console.log cyan("== Building for {browser} ({prodMode ? 'prod' : 'dev'}{watchMode ? ', watch' : ''}) ==")

	let finalManifest = null

	def buildAll
		# => Recreate output directory from scratch (removes stale files)
		rmSync(APP_DIR, recursive: true, force: true)
		mkdirSync(APP_DIR, recursive: true)

		# => Copy static assets
		if existsSync('app/assets')
			cpSync('app/assets', "{APP_DIR}/assets", recursive: true)
			console.log dim("-> Assets copied to {APP_DIR}/assets/")

		# => Generate manifest
		console.log dim("-> Generating manifest...")

		const sourceData = JSON.parse(readFileSync('app/metadata.json', 'utf8'))
		const { chrome, firefox, ...common } = sourceData

		let pkg = {}
		if existsSync('package.json')
			pkg = JSON.parse(readFileSync('package.json', 'utf8'))

		# Fallbacks from package.json or default values if missing from metadata.json
		common.name = common.name or pkg.name or 'my-extension'
		common.version = common.version or pkg.version or '0.0.1'
		common.description = common.description or pkg.description or ''

		const merged = smartMerge(common, sourceData[browser])

		# Collect .imba entrypoints before rewriting them to .js/.html
		const entries = collectEntries(merged)
		finalManifest = rewriteManifest(merged)
		cleanEmptyProperties(finalManifest)

		# Firefox: a Gecko ID is required to sign on AMO
		if browser == 'firefox' and !finalManifest.browser_specific_settings..gecko..id
			console.warn yellow("⚠️  No browser_specific_settings.gecko.id set; required to publish on addons.mozilla.org")

		writeFileSync("{APP_DIR}/manifest.json", JSON.stringify(finalManifest, null, 2))
		console.log dim("-> Manifest {browser} written to {APP_DIR}/manifest.json")

		# => Compile / copy entries
		const jsEntries = entries.filter do(e)
			e.source and e.output and e.output.endsWith('.js')
		const otherEntries = entries.filter do(e)
			!(e.source and e.output and e.output.endsWith('.js'))

		console.log dim("-> Processing {entries.length} entr(ies)...")

		if jsEntries.length > 0
			await Bun.build(
				entrypoints: jsEntries.map do(e) e.source
				outdir: APP_DIR
				target: 'browser'
				minify: minify
				sourcemap: sourcemap
				plugins: [imbaPlugin]
			)

		for entry of otherEntries
			processEntry(entry)

		console.log green("-> Build complete ({browser})")

	await buildAll()

	if watchMode
		# One fs.watch on app/ covers .imba sources, assets,
		# html templates and metadata.json — full rebuild on any change
		const debounced = debounce(buildAll, 120)
		watchDir('app', debounced)
		console.log "\n👀 Watch mode active (Ctrl+C to stop)..."
		process.stdin.resume()

	# => Package the extension into releases/ (--pack)
	if packMode and !watchMode
		mkdirSync('releases') unless existsSync('releases')
		const archiveName = "{slugify(finalManifest.name)}_{finalManifest.version}_{browser}.zip"
		try
			# cwd=APP_DIR puts manifest.json at the root of the archive; path is quoted
			execSync("zip -r -q \"../../releases/{archiveName}\" .", cwd: APP_DIR, stdio: 'inherit')
			console.log green("-> Archive releases/{archiveName} created")
		catch err
			console.error red("Archiving failed (is zip installed?) : {err.message}")
			process.exit(1)
