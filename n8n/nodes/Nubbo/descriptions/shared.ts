import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export type Show = Record<string, string[]>;

export const showFor = (resource: string, operations: string[]): Show => ({
	resource: [resource],
	operation: operations,
});

export const locator = (
	name: string,
	displayName: string,
	searchListMethod: string,
	show: Show,
	options: Partial<INodeProperties> = {},
): INodeProperties => ({
	displayName,
	name,
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod, searchable: true },
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
		},
	],
	displayOptions: { show },
	...options,
});

export const idField = (
	name: string,
	displayName: string,
	show: Show,
	description?: string,
): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	required: true,
	default: '',
	placeholder: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
	description,
	displayOptions: { show },
});

export const paginationFields = (show: Show): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { ...show, returnAll: [false] } },
	},
];

export const statusOptions: INodePropertyOptions[] = [
	{ name: 'Active', value: 'active' },
	{ name: 'Expired', value: 'expired' },
	{ name: 'Paused', value: 'paused' },
];

export const expiresAtField: INodeProperties = {
	displayName: 'Expires At',
	name: 'expiresAt',
	type: 'dateTime',
	default: '',
};

export const passwordField = (description: string): INodeProperties => ({
	displayName: 'Password',
	name: 'password',
	type: 'string',
	typeOptions: { password: true },
	default: '',
	description,
});

export const clearFieldsOption = (options: INodePropertyOptions[]): INodeProperties => ({
	displayName: 'Clear Fields',
	name: 'clearFields',
	type: 'multiOptions',
	options,
	default: [],
	description: 'Fields to remove from the item. A field set above and cleared here is cleared.',
});
