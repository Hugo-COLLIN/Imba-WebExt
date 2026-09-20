import { test, expect, describe } from 'bun:test'
import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { slugify } from '../../build.js'

# Integration tests: each spawns a full `bun run build.imba` run.

# Longest line length: minified bundles are nearly one huge line.
def maxLineLength(content)
	let max = 0
	for line of content.split('\n')
		max = line.length if line.length > max
	max

describe "Intégration du build" do
	test "build dev Chrome génère manifest + background" do
		execSync('bun run build.imba', stdio: 'pipe')
		expect(existsSync('out/app/manifest.json')).toBe(true)
		expect(existsSync('out/app/background.js')).toBe(true)

	test "build Firefox utilise manifest V2 et background.scripts" do
		execSync('bun run build.imba --firefox', stdio: 'pipe')
		const manifest = JSON.parse(readFileSync('out/app/manifest.json', 'utf8'))
		expect(manifest.manifest_version).toBe(2)
		expect(Array.isArray(manifest.background and manifest.background.scripts)).toBe(true)

	test "prod Chrome est minifié (beaucoup moins de lignes qu'en dev)" do
		execSync('bun run build.imba', stdio: 'pipe')
		const devLines = readFileSync('out/app/background.js', 'utf8').split('\n').length
		execSync('bun run build.imba --prod', stdio: 'pipe')
		const prodLines = readFileSync('out/app/background.js', 'utf8').split('\n').length
		expect(prodLines < devLines).toBe(true)

	test "Firefox n'est jamais minifié, même en prod (pas de ligne géante)" do
		execSync('bun run build.imba --firefox --prod', stdio: 'pipe')
		const longest = maxLineLength(readFileSync('out/app/background.js', 'utf8'))
		expect(longest <= 2000).toBe(true)

	test "--pack produit une archive fflate nommée depuis le manifest" do
		execSync('bun run build.imba --pack', stdio: 'pipe')
		const manifest = JSON.parse(readFileSync('out/app/manifest.json', 'utf8'))
		const archiveName = "{slugify(manifest.name)}_{manifest.version}_chrome.zip"
		expect(existsSync("releases/{archiveName}")).toBe(true)

	test "les pages .imba produisent le wrapper .html + le .js compilé" do
		if existsSync('app/popup/popup.imba')
			execSync('bun run build.imba', stdio: 'pipe')
			expect(existsSync('out/app/popup/popup.js')).toBe(true)
			expect(existsSync('out/app/popup/popup.html')).toBe(true)
			const html = readFileSync('out/app/popup/popup.html', 'utf8')
			expect(html.includes('<script type="module" src="./popup.js">')).toBe(true)

	test "le CSS plain référencé est copié dans out/app" do
		if existsSync('app/styles.css')
			execSync('bun run build.imba', stdio: 'pipe')
			expect(existsSync('out/app/styles.css')).toBe(true)

	test "les assets sont copiés si présents" do
		if existsSync('app/assets')
			execSync('bun run build.imba', stdio: 'pipe')
			expect(existsSync('out/app/assets')).toBe(true)
			expect(readdirSync('out/app/assets').length > 0).toBe(true)
