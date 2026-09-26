// Minimal Imba loader for Bun, vendored from bimba-cli (MIT).
// bunfig.toml preloads this file so Bun can run build.imba itself.
import { plugin } from 'bun'
import * as compiler from 'imba/compiler'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'

// 'browser' for the extension build, 'node' for tests transpilation
export let target = 'browser'
export function setTarget(t) { target = t }

export const imbaPlugin = {
	name: 'imba',
	setup(build) {
		// Resolve extensionless relative imports to .imba files (import './file').
		// Bun's default resolver only tries .js/.ts/.jsx/.tsx/.json
		build.onResolve({ filter: /^\.\.?\// }, ({ path: spec, importer }) => {
			const base = resolve(dirname(importer || '.'), spec)
			for (const candidate of [base + '.imba', base + '/index.imba']) {
				if (existsSync(candidate)) return { path: candidate }
			}
		})

		build.onLoad({ filter: /\.imba$/ }, async ({ path }) => {
			const source = await Bun.file(path).text()
			let out
			try {
				out = compiler.compile(source, {
					sourcePath: path,
					platform: target === 'browser' ? 'browser' : 'node',
					comments: false
				})
			} catch (err) {
				out = { js: '', errors: [err] }
			}
			if (out.errors?.length) {
				for (const e of out.errors) if (e) console.error(e.message)
				throw new Error(`imba compile failed: ${path}`)
			}
			return { contents: out.js, loader: 'js' }
		})
	}
}

// Self-register so `bun run build.imba` works; double registration
// (preload + import in build.imba) is tolerated.
try {
	plugin(imbaPlugin)
} catch (e) {
	// already registered by bunfig preload
}
