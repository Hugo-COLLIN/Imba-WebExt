import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'

# 1. Get the flag (--chrome or --firefox)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'

console.log "Début de la compilation pour {browser}..."

# 2. Create target directory if it doesn't exist
if !existsSync('out')
	mkdirSync('out')

# 3. Compile background script
console.log "-> Compilation des scripts Imba..."
try
	execSync("bimba app/background.imba --outdir out", stdio: 'inherit')
catch err
	console.error "Erreur lors de la compilation :", err.message
	process.exit(1)

# 4. Read and generate manifest
console.log "-> Génération du manifest.json..."
try
	# Read source file
	const rawManifest = readFileSync('app/metadata.json', 'utf8')
	const sourceData = JSON.parse(rawManifest)
	const { chrome, firefox, ...common } = sourceData

	# Merge the base with browser-specific properties ("chrome" or "firefox")
	const finalManifest = { 
		...common,
		...sourceData[browser] 
	}

	# Write folder in the target directory
	writeFileSync('out/manifest.json', JSON.stringify(finalManifest, null, 2))
	console.log "-> Manifest {browser} généré avec succès dans out/manifest.json!"
catch err
	console.error "Erreur lors de la création du manifest :", err.message