import { test, expect, describe } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

describe 'Environment' do
	test 'bun:test works' do
		expect(1 + 1).toBe(2)

describe 'metadata.json' do
	test 'is valid and complete' do
		const raw = readFileSync('app/metadata.json', 'utf8')
		const m = JSON.parse(raw)
		expect(m.name.length > 0).toBe(true)
		expect(m.version.match(/^\d+\.\d+/)).not.toBeNull()
		expect(m.chrome isa Object).toBe(true)
		expect(m.firefox isa Object).toBe(true)

describe 'Generated manifest (run bun run build.imba first)' do
	const path = 'out/manifest.json'

	execSync('bun run build.imba', stdio: 'pipe')   # garantit que out/ est généré, indépendamment de l'ordre des fichiers

	test 'was generated' do
		expect(existsSync(path)).toBe(true)

	if existsSync(path)
		const m = JSON.parse(readFileSync(path, 'utf8'))

		test 'has a final manifest_version (browser blocks merged)' do
			expect([2, 3].includes(m.manifest_version)).toBe(true)
			expect(m.chrome).toBeUndefined()
			expect(m.firefox).toBeUndefined()

		test 'background references an existing compiled file' do
			const file = m.background..service_worker or (m.background..scripts or [])[0]
			expect(typeof file == 'string').toBe(true)
			expect(existsSync("out/{file}")).toBe(true)
