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

// No real person in the code: the person enrich check reads the sandbox record (every field, no one's
// data), and the input checks only need the API to accept the value (a match or not), so they use a
// made-up person.
const MADE_UP_PROFILE = 'https://www.linkedin.com/in/jane-exampleton-0001';

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

	it('returns sample records in Sandbox Mode', async () => {
		const [out] = await run(
			[{ resource: 'person', operation: 'enrich', identifiers: { email: 'anyone@example.org' } }],
			live,
			{ sandbox: true },
		);
		expect(out).toMatchObject({ matched: true });
		expect(out.legion_id).toMatch(/^sandbox_/);
	});

	it('enriches a company by domain', async () => {
		const [out] = await run(
			[{ resource: 'company', operation: 'enrich', identifiers: { domain: 'hubspot.com' } }],
			live,
		);
		expect(out).toMatchObject({ matched: true, domain: 'hubspot.com' });
		expect((out.match_metadata as { matched_on: string[] }).matched_on).toContain('domain');
	});

	// Every value the help suggests is one the API accepts: a 400 would fail the item.
	it.each([
		['person', { social_url: MADE_UP_PROFILE }, { required_fields: 'work_email' }],
		['person', { social_url: MADE_UP_PROFILE }, { required_fields: 'phones.type:mobile' }],
		['person', { full_name: 'Jane Exampleton', birth_date: '1967' }, {}],
		['person', { full_name: 'Jane Exampleton', birth_date: '1967-08' }, {}],
		['company', { domain: 'hubspot.com' }, { required_fields: 'domain,socials' }],
		['company', { domain: 'hubspot.com' }, { required_fields: 'type:public' }],
		['company', { domain: 'hubspot.com' }, { required_fields: 'socials.network:linkedin' }],
		['company', { name: 'HubSpot' }, { industry: 'software development' }],
	] as const)('accepts the %s example %j %j', async (resource, identifiers, options) => {
		const [out] = await run([{ resource, operation: 'enrich', identifiers, options }], live);
		expect(out).toHaveProperty('matched');
	});

	it('enriches a person by LinkedIn URL', async () => {
		const [out] = await run(
			[{ resource: 'person', operation: 'enrich', identifiers: { social_url: MADE_UP_PROFILE } }],
			live,
			{ sandbox: true },
		);
		expect(out.matched).toBe(true);
		expect(out.legion_id).toMatch(/^sandbox_/);
		expect(out.full_name).toEqual(expect.any(String));
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
