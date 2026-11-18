import { defineConfig } from 'vitest/config';

// The live tests read the API key through inject('apiKey'): n8n's linter bans `process` in any
// .ts file of a community node package, tests included, and this file is not .ts.
export default defineConfig({
	// Load n8n-workflow's CommonJS build natively, as n8n itself loads community nodes. Its ESM
	// build uses extensionless imports Node cannot load, so Vite had to transform it, and its
	// sourcemaps name sources the package does not publish: 100+ warnings on every run.
	resolve: { alias: [{ find: /^n8n-workflow$/, replacement: 'n8n-workflow/dist/cjs/index.js' }] },
	test: {
		provide: { apiKey: process.env.DATALEGION_API_KEY ?? '' },
		include: ['test/**/*.test.{ts,mjs,mts}'],
		// One limit for the suite, to catch a hang: the package test builds and packs the node, which
		// took 5.4s on a CI runner against the 5s default (2026-11-18).
		testTimeout: 30_000,
	},
});

declare module 'vitest' {
	export interface ProvidedContext {
		apiKey: string;
	}
}
