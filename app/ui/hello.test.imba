import { test, expect, describe } from 'bun:test'
import {hello} from './hello'


describe 'hello' do

	test 'hello' do
		const res = hello!
		expect(res).toBe("Hello there!")