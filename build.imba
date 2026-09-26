import { execSync, spawn } from 'child_process'
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync, cpSync, readdirSync, watch as fsWatch, statSync } from 'fs'
import { dirname, join } from 'path'
import { zipSync } from 'fflate'
import * as imbaCompiler from 'imba/compiler'

# Single source of truth
const APP_DIR = 'out/app'
const TEST_DIR = 'out/test'
export const PAGE_KEYS = ['action', 'browser_action', 'side_panel', 'options_ui', 'options_page', 'devtools_page']
const ignoredDirs = ['node_modules', 'out', 'releases', '.git', '.cache']

# --- Small utilities ---

const ANSI = { green: 32, red: 31, yellow: 33, cyan: 36, dim: 2 }
def col(name, t) do "\x1b[{ANSI[name]}m{t}\x1b[0m"

def readJson(path)
	existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}

export def slugify(name)
	name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

def debounce(fn, ms)
	let timer = null
	return do
		clearTimeout(timer) if timer
		timer = setTimeout(fn, ms)

# Portable recursive watch: register one watcher per directory under path
# (the recursive option of fs.watch is not working on Linux)
# Note: a subfolder created during the watch session won't be monitored
def watchDir(path, fn)
	const subdirs = readdirSync(path, recursive: true).map do(x) String(x)
	const dirs = [path]
	for f of subdirs
		const p = join(path, f)
		dirs.push(p) if statSync(p).isDirectory()
	for d of dirs
		fsWatch(d) do(e, filename)
			fn() if filename

# Minimal HTML wrapper for a compiled Imba page (lives next to the .js)
export def pageHtml(jsPath)
	const file = jsPath.split('/').pop()
	'<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Extension</title>\n  </head>\n  <body>\n    <script type="module" src="./' + file + '"></script>\n  </body>\n</html>\n'

# --- Manifest ---

# Recursive merge: objects merge, arrays concat+dedupe, scalars override
export def smartMerge(target, source)
	const result = { ...target }
	for own key, value of source
		if Array.isArray(result[key]) and Array.isArray(value)
			result[key] = [...new Set([...result[key], ...value])]
		elif result[key] isa Object and value isa Object
			result[key] = smartMerge(result[key], value)
		else
			result[key] = value
	result

# Remove null / undefined / empty-object keys (recursive)
export def cleanEmptyProperties(obj)
	for own key, value of obj
		if value == null
			delete obj[key]
		elif value isa Object and !Array.isArray(value)
			cleanEmptyProperties(value)
			delete obj[key] if Object.keys(value).length == 0

# Single recursive pass over the manifest: collects entries AND rewrites
# refs in place, so the two can never drift out of sync.
export def walkManifest(node, entries, kind = null)
	if typeof node == 'string'
		if kind == 'css' or (kind == 'page' and node.endsWith('.html'))
			entries.push({ source: "app/{node}", output: node })   # plain asset: copy
			return node
		if node.endsWith('.imba')
			const name = node.slice(0, -5)
			entries.push({ source: "app/{node}", output: "{name}.js" })
			if kind == 'page'
				entries.push({ output: "{name}.html", content: pageHtml("{name}.js") })
				return "{name}.html"
			return "{name}.js"
		return node
	if Array.isArray(node)
		return node.map do(v) walkManifest(v, entries, kind)
	if node isa Object
		for own k, v of node
			const sub = PAGE_KEYS.includes(k) ? 'page' : k == 'css' ? 'css' : kind
			node[k] = walkManifest(v, entries, sub)
	node

def buildManifest(browserName)
	const sourceData = readJson('app/metadata.json')
	const { chrome, firefox, ...common } = sourceData
	const pkg = readJson('package.json')

	common.name = common.name or pkg.name or 'my-extension'
	common.version = common.version or pkg.version or '0.0.1'
	common.description = common.description or pkg.description or ''

	const entries = []
	const manifest = walkManifest(smartMerge(common, sourceData[browserName]), entries)
	cleanEmptyProperties(manifest)

	if browserName == 'firefox' and !manifest.browser_specific_settings..gecko..id
		console.warn col('yellow', "⚠️  No browser_specific_settings.gecko.id set; required to publish on addons.mozilla.org")

	return { manifest, entries }

# --- Entries output ---

def processEntry(e)
	mkdirSync(dirname("{APP_DIR}/{e.output}"), recursive: true)
	if e.content
		writeFileSync("{APP_DIR}/{e.output}", e.content)
	elif existsSync(e.source)
		cpSync(e.source, "{APP_DIR}/{e.output}")
	else
		console.warn col('yellow', "✗ Entry source not found: {e.source}")

# --- Tests ---

# Transpile one .imba file (test or build.imba itself) with the compiler
def compileTestFile(source)
	const dest = "{TEST_DIR}/{source.replace('.imba', '.js')}"
	mkdirSync(dirname(dest), recursive: true)
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
		writeFileSync(dest, String(out.js))
		return true
	catch err
		console.error col('red', "✗ {source}: {err.message}")
		return false

def transpileAll(files)
	let fails = 0
	for f of files
		fails += 1 unless compileTestFile(f)
	fails

def scanFiles(suffix)
	readdirSync('.', recursive: true).filter do(f)
		const p = String(f)
		p.endsWith(suffix) and !ignoredDirs.some do(d) p.startsWith(d)

# --- Packaging ---

# {relative/path: content} map as expected by fflate
def readDir(dir)
	const out = {}
	for f of readdirSync(dir, recursive: true)
		const p = join(dir, String(f))
		out[String(f).replace(/\\/g, '/')] = readFileSync(p) unless statSync(p).isDirectory()
	out

# Archive the repository source, excludes build outputs and VCS metadata (same rule as scanFiles)
def packSourceZip
	mkdirSync('releases', recursive: true)
	const meta = readJson('app/metadata.json')
	const name = slugify(meta.name or readJson('package.json').name or 'extension')
	const version = meta.version or readJson('package.json').version or '0.0.0'

	const files = {}
	const ignoredRe = new RegExp("^({ignoredDirs.join('|')})")
	for f of readdirSync('.', recursive: true)
		const p = String(f).replace(/\\/g, '/')
		if !ignoredRe.test(p) and !statSync(p).isDirectory()
			files[p] = new Uint8Array(readFileSync(p))

	const archive = "releases/{name}_{version}_source.zip"
	writeFileSync(archive, zipSync(files, level: 9))
	console.log col('green', "-> Source archive {archive} created ({Object.keys(files).length} files)")

# --- Flags ---

const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')
const packMode = args.includes('--pack')
const prodMode = packMode or args.includes('--prod')
const sourceZipMode = args.includes('--source-zip')
const testMode = args.includes('--test')

# --- Modes ---

def runTests
	rmSync(TEST_DIR, recursive: true, force: true)
	mkdirSync(TEST_DIR, recursive: true)

	# All .imba files are transpiled, so tests can import any compiled module
	const files = scanFiles('.imba').map do(f) String(f)
	const testFiles = files.filter do(f) String(f).endsWith('.test.imba')

	if testFiles.length == 0
		console.log col('yellow', "No .test.imba file found")
		return

	console.log col('cyan', "-> Transpiling {files.length} file(s)...")
	const failures = transpileAll(files)
	if failures > 0
		console.error col('red', "\n✗ {failures}/{files.length} file(s) failed to transpile")
		process.exit(1)

	if watchMode
		def recompile
			const fails = transpileAll(files)
			console.log col('green', "-> Recompiled {files.length - fails}/{files.length} file(s)")
		const debounced = debounce(recompile, 120)
		const dirs = Array.from(new Set(files.map do(f) dirname(String(f))))
		for dir of dirs
			watchDir(dir, debounced)
		# argv array (spaces in the project path are safe) and no shell
		spawn('bun', ['test', '--watch', TEST_DIR], stdio: 'inherit')
		console.log "\n👀 Watch mode active (Ctrl+C to stop)..."
		process.stdin.resume()
	else
		console.log col('cyan', "-> Running tests...")
		try
			execSync("bun test {TEST_DIR}", stdio: 'inherit')
		catch err
			# bun test already printed the failure summary
			process.exit(err.status or 1)

def runBuild
	const { imbaPlugin, setTarget } = await import('./imba-plugin.js')
	setTarget('browser')
	const minify = prodMode and browser != 'firefox'
	const sourcemap = prodMode ? 'none' : 'linked'
	let finalManifest = null

	def buildAll
		rmSync(APP_DIR, recursive: true, force: true)
		mkdirSync(APP_DIR, recursive: true)

		if existsSync('app/assets')
			cpSync('app/assets', "{APP_DIR}/assets", recursive: true)

		const { manifest, entries } = buildManifest(browser)
		finalManifest = manifest
		writeFileSync("{APP_DIR}/manifest.json", JSON.stringify(manifest, null, 2))

		console.log col('dim', "-> Processing {entries.length} entr(ies)...")

		const jsEntries = entries.filter do(e) e.source and e.output.endsWith('.js')
		if jsEntries.length > 0
			await Bun.build(
				entrypoints: jsEntries.map do(e) e.source
				outdir: APP_DIR
				target: 'browser'
				minify: minify
				sourcemap: sourcemap
				plugins: [imbaPlugin]
			)

		for e of entries
			processEntry(e) unless e.source and e.output.endsWith('.js')

		console.log col('green', "-> Build complete ({browser})")

	console.log col('cyan', "== Building for {browser} ({prodMode ? 'prod' : 'dev'}{watchMode ? ', watch' : ''}) ==")
	await buildAll()

	if watchMode
		watchDir('app', debounce(buildAll, 120))
		console.log "\n👀 Watch mode active (Ctrl+C to stop)..."
		process.stdin.resume()
	elif packMode
		mkdirSync('releases', recursive: true)
		const archive = "releases/{slugify(finalManifest.name)}_{finalManifest.version}_{browser}.zip"
		writeFileSync(archive, zipSync(readDir(APP_DIR), level: 9))
		console.log col('green', "-> Archive {archive} created")

# --- Dispatch ---
# Entrypoint guard: importing this module (from tests) never runs the pipeline.
const isEntry = process.argv[1] and process.argv[1].replace(/\\/g, '/').endsWith('/build.imba')

if isEntry
	if sourceZipMode
		packSourceZip!
	elif testMode
		runTests!
	else
		await runBuild!
