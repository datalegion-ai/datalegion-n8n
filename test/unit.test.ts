import type { IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { compact, errorMessage } from '../nodes/DataLegion/transport';
import { type Request, run } from './helpers';

const reply =
	(statusCode: number, body: unknown, seen: IHttpRequestOptions[] = []): Request =>
	async (options) => {
		seen.push(options);
		return { statusCode, body };
	};

const person = { legion_id: 'p1', full_name: 'jane doe' };

describe('enrich', () => {
	it('posts only the filled identifiers and options, trimmed', async () => {
		const seen: IHttpRequestOptions[] = [];
		const [out] = await run(
			[
				{
					resource: 'person',
					operation: 'enrich',
					identifiers: { email: ' jane@example.com ', phone: '', company: 'Acme' },
					options: { min_confidence: 'high', required_fields: '' },
				},
			],
			reply(200, { matches: [{ person, match_metadata: { matched_on: ['email'] } }] }, seen),
		);
		expect(seen[0]).toMatchObject({
			method: 'POST',
			url: 'https://api.datalegion.ai/person/enrich',
			body: { email: 'jane@example.com', company: 'Acme', min_confidence: 'high' },
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
		});
		expect(out).toMatchObject({
			matched: true,
			...person,
			match_metadata: { matched_on: ['email'] },
		});
	});

	it('turns a 404 into an unmatched item and keeps the item pairing', async () => {
		const out = await run(
			[
				{ resource: 'company', operation: 'enrich', identifiers: { domain: 'nothing.invalid' } },
				{ resource: 'company', operation: 'enrich', identifiers: { domain: 'nothing2.invalid' } },
			],
			reply(404, { error: 'not_found', message: 'No match' }),
		);
		expect(out).toEqual([
			{ matched: false, _paired: { item: 0 } },
			{ matched: false, _paired: { item: 1 } },
		]);
	});

	it('refuses an item with no identifier before calling the API', async () => {
		const seen: IHttpRequestOptions[] = [];
		await expect(
			run(
				[{ resource: 'person', operation: 'enrich', identifiers: { email: '  ' } }],
				reply(200, {}, seen),
			),
		).rejects.toThrow('Add at least one person identifier.');
		expect(seen).toHaveLength(0);
	});

	it('ignores identifiers that belong to the other entity', async () => {
		const seen: IHttpRequestOptions[] = [];
		await run(
			[
				{
					resource: 'company',
					operation: 'enrich',
					identifiers: { domain: 'acme.com', email: 'x@y.z' },
				},
			],
			reply(200, { matches: [] }, seen),
		);
		expect(seen[0].body).toEqual({ domain: 'acme.com' });
	});

	it("raises the API's own message with a hint", async () => {
		const failure = run(
			[{ resource: 'person', operation: 'enrich', identifiers: { email: 'a@b.co' } }],
			reply(402, { error: 'insufficient_credits', message: 'Out of credits' }),
		);
		await expect(failure).rejects.toMatchObject({
			message: 'Out of credits',
			httpCode: '402',
			description: expect.stringContaining('Add credits'),
		});
	});

	it('keeps going when Continue On Fail is on', async () => {
		const out = await run(
			[{ resource: 'person', operation: 'enrich', identifiers: { email: 'a@b.co' } }],
			reply(401, { error: 'unauthorized', message: 'Invalid API key' }),
			{ continueOnFail: true },
		);
		expect(out).toEqual([{ error: 'Invalid API key', _paired: { item: 0 } }]);
	});

	it('wraps a network failure in a node error', async () => {
		const failure = run(
			[{ resource: 'person', operation: 'enrich', identifiers: { email: 'a@b.co' } }],
			() => Promise.reject(new Error('getaddrinfo ENOTFOUND')),
		);
		await expect(failure).rejects.toMatchObject({ name: 'NodeApiError' });
	});
});

describe('utilities', () => {
	it('cleans with the default region and only the clean fields', async () => {
		const seen: IHttpRequestOptions[] = [];
		await run(
			[
				{
					resource: 'utility',
					operation: 'clean',
					fields: { phone: '(650) 253-0000', address: '1 Main St' },
					defaultRegion: 'US',
				},
			],
			reply(200, { results: {} }, seen),
		);
		expect(seen[0]).toMatchObject({
			url: 'https://api.datalegion.ai/utility/clean',
			body: { default_region: 'US', fields: { phone: '(650) 253-0000' } },
		});
	});

	it('leaves the region out when blank', async () => {
		const seen: IHttpRequestOptions[] = [];
		await run(
			[
				{
					resource: 'utility',
					operation: 'clean',
					fields: { email: 'a@b.co' },
					defaultRegion: ' ',
				},
			],
			reply(200, {}, seen),
		);
		expect(seen[0].body).toEqual({ fields: { email: 'a@b.co' } });
	});

	it('hashes a trimmed email', async () => {
		const seen: IHttpRequestOptions[] = [];
		await run(
			[{ resource: 'utility', operation: 'hashEmail', email: ' Jane@x.com ' }],
			reply(200, {}, seen),
		);
		expect(seen[0]).toMatchObject({
			url: 'https://api.datalegion.ai/utility/hash/email',
			body: { email: 'Jane@x.com' },
		});
	});

	it('validates the fields as the body, address included', async () => {
		const seen: IHttpRequestOptions[] = [];
		const [out] = await run(
			[
				{
					resource: 'utility',
					operation: 'validate',
					fields: { phone: '555', address: '1 Main St' },
				},
			],
			reply(200, { valid: false }, seen),
		);
		expect(seen[0]).toMatchObject({
			url: 'https://api.datalegion.ai/utility/validate',
			body: { phone: '555', address: '1 Main St' },
		});
		expect(out.valid).toBe(false);
	});

	it('refuses an empty field set', async () => {
		await expect(
			run([{ resource: 'utility', operation: 'validate', fields: {} }], reply(200, {})),
		).rejects.toThrow('Add at least one field.');
	});
});

describe('errorMessage', () => {
	it.each([
		[{ error: 'x', message: 'Plain' }, 'Plain'],
		[{ detail: 'Detail string' }, 'Detail string'],
		[{ detail: [{ msg: 'one' }, { msg: 'two' }] }, 'one; two'],
		[{ detail: { error: 'x', message: 'Nested' } }, 'Nested'],
		[{}, 'Data Legion returned HTTP 500.'],
		['Bad Gateway', 'HTTP 500: Bad Gateway'],
		['<html>oops</html>', 'Data Legion returned HTTP 500.'],
	])('%j -> %s', (body, expected) => {
		expect(errorMessage(500, body)).toBe(expected);
	});
});

describe('compact', () => {
	it('drops blanks and trims strings, keeping other types', () => {
		expect(
			compact({ a: ' x ', b: '', c: null, d: 0, e: false }, ['a', 'b', 'c', 'd', 'e', 'f']),
		).toEqual({
			a: 'x',
			d: 0,
			e: false,
		});
	});
});
