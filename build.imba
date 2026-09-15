import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'

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

# 1. Parse flags (--chrome / --firefox / --watch)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'
const watchMode = args.includes('--watch')

console.log "Début de la compilation pour {browser}{watchMode ? ' (mode watch)' : ''}..."

# 2. Create target directory if it doesn't exist
if !existsSync('out')
	mkdirSync('out')

# 3. Generate manifest (in watch mode, the compile below blocks forever)
console.log "-> Génération du manifest.json..."
try
	const rawManifest = readFileSync('app/metadata.json', 'utf8')
	const sourceData = JSON.parse(rawManifest)
	const { chrome, firefox, ...common } = sourceData

	const finalManifest = smartMerge(common, sourceData[browser])

	writeFileSync('out/manifest.json', JSON.stringify(finalManifest, null, 2))
	console.log "-> Manifest {browser} généré avec succès dans out/manifest.json!"
catch err
	console.error "Erreur lors de la création du manifest :", err.message
	process.exit(1)

# 4. Compile background script (adds --watch if requested)
console.log "-> Compilation des scripts Imba..."
try
	const watchFlag = watchMode ? ' --watch' : ''
	execSync("bimba app/background.imba --outdir out{watchFlag}", stdio: 'inherit')
catch err
	console.error "Erreur lors de la compilation :", err.message
	process.exit(1)
