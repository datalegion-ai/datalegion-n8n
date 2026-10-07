// Pins what the npm tarball ships: the built node and credential, their icons, the docs and the
// license. Nothing else (sources, tests, the build cache or agent files) may leak into it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('package', () => {
	it('ships exactly the built node, credential, docs and license', () => {
		execFileSync('npm', ['run', 'build'], { stdio: 'ignore' });
		const packed = JSON.parse(
			execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
				encoding: 'utf8',
			}),
		);
		// npm 11 prints an array of packages, npm 12 an object keyed by package name.
		const [{ files }] = Array.isArray(packed) ? packed : Object.values(packed);
		const paths = files.map((f) => f.path).filter((p) => !p.endsWith('.map'));
		expect(paths.sort()).toEqual(
			[
				'LICENSE',
				'README.md',
				'package.json',
				'dist/package.json',
				'dist/credentials/DataLegionApi.credentials.d.ts',
				'dist/credentials/DataLegionApi.credentials.js',
				'dist/credentials/datalegion.dark.svg',
				'dist/credentials/datalegion.svg',
				'dist/nodes/DataLegion/DataLegion.node.d.ts',
				'dist/nodes/DataLegion/DataLegion.node.js',
				'dist/nodes/DataLegion/DataLegion.node.json',
				'dist/nodes/DataLegion/datalegion.dark.svg',
				'dist/nodes/DataLegion/datalegion.svg',
				'dist/nodes/DataLegion/descriptions.d.ts',
				'dist/nodes/DataLegion/descriptions.js',
				'dist/nodes/DataLegion/transport.d.ts',
				'dist/nodes/DataLegion/transport.js',
			].sort(),
		);
	});

	// npm refuses provenance for a new package unless access is public (the first publish failed
	// on exactly that), and n8n verification needs provenance.
	it('publishes publicly with provenance', () => {
		expect(pkg.publishConfig).toEqual({ access: 'public', provenance: true });
	});

	it('has no runtime dependencies (an n8n verification rule)', () => {
		expect(pkg.dependencies ?? {}).toEqual({});
	});

	it('registers every node and credential it builds', () => {
		expect(pkg.n8n.nodes).toEqual(['dist/nodes/DataLegion/DataLegion.node.js']);
		expect(pkg.n8n.credentials).toEqual(['dist/credentials/DataLegionApi.credentials.js']);
	});
});
