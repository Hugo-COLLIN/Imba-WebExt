import { test, expect, describe } from 'bun:test'
import { walkManifest, pageHtml } from '../../build.js'

describe 'walkManifest' do
	test 'réécrit le service_worker .imba et collecte l’entrée JS' do
		const manifest = { background: { service_worker: 'background.imba' } }
		const entries = []
		const out = walkManifest(manifest, entries)
		expect(out.background.service_worker).toBe('background.js')
		expect(entries.some do(e) e.source == 'app/background.imba' and e.output == 'background.js').toBe(true)

	test 'réécrit une page .imba en .html et génère le wrapper' do
		const manifest = { action: { default_popup: 'popup/popup.imba' } }
		const entries = []
		const out = walkManifest(manifest, entries)
		expect(out.action.default_popup).toBe('popup/popup.html')
		const wrapper = entries.find do(e) e.content
		expect(wrapper.output).toBe('popup/popup.html')
		expect(wrapper.content.includes('<script type="module" src="./popup.js">')).toBe(true)

	test 'wrapper HTML pointe vers le basename du JS' do
		expect(pageHtml('options/options.js').includes('./options.js')).toBe(true)

	test 'copie le CSS plain des content_scripts sans le modifier' do
		const manifest = { content_scripts: [{ js: ['content/content.imba'], css: ['styles.css'] }] }
		const entries = []
		const out = walkManifest(manifest, entries)
		expect(out.content_scripts[0].css[0]).toBe('styles.css')
		expect(entries.some do(e) e.source == 'app/styles.css' and e.output == 'styles.css').toBe(true)
		expect(out.content_scripts[0].js[0]).toBe('content/content.js')

	test 'réécrit background.scripts (MV2) sans indexer à la main' do
		const manifest = { background: { scripts: ['background.imba', 'polyfill.js'] } }
		const entries = []
		const out = walkManifest(manifest, entries)
		expect(out.background.scripts).toEqual(['background.js', 'polyfill.js'])

	test 'ne touche pas aux chemins hors clés connues' do
		const manifest = { icons: { '128': 'assets/icon.png' } }
		const entries = []
		const out = walkManifest(manifest, entries)
		expect(out.icons['128']).toBe('assets/icon.png')
		expect(entries.length).toBe(0)
