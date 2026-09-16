import { test, expect, describe } from 'bun:test'

# Mock des fonctions à tester (copié-collé de build.imba pour isolation)
def smartMerge(target, source)
	const result = { ...target }
	for own key, value of source
		if Array.isArray(result[key]) and Array.isArray(value)
			result[key] = [...new Set([...result[key], ...value])]
		elif result[key] isa Object and value isa Object
			result[key] = smartMerge(result[key], value)
		else
			result[key] = value
	return result

def cleanEmptyProperties(obj)
	for own key, value of obj
		if value == null
			delete obj[key]
		elif value isa Object and !Array.isArray(value)
			cleanEmptyProperties(value)
			delete obj[key] if Object.keys(value).length == 0

describe 'smartMerge' do
	test 'fusionne les objets de base' do
		const target = { a: 1, b: 2 }
		const source = { b: 3, c: 4 }
		const result = smartMerge(target, source)
		expect(result.a).toBe(1)
		expect(result.b).toBe(3)
		expect(result.c).toBe(4)

	test 'concaté§§ne et déduplique les tableaux' do
		const target = { perms: ['tabs', 'downloads'] }
		const source = { perms: ['tabs', 'webRequest'] }
		const result = smartMerge(target, source)
		expect(result.perms).toEqual(['tabs', 'downloads', 'webRequest'])

	test 'fusionne récursivement les objets imbriqu' do
		const target = { bg: { service_worker: 'bg.js' } }
		const source = { bg: { type: 'module' } }
		const result = smartMerge(target, source)
		expect(result.bg.service_worker).toBe('bg.js')
		expect(result.bg.type).toBe('module')

describe 'cleanEmptyProperties' do
	test 'supprime les clés null et undefined' do
		const obj = { a: 1, b: null, c: undefined }
		cleanEmptyProperties(obj)
		expect(obj.b).toBeUndefined()
		expect(obj.c).toBeUndefined()
		expect(Object.keys(obj)).toEqual(['a'])

	test 'supprime les objets vides récursivement' do
		const obj = { a: 1, b: { x: null, y: {} } }
		cleanEmptyProperties(obj)
		expect(obj.b).toBeUndefined()
		expect(Object.keys(obj)).toEqual(['a'])

	test 'pré§§serve les tableaux vides (cas légitime)' do
		const obj = { a: 1, b: [] }
		cleanEmptyProperties(obj)
		expect(obj.b).toEqual([])
		expect(Object.keys(obj)).toEqual(['a', 'b'])