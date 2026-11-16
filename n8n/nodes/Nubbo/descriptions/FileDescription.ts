import type { INodeProperties } from 'n8n-workflow';

import { idField, locator, paginationFields, showFor } from './shared';

const fileIdsField = (resource: string, operations: string[]): INodeProperties => ({
	displayName: 'File IDs',
	name: 'fileIds',
	type: 'string',
	required: true,
	default: '',
	placeholder: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61, 0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62',
	description:
		'IDs of the files or folders, separated by commas, or an array from an expression. Up to 1,000 at once.',
	displayOptions: { show: showFor(resource, operations) },
});

const conflictOption = (values: string[], description: string): INodeProperties => ({
	displayName: 'If the Name Is Taken',
	name: 'conflict',
	type: 'options',
	options: [
		{ name: 'Fail', value: 'fail', description: 'Stop with API_NAME_TAKEN' },
		{ name: 'Keep Both', value: 'rename', description: 'Use «name (1)»' },
		{ name: 'Replace', value: 'replace', description: 'Overwrite the existing file' },
		{ name: 'Skip', value: 'skip', description: 'Leave it as it is' },
	].filter((option) => values.includes(option.value)),
	default: 'fail',
	description,
});

export const fileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['file'] } },
		options: [
			{
				name: 'Add Label',
				value: 'addLabel',
				description: 'Add a label to a file or folder',
				action: 'Add a label to a file',
			},
			{
				name: 'Download',
				value: 'download',
				description: 'Download a file as binary data, straight from the storage provider',
				action: 'Download a file',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a file or folder',
				action: 'Get a file',
			},
			{
				name: 'Get Download Link',
				value: 'getDownloadLink',
				description: 'Get a temporary link that downloads the file from the storage provider',
				action: 'Get a download link for a file',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the files and folders inside a folder',
				action: 'Get many files in a folder',
			},
			{
				name: 'Move',
				value: 'move',
				description: 'Move files and folders into a folder, of the same bucket or another one',
				action: 'Move files',
			},
			{
				name: 'Remove Label',
				value: 'removeLabel',
				description: 'Remove a label from a file or folder',
				action: 'Remove a label from a file',
			},
			{
				name: 'Rename',
				value: 'rename',
				description: 'Rename a file or folder',
				action: 'Rename a file',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search files and folders by name and filters',
				action: 'Search files',
			},
			{
				name: 'Trash',
				value: 'trash',
				description: 'Send files and folders to the trash',
				action: 'Send files to the trash',
			},
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload binary data straight to the storage provider',
				action: 'Upload a file',
			},
		],
		default: 'upload',
	},
];

export const fileFields: INodeProperties[] = [
	idField(
		'fileId',
		'File ID',
		showFor('file', ['addLabel', 'download', 'get', 'getDownloadLink', 'removeLabel', 'rename']),
		'The ID of the file or folder',
	),
	locator('labelId', 'Label', 'searchLabels', showFor('file', ['addLabel', 'removeLabel'])),

	locator('bucketId', 'Bucket', 'searchBuckets', showFor('file', ['getAll', 'upload'])),
	{
		displayName: 'Folder Path',
		name: 'folderPath',
		type: 'string',
		default: '',
		placeholder: 'invoices/2026/',
		description: 'The folder in the bucket; empty for the root of the bucket',
		displayOptions: { show: showFor('file', ['getAll', 'upload']) },
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field that holds the file',
		displayOptions: { show: showFor('file', ['upload']) },
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		placeholder: 'invoice.pdf',
		description: 'The name of the file in Nubbo; empty uses the name of the binary data',
		displayOptions: { show: showFor('file', ['upload']) },
	},
	{
		displayName: 'Options',
		name: 'uploadOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('file', ['upload']) },
		options: [
			conflictOption(
				['fail', 'rename', 'replace'],
				'What to do when a file with this name is already in the folder',
			),
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				default: '',
				placeholder: 'application/pdf',
				description: 'Empty uses the MIME type of the binary data',
			},
			{
				displayName: 'Multipart',
				name: 'multipart',
				type: 'boolean',
				default: false,
				description:
					'Whether to upload in parts even below 5 GB (from 5 MiB). Above 5 GB uploads always go in parts.',
			},
		],
	},

	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the output binary field to put the file in',
		displayOptions: { show: showFor('file', ['download']) },
	},
	{
		displayName: 'Options',
		name: 'downloadOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('file', ['download']) },
		options: [
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'The name of the binary file; empty uses the name in Nubbo',
			},
		],
	},
	{
		displayName: 'Expires In (Seconds)',
		name: 'expiresIn',
		type: 'number',
		typeOptions: { minValue: 60, maxValue: 604800 },
		default: 3600,
		description: 'How long the link works, from 60 seconds to 7 days',
		displayOptions: { show: showFor('file', ['getDownloadLink']) },
	},

	{
		displayName: 'New Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'invoice-final.pdf',
		description: 'The new name, without a path; the item stays in its folder',
		displayOptions: { show: showFor('file', ['rename']) },
	},
	{
		displayName: 'Options',
		name: 'renameOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('file', ['rename']) },
		options: [conflictOption(['fail', 'rename'], 'What to do when the new name is taken')],
	},

	fileIdsField('file', ['move', 'trash']),
	locator('destinationBucketId', 'Destination Bucket', 'searchBuckets', showFor('file', ['move'])),
	{
		displayName: 'Destination Folder',
		name: 'destinationPath',
		type: 'string',
		default: '',
		placeholder: 'archive/2026/',
		description: 'The folder to move into; empty for the root of the bucket',
		displayOptions: { show: showFor('file', ['move']) },
	},
	{
		displayName: 'Options',
		name: 'moveOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('file', ['move']) },
		options: [
			conflictOption(
				['fail', 'rename', 'skip'],
				'What to do when an item with the same name is at the destination',
			),
		],
	},

	{
		displayName: 'Query',
		name: 'q',
		type: 'string',
		default: '',
		placeholder: 'invoice march',
		description: 'Words of the name; each word matches a part of it',
		displayOptions: { show: showFor('file', ['search']) },
	},

	...paginationFields(showFor('file', ['getAll', 'search'])),

	{
		displayName: 'Options',
		name: 'listOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('file', ['getAll']) },
		options: [
			{
				displayName: 'Include Hidden',
				name: 'includeHidden',
				type: 'boolean',
				default: false,
				description: 'Whether to include items hidden in Nubbo',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
			},
			{
				displayName: 'Sort By',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Name', value: 'name' },
					{ name: 'Modified', value: 'modified' },
				],
				default: 'name',
				description: 'Folders always come first',
			},
		],
	},

	{
		displayName: 'Filters',
		name: 'searchFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor('file', ['search']) },
		options: [
			{
				displayName: 'Bucket ID',
				name: 'bucketId',
				type: 'string',
				default: '',
				description: 'Search one bucket only',
			},
			{
				displayName: 'Extensions',
				name: 'extension',
				type: 'string',
				default: '',
				placeholder: 'pdf, docx',
				description: 'File extensions without the dot, separated by commas',
			},
			{
				displayName: 'Folder Path',
				name: 'prefix',
				type: 'string',
				default: '',
				placeholder: 'invoices/',
				description: 'Search inside this folder and its subfolders; needs Bucket ID',
			},
			{
				displayName: 'Include Hidden',
				name: 'includeHidden',
				type: 'boolean',
				default: false,
				description: 'Whether to include items hidden in Nubbo',
			},
			{
				displayName: 'Kinds',
				name: 'kind',
				type: 'multiOptions',
				options: [
					{ name: 'Archives', value: 'archives' },
					{ name: 'Audio', value: 'audio' },
					{ name: 'Code', value: 'code' },
					{ name: 'Documents', value: 'documents' },
					{ name: 'Folders', value: 'folders' },
					{ name: 'Images', value: 'images' },
					{ name: 'Others', value: 'others' },
					{ name: 'Videos', value: 'videos' },
				],
				default: [],
			},
			{
				displayName: 'Label IDs',
				name: 'labelIds',
				type: 'string',
				default: '',
				description: 'Label IDs separated by commas; files with every one of them',
			},
			{
				displayName: 'Max Size (Bytes)',
				name: 'sizeMax',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
			},
			{
				displayName: 'Min Size (Bytes)',
				name: 'sizeMin',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
			},
			{
				displayName: 'Modified After',
				name: 'modifiedFrom',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Modified Before',
				name: 'modifiedTo',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
			},
			{
				displayName: 'Sort By',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Modified', value: 'modified' },
					{ name: 'Name', value: 'name' },
				],
				default: 'modified',
				description: 'With a query, better matches come first and this orders each group',
			},
		],
	},
];

export const folderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['folder'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a folder, with any missing parent folders',
				action: 'Create a folder',
			},
		],
		default: 'create',
	},
];

export const folderFields: INodeProperties[] = [
	locator('bucketId', 'Bucket', 'searchBuckets', showFor('folder', ['create'])),
	{
		displayName: 'Folder Path',
		name: 'path',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'invoices/2026/03/',
		description: 'The folder to create; missing parent folders are created with it',
		displayOptions: { show: showFor('folder', ['create']) },
	},
	{
		displayName: 'Options',
		name: 'folderOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('folder', ['create']) },
		options: [
			conflictOption(
				['fail', 'rename', 'skip'],
				'What to do when the folder exists. Skip returns the existing folder.',
			),
		],
	},
];

export const trashOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['trash'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the items in the trash',
				action: 'Get many items in the trash',
			},
			{
				name: 'Restore',
				value: 'restore',
				description: 'Restore items from the trash to where they were',
				action: 'Restore items from the trash',
			},
		],
		default: 'getAll',
	},
];

export const trashFields: INodeProperties[] = [
	fileIdsField('trash', ['restore']),
	...paginationFields(showFor('trash', ['getAll'])),
	{
		displayName: 'Filters',
		name: 'trashFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor('trash', ['getAll']) },
		options: [
			{
				displayName: 'Bucket ID',
				name: 'bucketId',
				type: 'string',
				default: '',
			},
		],
	},
];
