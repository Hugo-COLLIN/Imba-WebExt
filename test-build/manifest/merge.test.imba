import { test, expect, describe } from 'bun:test'
import { smartMerge, cleanEmptyProperties } from '../../build.js'

describe 'smartMerge' do
	test 'fusionne les objets de base' do
		const result = smartMerge({ a: 1, b: 2 }, { b: 3, c: 4 })
		expect(result.a).toBe(1)
		expect(result.b).toBe(3)
		expect(result.c).toBe(4)

	test 'concatène et déduplique les tableaux' do
		const target = { perms: ['tabs', 'downloads'] }
		const source = { perms: ['tabs', 'webRequest'] }
		const result = smartMerge(target, source)
		expect(result.perms).toEqual(['tabs', 'downloads', 'webRequest'])

	test 'fusionne récursivement les objets imbriqués' do
		const target = { bg: { service_worker: 'bg.js' } }
		const source = { bg: { type: 'module' } }
		const result = smartMerge(target, source)
		expect(result.bg.service_worker).toBe('bg.js')
		expect(result.bg.type).toBe('module')

describe 'cleanEmptyProperties' do
	test 'supprime les clés null et undefined' do
		const obj = { a: 1, b: null, c: undefined }
		cleanEmptyProperties(obj)
		expect(Object.keys(obj)).toEqual(['a'])

	test 'supprime les objets vides récursivement' do
		const obj = { a: 1, b: { x: null, y: {} } }
		cleanEmptyProperties(obj)
		expect(Object.keys(obj)).toEqual(['a'])

	test 'préserve les tableaux vides (cas légitime)' do
		const obj = { a: 1, b: [] }
		cleanEmptyProperties(obj)
		expect(Object.keys(obj)).toEqual(['a', 'b'])
