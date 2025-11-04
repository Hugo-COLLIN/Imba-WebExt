import { test, expect, describe } from 'bun:test'
import { generateManifest } from '../scripts/manifest/generator'
import fs from 'fs'

describe 'Manifest generation' do

	test 'Chrome manifest should have manifest_version 3' do
		generateManifest('chrome')
		const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'))
		expect(manifest.manifest_version).toBe(3)

	test 'Chrome should use service_worker' do
		generateManifest('chrome')
		const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'))
		expect(manifest.background.service_worker).toBeDefined!

	test 'Firefox manifest should have manifest_version 2' do
		generateManifest('firefox')
		const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'))
		expect(manifest.manifest_version).toBe(2)

	test 'Firefox should use scripts array' do
		generateManifest('firefox')
		const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'))
		expect(Array.isArray(manifest.background.scripts)).toBe(true)