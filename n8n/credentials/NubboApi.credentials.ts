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
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.nubbo.app',
			description:
				'The address of the Nubbo API. Leave it as it is unless Nubbo tells you otherwise.',
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
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/v1/me',
			method: 'GET',
		},
	};
}
