import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

type Field = { name: string; displayName: string; description: string };

const toOptions = (fields: Field[]): INodeProperties[] =>
	fields.map((field) => ({ ...field, type: 'string', default: '' }));

export const PERSON_IDENTIFIERS: Field[] = [
	{ name: 'email', displayName: 'Email', description: 'Personal or work email address' },
	{
		name: 'phone',
		displayName: 'Phone',
		description: 'Phone number, ideally with its country code (for example +1 415 555 0100)',
	},
	{
		name: 'social_url',
		displayName: 'Social Profile URL',
		description: 'LinkedIn or other social profile URL',
	},
	{
		name: 'full_name',
		displayName: 'Full Name',
		description:
			'Full name. Add at least one more detail (company, job title, school or location) to match on a name.',
	},
	{
		name: 'first_name',
		displayName: 'First Name',
		description: 'First name, used with Last Name instead of Full Name',
	},
	{
		name: 'last_name',
		displayName: 'Last Name',
		description: 'Last name, used with First Name instead of Full Name',
	},
	{ name: 'company', displayName: 'Company', description: 'Current or past employer' },
	{ name: 'job_title', displayName: 'Job Title', description: 'Current or past job title' },
	{ name: 'school', displayName: 'School', description: 'School attended' },
	{ name: 'address', displayName: 'Address', description: 'Street address' },
	{ name: 'city', displayName: 'City', description: 'City' },
	{ name: 'state', displayName: 'State', description: 'State or region' },
	{ name: 'country', displayName: 'Country', description: 'Country' },
	{ name: 'postal_code', displayName: 'Postal Code', description: 'Postal code' },
	{ name: 'birth_date', displayName: 'Birth Date', description: 'Birth date as YYYY-MM-DD' },
	{
		name: 'email_hash',
		displayName: 'Email Hash',
		description: 'SHA-256, SHA-1 or MD5 hash of a lowercased email address',
	},
	{ name: 'linkedin_id', displayName: 'LinkedIn ID', description: 'LinkedIn member ID' },
	{
		name: 'legion_id',
		displayName: 'Data Legion ID',
		description: 'Data Legion ID from an earlier lookup',
	},
];

export const COMPANY_IDENTIFIERS: Field[] = [
	{
		name: 'domain',
		displayName: 'Domain',
		description: 'Company website domain, for example hubspot.com. The most reliable identifier.',
	},
	{ name: 'name', displayName: 'Company Name', description: 'Company name' },
	{
		name: 'social_url',
		displayName: 'Social Profile URL',
		description: 'LinkedIn or other social profile URL of the company',
	},
	{ name: 'ticker_symbol', displayName: 'Ticker Symbol', description: 'Stock ticker symbol' },
	{ name: 'linkedin_id', displayName: 'LinkedIn ID', description: 'LinkedIn company ID' },
	{
		name: 'legion_id',
		displayName: 'Data Legion ID',
		description: 'Data Legion ID from an earlier lookup',
	},
];

// The fields /utility/validate accepts; /utility/clean accepts all but address and birth_date
// (the API rejects any other name with a 400, so the operations offer exactly these).
export const DATA_FIELDS: Field[] = [
	{ name: 'email', displayName: 'Email', description: 'Email address' },
	{ name: 'phone', displayName: 'Phone', description: 'Phone number' },
	{ name: 'full_name', displayName: 'Full Name', description: 'Full name' },
	{ name: 'first_name', displayName: 'First Name', description: 'First name' },
	{ name: 'last_name', displayName: 'Last Name', description: 'Last name' },
	{
		name: 'social_url',
		displayName: 'Social Profile URL',
		description: 'LinkedIn, X, GitHub or Facebook profile URL',
	},
	{ name: 'address', displayName: 'Address', description: 'Street address' },
	{ name: 'state', displayName: 'State', description: 'State or region, as a name or a code' },
	{ name: 'country', displayName: 'Country', description: 'Country, as a name or an ISO code' },
	{ name: 'company', displayName: 'Company', description: 'Company name, website or domain' },
	{ name: 'school', displayName: 'School', description: 'School name, website or domain' },
	{ name: 'birth_date', displayName: 'Birth Date', description: 'Birth date as YYYY-MM-DD' },
	{ name: 'domain', displayName: 'Domain', description: 'Company website domain' },
	{ name: 'ticker_symbol', displayName: 'Ticker Symbol', description: 'Stock ticker symbol' },
	{
		name: 'linkedin_company_url',
		displayName: 'LinkedIn Company URL',
		description: 'LinkedIn company page URL',
	},
];

export const CLEAN_FIELDS = DATA_FIELDS.filter(
	(field) => !['address', 'birth_date'].includes(field.name),
);

export const names = (fields: Field[]) => fields.map((field) => field.name);

const op = (
	name: string,
	value: string,
	action: string,
	description: string,
): INodePropertyOptions => ({
	name,
	value,
	action,
	description,
});

const show = (resource: string, operation: string) => ({
	show: { resource: [resource], operation: [operation] },
});

export const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Company', value: 'company' },
			{ name: 'Person', value: 'person' },
			{ name: 'Utility', value: 'utility' },
		],
		default: 'person',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['person'] } },
		options: [
			op(
				'Enrich',
				'enrich',
				'Enrich a person',
				'Find a person by email, phone, social profile URL, or name plus one more detail, and return their full profile',
			),
		],
		default: 'enrich',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['company'] } },
		options: [
			op(
				'Enrich',
				'enrich',
				'Enrich a company',
				'Find a company by domain, name, social profile URL or ticker, and return its full profile',
			),
		],
		default: 'enrich',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['utility'] } },
		options: [
			op(
				'Clean Data',
				'clean',
				'Clean contact and company data',
				'Clean and normalize emails, phone numbers, names, profile URLs and domains. Free.',
			),
			op(
				'Hash Email',
				'hashEmail',
				'Hash an email address',
				'Normalize an email address and return its SHA-256, SHA-1 and MD5 hashes. Free.',
			),
			op(
				'Validate Data',
				'validate',
				'Validate contact and company data',
				'Check contact and company fields and return errors, warnings and suggested fixes. Free.',
			),
		],
		default: 'clean',
	},
	{
		displayName: 'Identifiers',
		name: 'identifiers',
		type: 'collection',
		placeholder: 'Add Identifier',
		default: {},
		description: 'What to look the person up by. Fill in at least one.',
		displayOptions: show('person', 'enrich'),
		options: toOptions(PERSON_IDENTIFIERS),
	},
	{
		displayName: 'Identifiers',
		name: 'identifiers',
		type: 'collection',
		placeholder: 'Add Identifier',
		default: {},
		description: 'What to look the company up by. Fill in at least one.',
		displayOptions: show('company', 'enrich'),
		options: toOptions(COMPANY_IDENTIFIERS),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { operation: ['enrich'] } },
		options: [
			{
				displayName: 'Minimum Match Confidence',
				name: 'min_confidence',
				type: 'options',
				options: [
					{ name: 'High', value: 'high' },
					{ name: 'Low', value: 'low' },
					{ name: 'Moderate', value: 'moderate' },
				],
				default: 'low',
				description: 'Drop matches below this confidence',
			},
			{
				displayName: 'Required Fields',
				name: 'required_fields',
				type: 'string',
				default: '',
				placeholder: 'work_email',
				description:
					'Comma-separated fields a match must have, or it counts as no match, for example work_email or phones.type:mobile',
			},
		],
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'The data to clean. Fill in at least one.',
		displayOptions: show('utility', 'clean'),
		options: toOptions(CLEAN_FIELDS),
	},
	{
		displayName: 'Default Phone Region',
		name: 'defaultRegion',
		type: 'string',
		default: '',
		placeholder: 'US',
		description: 'Two-letter country code used for phone numbers without a country code',
		displayOptions: show('utility', 'clean'),
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description: 'Email address to hash',
		displayOptions: show('utility', 'hashEmail'),
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'The data to validate. Fill in at least one.',
		displayOptions: show('utility', 'validate'),
		options: toOptions(DATA_FIELDS),
	},
];
