import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'

# 1. Récupération de l'option (--chrome ou --firefox)
const args = process.argv.slice(2)
const browser = args.includes('--firefox') ? 'firefox' : 'chrome'

console.log "Début de la compilation pour {browser}..."

# 2. Création du dossier cible s'il n'existe pas
if !existsSync('out')
	mkdirSync('out')

# 3. Compilation du script background
console.log "-> Compilation des scripts Imba..."
try
	execSync("bimba background.imba --outdir out", stdio: 'inherit')
catch err
	console.error "Erreur lors de la compilation :", err.message
	process.exit(1)

# 4. Lecture et génération du manifest
console.log "-> Génération du manifest.json..."
try
	# On lit le fichier source
	const rawManifest = readFileSync('manifest.source.json', 'utf8')
	const sourceData = JSON.parse(rawManifest)

	# On fusionne la base ("common") avec les spécificités du navigateur ("chrome" ou "firefox")
	const finalManifest = { 
		...sourceData.common, 
		...sourceData[browser] 
	}

	# On écrit le résultat dans le dossier out
	writeFileSync('out/manifest.json', JSON.stringify(finalManifest, null, 2))
	console.log "-> Manifest {browser} généré avec succès dans out/manifest.json!"
catch err
	console.error "Erreur lors de la création du manifest :", err.message