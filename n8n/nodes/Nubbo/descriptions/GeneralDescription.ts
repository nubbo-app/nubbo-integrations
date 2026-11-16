import type { INodeProperties } from 'n8n-workflow';

import { idField, paginationFields, showFor } from './shared';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the space, plan, key and quota of the API key',
				action: 'Get the account of the API key',
			},
		],
		default: 'get',
	},
];

export const bucketOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['bucket'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the buckets the key reaches',
				action: 'Get many buckets',
			},
		],
		default: 'getAll',
	},
];

export const bucketFields: INodeProperties[] = [...paginationFields(showFor('bucket', ['getAll']))];

export const operationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['operation'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the state of a move that runs in the background',
				action: 'Get a background operation',
			},
		],
		default: 'get',
	},
];

export const operationFields: INodeProperties[] = [
	idField(
		'operationId',
		'Operation ID',
		showFor('operation', ['get']),
		'The operationId a move or rename answered with',
	),
];
