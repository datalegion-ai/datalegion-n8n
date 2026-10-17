import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { duplicateTestBodies, silentTests, swallowingTests } from './_conventions.mts';

// The fleet's test conventions (`_conventions.ts`, a byte-identical copy of the website repository's
// __tests__/_conventions.ts): every test can fail, none swallows an error, none repeats
// another's body.
const root = fileURLToPath(new URL('..', import.meta.url));

describe('test conventions', () => {
	it('every test can fail', () => {
		expect(silentTests(root)).toEqual([]);
	});

	it('no test swallows an error', () => {
		expect(swallowingTests(root)).toEqual([]);
	});

	it('no two tests share a body', () => {
		expect(duplicateTestBodies(root)).toEqual([]);
	});
});
