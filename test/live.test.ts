// Calls the production API with DATALEGION_API_KEY (the internal test key the SDKs use). Enrich
// calls bill that key's team like any other request; the utilities and /credits are free.
import { describe, expect, inject, it } from 'vitest';

import { DataLegionApi } from '../credentials/DataLegionApi.credentials';
import { liveRequest, run } from './helpers';

const key = inject('apiKey');
if (!key) {
	throw new Error(
		'Set DATALEGION_API_KEY to run the live tests (CI reads it from the repo secret).',
	);
}
const live = liveRequest(key);

describe('live API', () => {
	it("passes the credential's connection test", async () => {
		const { baseURL, url, method } = new DataLegionApi().test.request;
		const response = await fetch(`${baseURL}${url}`, { method, headers: { 'API-Key': key } });
		expect(response.status).toBe(200);
	});

	it('rejects a bad key with the API message', async () => {
		const failure = run(
			[{ resource: 'utility', operation: 'hashEmail', email: 'a@b.co' }],
			liveRequest('not-a-real-key'),
		);
		await expect(failure).rejects.toMatchObject({
			httpCode: '401',
			message: expect.stringContaining('Invalid API key'),
		});
	});

	it('enriches a company by domain', async () => {
		const [out] = await run(
			[{ resource: 'company', operation: 'enrich', identifiers: { domain: 'hubspot.com' } }],
			live,
		);
		expect(out).toMatchObject({ matched: true, domain: 'hubspot.com' });
		expect((out.match_metadata as { matched_on: string[] }).matched_on).toContain('domain');
	});

	it('enriches a person by LinkedIn URL', async () => {
		const [out] = await run(
			[
				{
					resource: 'person',
					operation: 'enrich',
					identifiers: { social_url: 'https://www.linkedin.com/in/satyanadella' },
				},
			],
			live,
		);
		expect(out.matched).toBe(true);
		expect(out.full_name).toContain('satya');
	});

	it('returns an unmatched item for a person who is not there', async () => {
		const [out] = await run(
			[
				{
					resource: 'person',
					operation: 'enrich',
					identifiers: { email: 'nobody-zz-unmatched-0001@example.invalid' },
				},
			],
			live,
		);
		expect(out).toEqual({ matched: false, _paired: { item: 0 } });
	});

	it('cleans, hashes and validates for free', async () => {
		const [cleaned, hashed, checked] = await run(
			[
				{
					resource: 'utility',
					operation: 'clean',
					fields: { phone: '(650) 253-0000' },
					defaultRegion: 'US',
				},
				{ resource: 'utility', operation: 'hashEmail', email: 'Jane.Doe@Gmail.com' },
				{ resource: 'utility', operation: 'validate', fields: { phone: '555' } },
			],
			live,
		);
		expect((cleaned.results as { phone: { cleaned: string } }).phone.cleaned).toBe('+16502530000');
		expect(hashed.normalized_email).toBe('janedoe@gmail.com');
		expect(checked.valid).toBe(false);
	});
});
