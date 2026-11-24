import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { ACTIVITY_TYPE_OPTIONS } from './ActivityTypes';
import {
	NubboRequestError,
	nubboApiRequest,
	nubboRawRequest,
	searchListOf,
	toNodeApiError,
} from './GenericFunctions';
import { folderOf } from './Transfer';

const FLOW_HEADER = 'X-Nubbo-Flow';

const TRIGGER_PATHS: Record<string, string> = {
	newActivity: '/v1/triggers/new-activity',
	newFile: '/v1/triggers/new-files',
	newInboxUpload: '/v1/triggers/new-inbox-uploads',
};

interface TriggerPage {
	data: IDataObject[];
	nextCursor: string | null;
	hasMore: boolean;
	truncated: boolean;
}

interface TriggerState {
	cursor?: string;
	filter?: string;
}

const codeOf = (error: unknown): string | undefined =>
	error instanceof NubboRequestError ? error.body.code : undefined;

const apiKeyIdOf = (item: IDataObject): unknown =>
	((item.actor as IDataObject | undefined)?.apiKey as IDataObject | undefined)?.id;

const searchLocator = (
	name: string,
	displayName: string,
	searchListMethod: string,
	event: string,
	description: string,
) => ({
	displayName,
	name,
	type: 'resourceLocator' as const,
	default: { mode: 'list', value: '' },
	description,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list' as const,
			typeOptions: { searchListMethod, searchable: true },
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string' as const,
			placeholder: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
		},
	],
	displayOptions: { show: { event: [event] } },
});

export class NubboTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nubbo Trigger',
		name: 'nubboTrigger',
		icon: { light: 'file:../../icons/nubbo.svg', dark: 'file:../../icons/nubbo.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'One workspace for all your S3 storage. Automate it from n8n.',
		defaults: { name: 'Nubbo Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nubboApi', required: true }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'New Activity',
						value: 'newActivity',
						description: 'An event of the activity log, of the types you choose',
					},
					{
						name: 'New File',
						value: 'newFile',
						description: 'A file uploaded through Nubbo: the app, the API, file requests or embeds',
					},
					{
						name: 'New File Request Upload',
						value: 'newInboxUpload',
						description: 'A file received through a file request',
					},
				],
				default: 'newFile',
			},
			searchLocator(
				'bucketId',
				'Bucket',
				'searchBuckets',
				'newFile',
				'Only files of this bucket; empty watches every bucket the key reaches',
			),
			{
				displayName: 'Folder Path',
				name: 'prefix',
				type: 'string',
				default: '',
				placeholder: 'invoices/',
				description: 'Only files under this folder; works with or without a bucket',
				displayOptions: { show: { event: ['newFile'] } },
			},
			searchLocator(
				'inboxId',
				'File Request',
				'searchInboxes',
				'newInboxUpload',
				'Only uploads of this file request; empty watches every file request the key reaches',
			),
			{
				displayName: 'Event Types',
				name: 'types',
				type: 'multiOptions',
				options: ACTIVITY_TYPE_OPTIONS,
				default: [],
				description: 'Every type when empty',
				displayOptions: { show: { event: ['newActivity'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Ignore Changes Made by This Key',
						name: 'ignoreOwnChanges',
						type: 'boolean',
						default: true,
						description:
							'Whether to skip events caused by the API key of this credential, so a workflow that writes into what it watches does not trigger itself',
					},
				],
			},
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
			async searchInboxes(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				return await searchListOf.call(
					this,
					'/v1/inboxes',
					(inbox) => inbox.name as string,
					filter,
					paginationToken,
				);
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const ignoreOwnChanges = options.ignoreOwnChanges !== false;
		const qs: IDataObject = {};
		if (event === 'newFile') {
			const bucketId = this.getNodeParameter('bucketId', '', { extractValue: true }) as string;
			const prefix = folderOf(this.getNodeParameter('prefix', '') as string);
			if (bucketId) qs.bucketId = bucketId;
			if (prefix) qs.prefix = prefix;
		} else if (event === 'newInboxUpload') {
			const inboxId = this.getNodeParameter('inboxId', '', { extractValue: true }) as string;
			if (inboxId) qs.inboxId = inboxId;
		} else {
			const types = this.getNodeParameter('types', []) as string[];
			if (types.length > 0) qs.types = types.join(',');
		}

		const manual = this.getMode() === 'manual';
		const flow = [this.getWorkflow().id ?? 'workflow', this.getNode().id, manual ? 'test' : '']
			.filter(Boolean)
			.join(':');
		const filter = JSON.stringify([event, qs]);
		const state = this.getWorkflowStaticData('node') as TriggerState;

		const fetchPage = async (since?: string): Promise<TriggerPage | string> => {
			try {
				return (await nubboRawRequest.call(this, 'GET', TRIGGER_PATHS[event], {
					qs: since ? { ...qs, since } : qs,
					headers: { [FLOW_HEADER]: flow },
				})) as TriggerPage;
			} catch (error) {
				const code = codeOf(error);
				if (!manual && (code === 'API_TRIGGER_TOO_FREQUENT' || code === 'API_CURSOR_INVALID')) {
					return code;
				}
				throw toNodeApiError.call(this, error);
			}
		};

		const itemsOf = async (
			data: IDataObject[],
			limit?: number,
		): Promise<INodeExecutionData[][] | null> => {
			let kept = data;
			if (ignoreOwnChanges && data.some((item) => apiKeyIdOf(item))) {
				const me = await nubboApiRequest.call(this, 'GET', '/v1/me');
				const ownKeyId = (me.key as IDataObject | undefined)?.id;
				kept = data.filter((item) => apiKeyIdOf(item) !== ownKeyId);
			}
			if (limit !== undefined) kept = kept.slice(0, limit);
			return kept.length > 0 ? [this.helpers.returnJsonArray(kept)] : null;
		};

		if (manual) {
			const page = (await fetchPage()) as TriggerPage;
			return await itemsOf(page.data, 1);
		}

		if (!state.cursor || state.filter !== filter) {
			const seed = await fetchPage();
			if (typeof seed === 'string' || !seed.nextCursor) return null;
			state.cursor = seed.nextCursor;
			state.filter = filter;
			return null;
		}

		const page = await fetchPage(state.cursor);
		if (page === 'API_CURSOR_INVALID') {
			delete state.cursor;
			return null;
		}
		if (typeof page === 'string') return null;
		if (page.nextCursor) state.cursor = page.nextCursor;
		return await itemsOf(page.data);
	}
}
