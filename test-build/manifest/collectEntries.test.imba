import { test, expect, describe } from 'bun:test'
import { existsSync } from 'fs'

# Copie de la fonction collectEntries de build.imba
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

describe "collectEntries" do
	test "extrait le service_worker (MV3)" do
		const manifest = {
			background: { service_worker: 'background.js' }
		}
		const entries = collectEntries(manifest)
		expect(entries).toContain('background.js')

	test "extrait les scripts (MV2/Firefox)" do
		const manifest = {
			background: { scripts: ['background.js', 'polyfill.js'] }
		}
		const entries = collectEntries(manifest)
		expect(entries).toContain('background.js')
		expect(entries).toContain('polyfill.js')

	test "extrait les content_scripts (js + css)" do
		const manifest = {
			content_scripts: [
				{ js: ['content.js'], css: ['styles.css'] }
			]
		}
		const entries = collectEntries(manifest)
		expect(entries).toContain('content.js')
		expect(entries).toContain('styles.css')

	test "ajoute le compagnon .imba des pages HTML s'il existe" do
		# Ce test suppose que app/options.imba existe
		const manifest = {
			options_ui: { page: 'options.html' }
		}
		const entries = collectEntries(manifest)
		if existsSync('app/options.imba')
			expect(entries).toContain('options.js')

	test "déduplique les entrées" do
		const manifest = {
			background: { service_worker: 'bg.js', scripts: ['bg.js'] }
		}
		const entries = collectEntries(manifest)
		const matches = entries.filter do(e) e == 'bg.js'
		expect(matches.length).toBe(1)
