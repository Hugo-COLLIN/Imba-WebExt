import { test, expect, describe } from 'bun:test'

# Locale replica of the build flags factory.
# Importing build.imba from here would execute it : keep the logic local,
# aligned with the fix: Firefox is NEVER minified (AMO review).

def makeFlags(browser, prodMode, watchMode)
	let flags = ' --target browser'
	flags += ' --watch' if watchMode
	const minify = prodMode and browser != 'firefox'
	flags += ' --no-minify' unless minify
	flags += ' --sourcemap external' unless prodMode
	return flags

# Safe Imba style: do() callbacks, includes() + toBe,
# no arrow functions, no chained .not matchers.

describe "Flags de build" do
	test "dev chrome : lisible + sourcemap" do
		const flags = makeFlags('chrome', false, false)
		expect(flags.includes('--no-minify')).toBe(true)
		expect(flags.includes('--sourcemap external')).toBe(true)
		expect(flags.includes('--watch')).toBe(false)

	test "dev firefox : non minifié aussi" do
		const flags = makeFlags('firefox', false, false)
		expect(flags.includes('--no-minify')).toBe(true)
		expect(flags.includes('--sourcemap external')).toBe(true)

	test "prod chrome : minifié, sans sourcemap" do
		const flags = makeFlags('chrome', true, false)
		expect(flags.includes('--no-minify')).toBe(false)
		expect(flags.includes('--sourcemap external')).toBe(false)

	test "prod firefox : jamais minifié (review AMO)" do
		const flags = makeFlags('firefox', true, false)
		expect(flags.includes('--no-minify')).toBe(true)
		expect(flags.includes('--sourcemap external')).toBe(false)

	test "--watch ajoute le flag dans tous les modes" do
		expect(makeFlags('chrome', false, true).includes('--watch')).toBe(true)
		expect(makeFlags('firefox', true, true).includes('--watch')).toBe(true)
