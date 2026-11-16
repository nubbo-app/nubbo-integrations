import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import {
	clearFieldsOption,
	expiresAtField,
	idField,
	locator,
	paginationFields,
	passwordField,
	showFor,
	statusOptions,
} from './shared';

const crudOperations = (
	resource: string,
	singular: string,
	extra: INodePropertyOptions[] = [],
): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Create',
			value: 'create',
			description: `Create a ${singular}`,
			action: `Create a ${singular}`,
		},
		{
			name: 'Delete',
			value: 'delete',
			description: `Delete a ${singular}`,
			action: `Delete a ${singular}`,
		},
		{
			name: 'Get',
			value: 'get',
			description: `Get a ${singular}`,
			action: `Get a ${singular}`,
		},
		{
			name: 'Get Many',
			value: 'getAll',
			description: `List the ${singular}s the key reaches`,
			action: `Get many ${singular}s`,
		},
		{
			name: 'Update',
			value: 'update',
			description: `Change a ${singular}`,
			action: `Update a ${singular}`,
		},
		...extra,
	].sort((a, b) => a.name.localeCompare(b.name)),
	default: 'getAll',
});

const listFilters = (resource: string, options: INodeProperties[]): INodeProperties => ({
	displayName: 'Filters',
	name: 'filters',
	type: 'collection',
	placeholder: 'Add Filter',
	default: {},
	displayOptions: { show: showFor(resource, ['getAll']) },
	options,
});

const bucketIdFilter: INodeProperties = {
	displayName: 'Bucket ID',
	name: 'bucketId',
	type: 'string',
	default: '',
};

const statusFilter: INodeProperties = {
	displayName: 'Status',
	name: 'status',
	type: 'options',
	options: statusOptions,
	default: 'active',
};

const activeField = (description: string): INodeProperties => ({
	displayName: 'Active',
	name: 'active',
	type: 'boolean',
	default: true,
	description,
});

export const linkOperations: INodeProperties[] = [crudOperations('link', 'share link')];

const linkOptions: INodeProperties[] = [
	expiresAtField,
	{
		displayName: 'Max Downloads',
		name: 'maxDownloads',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 1,
	},
	passwordField('Visitors need it to open the link (4 to 50 characters)'),
];

export const linkFields: INodeProperties[] = [
	idField('linkId', 'Link ID', showFor('link', ['delete', 'get', 'update'])),
	idField(
		'fileId',
		'File or Folder ID',
		showFor('link', ['create']),
		'The file or folder to share',
	),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('link', ['create']) },
		options: linkOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('link', ['update']) },
		options: [
			activeField('Whether the link works; false pauses it'),
			...linkOptions,
			clearFieldsOption([
				{ name: 'Expiry', value: 'expiresAt' },
				{ name: 'Max Downloads', value: 'maxDownloads' },
				{ name: 'Password', value: 'password' },
			]),
		],
	},
	...paginationFields(showFor('link', ['getAll'])),
	listFilters('link', [
		bucketIdFilter,
		{
			displayName: 'File or Folder ID',
			name: 'fileId',
			type: 'string',
			default: '',
			description: 'Only the links of this file or folder',
		},
		statusFilter,
	]),
];

export const inboxOperations: INodeProperties[] = [
	crudOperations('inbox', 'file request', [
		{
			name: 'Get Uploads',
			value: 'getUploads',
			description: 'List the files a file request received',
			action: 'Get the uploads of a file request',
		},
	]),
];

const visitorIdentityField: INodeProperties = {
	displayName: 'Ask Senders Who They Are',
	name: 'visitorIdentity',
	type: 'options',
	options: [
		{ name: 'Required', value: 'required' },
		{ name: 'Optional', value: 'optional' },
		{ name: 'No', value: 'none' },
	],
	default: 'optional',
	description: 'Whether senders give their name and email',
};

const inboxOptions: INodeProperties[] = [
	{
		displayName: 'Allowed File Types',
		name: 'allowedFileTypes',
		type: 'string',
		default: '',
		placeholder: '.pdf, .jpg',
		description: 'File extensions accepted, separated by commas; empty accepts every type',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
	},
	expiresAtField,
	{
		displayName: 'Max File Size (Bytes)',
		name: 'maxFileSize',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 104857600,
	},
	{
		displayName: 'Max Uploads',
		name: 'maxUploads',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 10,
	},
	passwordField('Senders need it to open the file request (4 to 50 characters)'),
	visitorIdentityField,
];

export const inboxFields: INodeProperties[] = [
	idField(
		'inboxId',
		'File Request ID',
		showFor('inbox', ['delete', 'get', 'getUploads', 'update']),
	),
	locator('bucketId', 'Bucket', 'searchBuckets', showFor('inbox', ['create'])),
	{
		displayName: 'Folder Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: 'incoming/',
		description: 'The folder uploads land in; empty for the root of the bucket',
		displayOptions: { show: showFor('inbox', ['create']) },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showFor('inbox', ['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('inbox', ['create']) },
		options: inboxOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('inbox', ['update']) },
		options: [
			activeField('Whether the file request accepts files; false closes it'),
			...inboxOptions,
			{
				displayName: 'Folder Path',
				name: 'path',
				type: 'string',
				default: '',
				description: 'The folder uploads land in; empty for the root of the bucket',
			},
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			clearFieldsOption([
				{ name: 'Description', value: 'description' },
				{ name: 'Expiry', value: 'expiresAt' },
				{ name: 'Max File Size', value: 'maxFileSize' },
				{ name: 'Max Uploads', value: 'maxUploads' },
				{ name: 'Password', value: 'password' },
			]),
		],
	},
	...paginationFields(showFor('inbox', ['getAll', 'getUploads'])),
	listFilters('inbox', [bucketIdFilter, statusFilter]),
];

export const galleryOperations: INodeProperties[] = [crudOperations('gallery', 'gallery')];

const galleryOptions: INodeProperties[] = [
	{
		displayName: 'Cover File ID',
		name: 'coverFileId',
		type: 'string',
		default: '',
		description: 'A file inside the gallery folder',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
	},
	expiresAtField,
	{
		displayName: 'Individual Downloads',
		name: 'individualDownloads',
		type: 'boolean',
		default: true,
		description: 'Whether visitors can download single files',
	},
	{
		displayName: 'Layout',
		name: 'layout',
		type: 'options',
		options: [
			{ name: 'Grid', value: 'grid' },
			{ name: 'Masonry', value: 'masonry' },
			{ name: 'Slideshow', value: 'slideshow' },
		],
		default: 'masonry',
	},
	passwordField('Visitors need it to open the gallery (4 to 50 characters)'),
	{
		displayName: 'Watermark Text',
		name: 'watermarkText',
		type: 'string',
		default: '',
		description: 'A text watermark on the photos',
	},
	{
		displayName: 'ZIP Download',
		name: 'zipDownload',
		type: 'boolean',
		default: false,
		description: 'Whether visitors can download everything as a ZIP',
	},
];

export const galleryFields: INodeProperties[] = [
	idField('galleryId', 'Gallery ID', showFor('gallery', ['delete', 'get', 'update'])),
	idField(
		'fileId',
		'Folder ID',
		showFor('gallery', ['create']),
		'The folder whose photos and videos the gallery shows',
	),
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showFor('gallery', ['create']) },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('gallery', ['create']) },
		options: galleryOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('gallery', ['update']) },
		options: [
			activeField('Whether the gallery works; false pauses it'),
			...galleryOptions,
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			clearFieldsOption([
				{ name: 'Cover', value: 'coverFileId' },
				{ name: 'Description', value: 'description' },
				{ name: 'Expiry', value: 'expiresAt' },
				{ name: 'Password', value: 'password' },
				{ name: 'Watermark', value: 'watermarkText' },
			]),
		],
	},
	...paginationFields(showFor('gallery', ['getAll'])),
	listFilters('gallery', [bucketIdFilter, statusFilter]),
];

export const embedOperations: INodeProperties[] = [crudOperations('embed', 'embed')];

const embedOptions: INodeProperties[] = [
	{
		displayName: 'Allowed Domains',
		name: 'allowedDomains',
		type: 'string',
		default: '',
		placeholder: 'example.com, shop.example.com',
		description: 'Sites allowed to show the embed, separated by commas; empty allows any site',
	},
	{
		displayName: 'Configuration (JSON)',
		name: 'config',
		type: 'json',
		default: '{}',
		description:
			'The look and behaviour of the embed, as the builder in Nubbo saves it. Anything left out keeps the default of the kind.',
	},
	expiresAtField,
	{ displayName: 'Name', name: 'name', type: 'string', default: '' },
	passwordField('Explorer embeds only (4 to 128 characters)'),
	{
		displayName: 'Paused',
		name: 'paused',
		type: 'boolean',
		default: false,
		description: 'Whether the embed is paused',
	},
];

export const embedFields: INodeProperties[] = [
	idField('embedId', 'Embed ID', showFor('embed', ['delete', 'get', 'update'])),
	{
		displayName: 'Kind',
		name: 'kind',
		type: 'options',
		options: [
			{
				name: 'Explorer',
				value: 'explorer',
				description: 'Browse a bucket or a folder',
			},
			{
				name: 'File Request',
				value: 'inbox',
				description: 'Receive files through a file request',
			},
			{
				name: 'Share Link',
				value: 'shared',
				description: 'Show a shared file or folder',
			},
		],
		default: 'explorer',
		displayOptions: { show: showFor('embed', ['create']) },
	},
	{
		...idField('inboxId', 'File Request ID', showFor('embed', ['create'])),
		displayOptions: { show: { ...showFor('embed', ['create']), kind: ['inbox'] } },
	},
	{
		...idField('linkId', 'Link ID', showFor('embed', ['create'])),
		displayOptions: { show: { ...showFor('embed', ['create']), kind: ['shared'] } },
	},
	{
		...locator('bucketId', 'Bucket', 'searchBuckets', showFor('embed', ['create'])),
		displayOptions: { show: { ...showFor('embed', ['create']), kind: ['explorer'] } },
	},
	{
		displayName: 'Folder Path',
		name: 'path',
		type: 'string',
		default: '',
		description: 'The folder shown; empty for the whole bucket',
		displayOptions: { show: { ...showFor('embed', ['create']), kind: ['explorer'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('embed', ['create']) },
		options: embedOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('embed', ['update']) },
		options: [
			...embedOptions,
			clearFieldsOption([
				{ name: 'Expiry', value: 'expiresAt' },
				{ name: 'Password', value: 'password' },
			]),
		],
	},
	...paginationFields(showFor('embed', ['getAll'])),
	listFilters('embed', [
		{
			displayName: 'Kind',
			name: 'kind',
			type: 'options',
			options: [
				{ name: 'Explorer', value: 'explorer' },
				{ name: 'File Request', value: 'inbox' },
				{ name: 'Share Link', value: 'shared' },
			],
			default: 'explorer',
		},
		statusFilter,
	]),
];
