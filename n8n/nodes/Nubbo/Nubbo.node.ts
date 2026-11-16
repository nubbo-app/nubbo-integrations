import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { automationFields, automationOperations } from './descriptions/AutomationDescription';
import {
	fileFields,
	fileOperations,
	folderFields,
	folderOperations,
	trashFields,
	trashOperations,
} from './descriptions/FileDescription';
import {
	accountOperations,
	bucketFields,
	bucketOperations,
	operationFields,
	operationOperations,
} from './descriptions/GeneralDescription';
import {
	activityFields,
	activityOperations,
	labelFields,
	labelOperations,
	projectFields,
	projectOperations,
} from './descriptions/OrganizeDescription';
import {
	embedFields,
	embedOperations,
	galleryFields,
	galleryOperations,
	inboxFields,
	inboxOperations,
	linkFields,
	linkOperations,
} from './descriptions/ShareDescription';
import {
	encodePath,
	idempotencyKeyOf,
	nubboApiRequest,
	nubboApiRequestAllItems,
	searchListOf,
} from './GenericFunctions';
import { downloadFile, folderOf, uploadFile } from './Transfer';

type Result = IDataObject | IDataObject[];
type Handler = (this: IExecuteFunctions, i: number) => Promise<Result>;

const MAX_FILE_IDS = 1000;

const listOf = (value: unknown): string[] => {
	const values = Array.isArray(value) ? value : String(value ?? '').split(',');
	return values.map((entry) => String(entry).trim()).filter(Boolean);
};

const csvOf = (value: unknown): string | undefined => {
	const values = listOf(value);
	return values.length > 0 ? values.join(',') : undefined;
};

const bodyOf = (fields: IDataObject, lists: string[] = []): IDataObject => {
	const body: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (key === 'clearFields' || value === '' || value === undefined) continue;
		body[key] = lists.includes(key) ? listOf(value) : value;
	}
	for (const key of (fields.clearFields as string[] | undefined) ?? []) body[key] = null;
	if (Array.isArray(body.allowedFileTypes)) {
		body.allowedFileTypes = (body.allowedFileTypes as string[]).map((type) => {
			const extension = type.toLowerCase();
			return extension.startsWith('.') ? extension : `.${extension}`;
		});
	}
	return body;
};

const qsOf = (fields: IDataObject): IDataObject => {
	const qs: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === '' || value === undefined || value === null) continue;
		qs[key] = Array.isArray(value) ? value.join(',') : value;
	}
	return qs;
};

function locatorOf(this: IExecuteFunctions, name: string, i: number): string {
	return this.getNodeParameter(name, i, '', { extractValue: true }) as string;
}

function fileIdsOf(this: IExecuteFunctions, i: number): string[] {
	const fileIds = listOf(this.getNodeParameter('fileIds', i));
	if (fileIds.length === 0 || fileIds.length > MAX_FILE_IDS) {
		throw new NodeOperationError(this.getNode(), 'Send from 1 to 1,000 file IDs', {
			itemIndex: i,
		});
	}
	return fileIds;
}

async function pageOf(
	this: IExecuteFunctions,
	path: string,
	qs: IDataObject,
	i: number,
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
	return await nubboApiRequestAllItems.call(this, path, qs, limit);
}

async function write(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	i: number,
	body?: IDataObject,
): Promise<IDataObject> {
	return await nubboApiRequest.call(this, method, path, {
		body,
		idempotencyKey: idempotencyKeyOf.call(this, i),
	});
}

async function remove(this: IExecuteFunctions, path: string, id: string): Promise<IDataObject> {
	await nubboApiRequest.call(this, 'DELETE', path);
	return { id, deleted: true };
}

function crud(
	collection: string,
	idParameter: string,
	createBodyOf: (this: IExecuteFunctions, i: number) => IDataObject,
	lists: string[] = [],
): Record<string, Handler> {
	const idOf = function (this: IExecuteFunctions, i: number) {
		return this.getNodeParameter(idParameter, i) as string;
	};
	return {
		async create(i) {
			return await write.call(this, 'POST', `/v1/${collection}`, i, createBodyOf.call(this, i));
		},
		async delete(i) {
			const id = idOf.call(this, i);
			return await remove.call(this, `/v1/${collection}/${encodePath(id)}`, id);
		},
		async get(i) {
			return await nubboApiRequest.call(
				this,
				'GET',
				`/v1/${collection}/${encodePath(idOf.call(this, i))}`,
			);
		},
		async getAll(i) {
			const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
			return await pageOf.call(this, `/v1/${collection}`, qsOf(filters), i);
		},
		async update(i) {
			const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
			return await write.call(
				this,
				'PATCH',
				`/v1/${collection}/${encodePath(idOf.call(this, i))}`,
				i,
				bodyOf(fields, lists),
			);
		},
	};
}

function configOf(this: IExecuteFunctions, fields: IDataObject, i: number): IDataObject {
	if (fields.config === undefined || fields.config === '') return fields;
	if (typeof fields.config !== 'string') return fields;
	try {
		return { ...fields, config: JSON.parse(fields.config) as IDataObject };
	} catch {
		throw new NodeOperationError(this.getNode(), 'Configuration (JSON) is not valid JSON', {
			itemIndex: i,
		});
	}
}

const handlers: Record<string, Record<string, Handler>> = {
	account: {
		async get() {
			return await nubboApiRequest.call(this, 'GET', '/v1/me');
		},
	},
	bucket: {
		async getAll(i) {
			return await pageOf.call(this, '/v1/buckets', {}, i);
		},
	},
	file: {
		async addLabel(i) {
			const fileId = this.getNodeParameter('fileId', i) as string;
			const labelId = locatorOf.call(this, 'labelId', i);
			return await write.call(
				this,
				'POST',
				`/v1/files/${encodePath(fileId)}/labels/${encodePath(labelId)}`,
				i,
			);
		},
		async get(i) {
			const fileId = this.getNodeParameter('fileId', i) as string;
			return await nubboApiRequest.call(this, 'GET', `/v1/files/${encodePath(fileId)}`);
		},
		async getAll(i) {
			const bucketId = locatorOf.call(this, 'bucketId', i);
			const prefix = folderOf(this.getNodeParameter('folderPath', i, '') as string);
			const options = this.getNodeParameter('listOptions', i, {}) as IDataObject;
			return await pageOf.call(
				this,
				`/v1/buckets/${encodePath(bucketId)}/files`,
				qsOf({ ...options, prefix }),
				i,
			);
		},
		async getDownloadLink(i) {
			const fileId = this.getNodeParameter('fileId', i) as string;
			const expiresIn = this.getNodeParameter('expiresIn', i) as number;
			return await nubboApiRequest.call(
				this,
				'POST',
				`/v1/files/${encodePath(fileId)}/download-link`,
				{ body: { expiresIn } },
			);
		},
		async move(i) {
			const options = this.getNodeParameter('moveOptions', i, {}) as IDataObject;
			return await write.call(this, 'POST', '/v1/files/move', i, {
				fileIds: fileIdsOf.call(this, i),
				destination: {
					bucketId: locatorOf.call(this, 'destinationBucketId', i),
					path: folderOf(this.getNodeParameter('destinationPath', i, '') as string),
				},
				...bodyOf(options),
			});
		},
		async removeLabel(i) {
			const fileId = this.getNodeParameter('fileId', i) as string;
			const labelId = locatorOf.call(this, 'labelId', i);
			return await nubboApiRequest.call(
				this,
				'DELETE',
				`/v1/files/${encodePath(fileId)}/labels/${encodePath(labelId)}`,
			);
		},
		async rename(i) {
			const fileId = this.getNodeParameter('fileId', i) as string;
			const options = this.getNodeParameter('renameOptions', i, {}) as IDataObject;
			return await write.call(this, 'PATCH', `/v1/files/${encodePath(fileId)}`, i, {
				name: (this.getNodeParameter('name', i) as string).trim(),
				...bodyOf(options),
			});
		},
		async search(i) {
			const filters = this.getNodeParameter('searchFilters', i, {}) as IDataObject;
			const q = this.getNodeParameter('q', i, '') as string;
			const qs = qsOf({
				...filters,
				q,
				extension: csvOf(filters.extension),
				labelIds: csvOf(filters.labelIds),
				prefix: filters.prefix ? folderOf(filters.prefix as string) : undefined,
				sizeMin: filters.sizeMin || undefined,
				sizeMax: filters.sizeMax || undefined,
			});
			return await pageOf.call(this, '/v1/files/search', qs, i);
		},
		async trash(i) {
			return await write.call(this, 'POST', '/v1/files/trash', i, {
				fileIds: fileIdsOf.call(this, i),
			});
		},
		async upload(i) {
			return await uploadFile.call(this, i);
		},
	},
	folder: {
		async create(i) {
			const bucketId = locatorOf.call(this, 'bucketId', i);
			const options = this.getNodeParameter('folderOptions', i, {}) as IDataObject;
			return await write.call(this, 'POST', `/v1/buckets/${encodePath(bucketId)}/folders`, i, {
				path: folderOf(this.getNodeParameter('path', i) as string),
				...bodyOf(options),
			});
		},
	},
	trash: {
		async getAll(i) {
			const filters = this.getNodeParameter('trashFilters', i, {}) as IDataObject;
			return await pageOf.call(this, '/v1/trash', qsOf(filters), i);
		},
		async restore(i) {
			return await write.call(this, 'POST', '/v1/trash/restore', i, {
				fileIds: fileIdsOf.call(this, i),
			});
		},
	},
	label: {
		async create(i) {
			const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			return await write.call(this, 'POST', '/v1/labels', i, {
				name: this.getNodeParameter('name', i) as string,
				...bodyOf(fields),
			});
		},
		async delete(i) {
			const labelId = locatorOf.call(this, 'labelId', i);
			return await remove.call(this, `/v1/labels/${encodePath(labelId)}`, labelId);
		},
		async getAll(i) {
			return await pageOf.call(this, '/v1/labels', {}, i);
		},
		async getGroups(i) {
			return await pageOf.call(this, '/v1/label-groups', {}, i);
		},
		async merge(i) {
			const labelId = locatorOf.call(this, 'labelId', i);
			return await write.call(this, 'POST', `/v1/labels/${encodePath(labelId)}/merge`, i, {
				intoId: locatorOf.call(this, 'intoId', i),
			});
		},
		async update(i) {
			const labelId = locatorOf.call(this, 'labelId', i);
			const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
			return await write.call(
				this,
				'PATCH',
				`/v1/labels/${encodePath(labelId)}`,
				i,
				bodyOf(fields),
			);
		},
	},
	project: {
		async addItems(i) {
			return await projectItems.call(this, 'POST', i);
		},
		async get(i) {
			const projectId = locatorOf.call(this, 'projectId', i);
			return await nubboApiRequest.call(this, 'GET', `/v1/projects/${encodePath(projectId)}`);
		},
		async getAll(i) {
			const filters = this.getNodeParameter('projectFilters', i, {}) as IDataObject;
			return await pageOf.call(this, '/v1/projects', qsOf(filters), i);
		},
		async removeItems(i) {
			return await projectItems.call(this, 'DELETE', i);
		},
	},
	operation: {
		async get(i) {
			const operationId = this.getNodeParameter('operationId', i) as string;
			return await nubboApiRequest.call(this, 'GET', `/v1/operations/${encodePath(operationId)}`);
		},
	},
	link: crud('links', 'linkId', function (i) {
		const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		return { fileId: this.getNodeParameter('fileId', i) as string, ...bodyOf(fields) };
	}),
	inbox: {
		...crud(
			'inboxes',
			'inboxId',
			function (i) {
				const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
				return {
					bucketId: locatorOf.call(this, 'bucketId', i),
					path: folderOf(this.getNodeParameter('path', i, '') as string),
					name: this.getNodeParameter('name', i) as string,
					...bodyOf(fields, ['allowedFileTypes']),
				};
			},
			['allowedFileTypes'],
		),
		async getUploads(i) {
			const inboxId = this.getNodeParameter('inboxId', i) as string;
			return await pageOf.call(this, `/v1/inboxes/${encodePath(inboxId)}/uploads`, {}, i);
		},
	},
	gallery: crud('galleries', 'galleryId', function (i) {
		const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		return {
			fileId: this.getNodeParameter('fileId', i) as string,
			title: this.getNodeParameter('title', i) as string,
			...bodyOf(fields),
		};
	}),
	embed: {
		...crud(
			'embeds',
			'embedId',
			function (i) {
				const kind = this.getNodeParameter('kind', i) as string;
				const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
				const target: IDataObject =
					kind === 'inbox'
						? { inboxId: this.getNodeParameter('inboxId', i) as string }
						: kind === 'shared'
							? { linkId: this.getNodeParameter('linkId', i) as string }
							: {
									bucketId: locatorOf.call(this, 'bucketId', i),
									path: folderOf(this.getNodeParameter('path', i, '') as string),
								};
				return { kind, ...target, ...bodyOf(configOf.call(this, fields, i), ['allowedDomains']) };
			},
			['allowedDomains'],
		),
		async update(i) {
			const embedId = this.getNodeParameter('embedId', i) as string;
			const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
			return await write.call(
				this,
				'PATCH',
				`/v1/embeds/${encodePath(embedId)}`,
				i,
				bodyOf(configOf.call(this, fields, i), ['allowedDomains']),
			);
		},
	},
	automation: {
		...crud('automations', 'ruleId', function (i) {
			const fields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const bucketId = locatorOf.call(this, 'bucketId', i);
			return {
				name: this.getNodeParameter('name', i) as string,
				trigger: this.getNodeParameter('trigger', i) as string,
				action: this.getNodeParameter('action', i) as string,
				...(bucketId ? { bucketId } : {}),
				...bodyOf(fields),
			};
		}),
		async getAll(i) {
			return await pageOf.call(this, '/v1/automations', {}, i);
		},
		async pause(i) {
			const ruleId = this.getNodeParameter('ruleId', i) as string;
			return await write.call(this, 'POST', `/v1/automations/${encodePath(ruleId)}/pause`, i);
		},
		async resume(i) {
			const ruleId = this.getNodeParameter('ruleId', i) as string;
			return await write.call(this, 'POST', `/v1/automations/${encodePath(ruleId)}/resume`, i);
		},
	},
	activity: {
		async getAll(i) {
			const { keyId, ...filters } = this.getNodeParameter('activityFilters', i, {}) as IDataObject;
			return await pageOf.call(this, '/v1/activity', qsOf({ ...filters, apiKeyId: keyId }), i);
		},
	},
};

async function projectItems(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	i: number,
): Promise<IDataObject> {
	const projectId = locatorOf.call(this, 'projectId', i);
	const folders = (this.getNodeParameter('folders.folder', i, []) as IDataObject[]).map(
		(folder) => ({ bucketId: folder.bucketId, path: folderOf((folder.path as string) ?? '') }),
	);
	const resources = this.getNodeParameter('resources.resource', i, []) as IDataObject[];
	if (folders.length === 0 && resources.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one folder or resource', {
			itemIndex: i,
		});
	}
	const body: IDataObject = {};
	if (folders.length > 0) body.folders = folders;
	if (resources.length > 0) body.resources = resources;
	return method === 'POST'
		? await write.call(this, method, `/v1/projects/${encodePath(projectId)}/items`, i, body)
		: await nubboApiRequest.call(this, method, `/v1/projects/${encodePath(projectId)}/items`, {
				body,
			});
}

export class Nubbo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nubbo',
		name: 'nubbo',
		icon: { light: 'file:../../icons/nubbo.svg', dark: 'file:../../icons/nubbo.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Work with files, folders, links and more in your Nubbo workspace',
		defaults: { name: 'Nubbo' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nubboApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Activity', value: 'activity' },
					{ name: 'Automation Rule', value: 'automation' },
					{ name: 'Bucket', value: 'bucket' },
					{ name: 'Embed', value: 'embed' },
					{ name: 'File', value: 'file' },
					{ name: 'File Request', value: 'inbox' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Gallery', value: 'gallery' },
					{ name: 'Label', value: 'label' },
					{ name: 'Operation', value: 'operation' },
					{ name: 'Project', value: 'project' },
					{ name: 'Share Link', value: 'link' },
					{ name: 'Trash', value: 'trash' },
				],
				default: 'file',
			},
			...accountOperations,
			...activityOperations,
			...activityFields,
			...automationOperations,
			...automationFields,
			...bucketOperations,
			...bucketFields,
			...embedOperations,
			...embedFields,
			...fileOperations,
			...fileFields,
			...inboxOperations,
			...inboxFields,
			...folderOperations,
			...folderFields,
			...galleryOperations,
			...galleryFields,
			...labelOperations,
			...labelFields,
			...operationOperations,
			...operationFields,
			...projectOperations,
			...projectFields,
			...linkOperations,
			...linkFields,
			...trashOperations,
			...trashFields,
		],
	};

	methods = {
		listSearch: {
			async searchBuckets(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				return await searchListOf.call(
					this,
					'/v1/buckets',
					(bucket) => bucket.name as string,
					filter,
					paginationToken,
				);
			},
			async searchLabels(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				return await searchListOf.call(
					this,
					'/v1/labels',
					(label) => label.name as string,
					filter,
					paginationToken,
				);
			},
			async searchProjects(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				return await searchListOf.call(
					this,
					'/v1/projects',
					(project) => project.name as string,
					filter,
					paginationToken,
				);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				if (resource === 'file' && operation === 'download') {
					returnData.push(await downloadFile.call(this, i, items[i]));
					continue;
				}
				const handler = handlers[resource]?.[operation];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}
				const result = await handler.call(this, i);
				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(result), {
						itemData: { item: i },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
