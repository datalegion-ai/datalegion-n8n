import { defineConfig } from 'vitest/config';

// The live tests read the API key through inject('apiKey'): n8n's linter bans `process` in any
// .ts file of a community node package, tests included, and this file is not .ts.
export default defineConfig({
	test: {
		provide: { apiKey: process.env.DATALEGION_API_KEY ?? '' },
		include: ['test/**/*.test.{ts,mjs}'],
	},
});

declare module 'vitest' {
	export interface ProvidedContext {
		apiKey: string;
	}
}
