import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DataLegionApi implements ICredentialType {
	name = 'dataLegionApi';

	displayName = 'Data Legion API';

	icon: Icon = { light: 'file:datalegion.svg', dark: 'file:datalegion.dark.svg' };

	documentationUrl = 'https://www.datalegion.ai/docs/introduction';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Data Legion API key, from API Keys in the Data Legion dashboard (https://www.datalegion.ai/dashboard/api-keys)',
		},
	];

	// Trimmed: a key pasted with a stray space or newline would otherwise fail as "invalid".
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'API-Key': '={{ $credentials.apiKey.trim() }}',
			},
		},
	};

	// GET /credits is free (rate-limited, never billed) and answers for any key, whatever
	// endpoints it is scoped to.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.datalegion.ai',
			url: '/credits',
			method: 'GET',
		},
	};
}
