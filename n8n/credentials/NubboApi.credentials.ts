import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class NubboApi implements ICredentialType {
	name = 'nubboApi';

	displayName = 'Nubbo API';

	icon: Icon = { light: 'file:../icons/nubbo.svg', dark: 'file:../icons/nubbo.svg' };

	documentationUrl = 'https://github.com/nubbo-app/nubbo-integrations/tree/main/n8n#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'nbk_…',
			description:
				'An API key from Settings › API (Pro) or Team › API (Teams) in Nubbo. It is shown once, when you create it.',
		},
		{
			displayName: 'Environment',
			name: 'baseUrl',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'https://api.nubbo.app',
					description: 'Nubbo at nubbo.app',
				},
				{
					name: 'Development (Testing Only)',
					value: 'https://dev.api.nubbo.app',
					description: 'The Nubbo test environment; not for real workflows',
				},
			],
			default: 'https://api.nubbo.app',
			description: 'The Nubbo API to connect to. Use Production.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 401,
					message: 'The API key is not valid, or it was revoked or has expired',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 403,
					message:
						'This key cannot use the API now: the API comes with Pro and Teams, and the space must be active',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 410,
					message: 'The Nubbo account that owns this space is scheduled for deletion',
				},
			},
		],
	};
}
