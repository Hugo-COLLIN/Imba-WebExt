import { test, expect, describe } from 'bun:test'
import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'

# Integration tests: each spawns a full `bun run build.imba` run.

# Longest line length: minified bundles are nearly one huge line.
def maxLineLength(content)
	let max = 0
	for line of content.split('\n')
		max = line.length if line.length > max
	return max

describe "Intégration du build" do

	test "build dev Chrome génère manifest + background" do
		execSync('bun run build.imba', stdio: 'pipe')
		expect(existsSync('out/manifest.json')).toBe(true)
		expect(existsSync('out/background.js')).toBe(true)

	test "build Firefox utilise manifest V2 et background.scripts" do
		execSync('bun run build.imba --firefox', stdio: 'pipe')
		const manifest = JSON.parse(readFileSync('out/manifest.json', 'utf8'))
		expect(manifest.manifest_version).toBe(2)
		expect(Array.isArray(manifest.background and manifest.background.scripts)).toBe(true)

	test "prod Chrome est minifié (beaucoup moins de lignes qu'en dev)" do
		execSync('bun run build.imba', stdio: 'pipe')
		const devLines = readFileSync('out/background.js', 'utf8').split('\n').length
		execSync('bun run build.imba --prod', stdio: 'pipe')
		const prodLines = readFileSync('out/background.js', 'utf8').split('\n').length
		expect(prodLines < devLines).toBe(true)

	test "Firefox n'est jamais minifié, même en prod (pas de ligne géante)" do
		execSync('bun run build.imba --firefox --prod', stdio: 'pipe')
		const longest = maxLineLength(readFileSync('out/background.js', 'utf8'))
		expect(longest <= 2000).toBe(true)

	test "--pack produit une archive nommée depuis le manifest" do
		execSync('bun run build.imba --pack', stdio: 'pipe')
		const manifest = JSON.parse(readFileSync('out/manifest.json', 'utf8'))
		const archiveName = "{manifest.name}_{manifest.version}_chrome.zip"
		expect(existsSync("releases/{archiveName}")).toBe(true)

	test "les assets sont copiés si présents" do
		if existsSync('app/assets')
			execSync('bun run build.imba', stdio: 'pipe')
			expect(existsSync('out/assets')).toBe(true)
			expect(readdirSync('out/assets').length > 0).toBe(true)
