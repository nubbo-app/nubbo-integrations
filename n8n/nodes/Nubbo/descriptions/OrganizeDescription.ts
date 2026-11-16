import type { INodeProperties } from 'n8n-workflow';

import { ACTIVITY_TYPE_OPTIONS } from '../ActivityTypes';
import { clearFieldsOption, locator, paginationFields, showFor } from './shared';

export const labelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['label'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a label. Needs a key that reaches the whole space.',
				action: 'Create a label',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a label and take it off every file',
				action: 'Delete a label',
			},
			{
				name: 'Get Groups',
				value: 'getGroups',
				description: 'List the label groups of the space',
				action: 'Get label groups',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the labels of the space',
				action: 'Get many labels',
			},
			{
				name: 'Merge',
				value: 'merge',
				description: 'Merge a label into another one, which stays',
				action: 'Merge a label into another',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the name, colour, description or group of a label',
				action: 'Update a label',
			},
		],
		default: 'getAll',
	},
];

const labelFieldOptions: INodeProperties[] = [
	{
		displayName: 'Colour',
		name: 'color',
		type: 'color',
		default: '',
		description: 'A palette colour is picked when it is left out',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		default: '',
		description: 'A label group of the space (Label › Get Groups)',
	},
];

export const labelFields: INodeProperties[] = [
	locator('labelId', 'Label', 'searchLabels', showFor('label', ['delete', 'merge', 'update'])),
	locator('intoId', 'Merge Into', 'searchLabels', showFor('label', ['merge']), {
		description: 'The label that stays; files with the merged label get it',
	}),
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showFor('label', ['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('label', ['create']) },
		options: labelFieldOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('label', ['update']) },
		options: [
			...labelFieldOptions,
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			clearFieldsOption([
				{ name: 'Description', value: 'description' },
				{ name: 'Group', value: 'groupId' },
			]),
		],
	},
	...paginationFields(showFor('label', ['getAll', 'getGroups'])),
];

export const projectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['project'] } },
		options: [
			{
				name: 'Add Items',
				value: 'addItems',
				description: 'Add folders and resources to a project',
				action: 'Add items to a project',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a project with its folders and resource counts',
				action: 'Get a project',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the projects the key reaches',
				action: 'Get many projects',
			},
			{
				name: 'Remove Items',
				value: 'removeItems',
				description: 'Take folders and resources out of a project',
				action: 'Remove items from a project',
			},
		],
		default: 'getAll',
	},
];

export const projectFields: INodeProperties[] = [
	locator(
		'projectId',
		'Project',
		'searchProjects',
		showFor('project', ['addItems', 'get', 'removeItems']),
	),
	{
		displayName: 'Folders',
		name: 'folders',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Folder',
		default: {},
		displayOptions: { show: showFor('project', ['addItems', 'removeItems']) },
		options: [
			{
				displayName: 'Folder',
				name: 'folder',
				values: [
					{
						displayName: 'Bucket ID',
						name: 'bucketId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Folder Path',
						name: 'path',
						type: 'string',
						default: '',
						description: 'A folder of the bucket; empty for the whole bucket',
					},
				],
			},
		],
	},
	{
		displayName: 'Resources',
		name: 'resources',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Resource',
		default: {},
		displayOptions: { show: showFor('project', ['addItems', 'removeItems']) },
		options: [
			{
				displayName: 'Resource',
				name: 'resource',
				values: [
					{
						displayName: 'Kind',
						name: 'kind',
						type: 'options',
						options: [
							{ name: 'Automation Rule', value: 'automation' },
							{ name: 'Embed', value: 'embed' },
							{ name: 'File Request', value: 'inbox' },
							{ name: 'Gallery', value: 'gallery' },
							{ name: 'Share Link', value: 'link' },
						],
						default: 'link',
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	...paginationFields(showFor('project', ['getAll'])),
	{
		displayName: 'Filters',
		name: 'projectFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor('project', ['getAll']) },
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Archived', value: 'archived' },
				],
				default: 'active',
			},
		],
	},
];

export const activityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['activity'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List activity events, newest first',
				action: 'Get many activity events',
			},
		],
		default: 'getAll',
	},
];

export const activityFields: INodeProperties[] = [
	...paginationFields(showFor('activity', ['getAll'])),
	{
		displayName: 'Filters',
		name: 'activityFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor('activity', ['getAll']) },
		options: [
			{
				displayName: 'API Key ID',
				name: 'keyId',
				type: 'string',
				default: '',
				description: 'Only what this API key did',
			},
			{
				displayName: 'Bucket ID',
				name: 'bucketId',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Event Types',
				name: 'types',
				type: 'multiOptions',
				options: ACTIVITY_TYPE_OPTIONS,
				default: [],
				description: 'Every type when empty',
			},
		],
	},
];
