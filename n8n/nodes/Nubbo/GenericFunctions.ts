import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export type NubboContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export interface NubboRequestOptions {
	qs?: IDataObject;
	body?: IDataObject;
	headers?: Record<string, string>;
	idempotencyKey?: string;
}

export interface NubboErrorBody extends JsonObject {
	statusCode: number;
	message: string;
	code: string;
	requestId: string;
}

export interface NubboPage {
	data: IDataObject[];
	nextCursor: string | null;
}

interface NubboFullResponse {
	statusCode: number;
	headers: Record<string, string | string[] | undefined>;
	body: unknown;
}

const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_SECONDS = 60;
const NO_RETRY_CODES = ['API_QUOTA_EXCEEDED', 'API_TRIGGER_TOO_FREQUENT', 'API_KEY_FAILURES'];
export const PAGE_LIMIT = 100;
const SEARCH_PAGE_LIMIT = 50;

export class NubboRequestError extends Error {
	constructor(
		readonly statusCode: number,
		readonly body: NubboErrorBody,
		readonly retryAfter: number | undefined,
	) {
		super(body.message);
	}
}

const headerOf = (headers: NubboFullResponse['headers'], name: string): string | undefined => {
	const value = headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
};

const errorBodyOf = (statusCode: number, body: unknown): NubboErrorBody => {
	if (body && typeof body === 'object' && 'message' in body) {
		const data = body as IDataObject;
		return {
			...(data as JsonObject),
			statusCode,
			message: Array.isArray(data.message) ? data.message.join('; ') : String(data.message),
			code: typeof data.code === 'string' ? data.code : '',
			requestId: typeof data.requestId === 'string' ? data.requestId : '',
		};
	}
	return {
		statusCode,
		message: `The Nubbo API answered ${statusCode}`,
		code: '',
		requestId: '',
	};
};

export async function baseUrlOf(this: NubboContext): Promise<string> {
	const credentials = await this.getCredentials<{ baseUrl: string }>('nubboApi');
	return credentials.baseUrl.trim().replace(/\/+$/, '');
}

export async function nubboRawRequest(
	this: NubboContext,
	method: IHttpRequestMethods,
	path: string,
	options: NubboRequestOptions = {},
): Promise<unknown> {
	const baseURL = await baseUrlOf.call(this);
	const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
	if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
	const request: IHttpRequestOptions = {
		method,
		baseURL,
		url: path,
		headers,
		qs: options.qs,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (options.body !== undefined) request.body = options.body;

	for (let attempt = 0; ; attempt++) {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'nubboApi',
			request,
		)) as NubboFullResponse;
		if (response.statusCode < 400) return response.body === '' ? undefined : response.body;
		const body = errorBodyOf(response.statusCode, response.body);
		const retryAfterHeader = headerOf(response.headers, 'retry-after');
		const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
		const canRetry =
			response.statusCode === 429 &&
			!NO_RETRY_CODES.includes(body.code) &&
			attempt < MAX_RETRIES &&
			retryAfter !== undefined &&
			Number.isFinite(retryAfter) &&
			retryAfter <= MAX_RETRY_AFTER_SECONDS;
		if (!canRetry) throw new NubboRequestError(response.statusCode, body, retryAfter);
		await sleep(Math.max(1, retryAfter) * 1000);
	}
}

export function toNodeApiError(this: NubboContext, error: unknown, itemIndex?: number): Error {
	if (error instanceof NubboRequestError) {
		const details = [error.body.code, error.body.requestId && `request ${error.body.requestId}`]
			.filter(Boolean)
			.join(' · ');
		return new NodeApiError(this.getNode(), error.body, {
			message: error.body.message,
			description: details || undefined,
			httpCode: String(error.statusCode),
			itemIndex,
		});
	}
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
}

export async function nubboApiRequest(
	this: NubboContext,
	method: IHttpRequestMethods,
	path: string,
	options: NubboRequestOptions = {},
): Promise<IDataObject> {
	try {
		return ((await nubboRawRequest.call(this, method, path, options)) ?? {}) as IDataObject;
	} catch (error) {
		throw toNodeApiError.call(this, error);
	}
}

export async function nubboApiRequestAllItems(
	this: NubboContext,
	path: string,
	qs: IDataObject,
	limit?: number,
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	let cursor: string | null | undefined;
	do {
		const pageLimit = limit === undefined ? PAGE_LIMIT : Math.min(PAGE_LIMIT, limit - items.length);
		const page = (await nubboApiRequest.call(this, 'GET', path, {
			qs: { ...qs, limit: pageLimit, ...(cursor ? { cursor } : {}) },
		})) as unknown as NubboPage;
		items.push(...page.data);
		cursor = page.nextCursor;
	} while (cursor && (limit === undefined || items.length < limit));
	return limit === undefined ? items : items.slice(0, limit);
}

export const encodePath = (value: string): string => encodeURIComponent(value.trim());

export function idempotencyKeyOf(this: IExecuteFunctions, itemIndex: number, step = ''): string {
	return [
		'n8n',
		this.getExecutionId(),
		this.getNode().id,
		this.getExecuteData().runIndex ?? 0,
		itemIndex,
		step,
	]
		.filter((part) => part !== '' && part !== undefined)
		.join(':')
		.replace(/[^\x21-\x7e]/g, '')
		.slice(0, 255);
}

export async function searchListOf(
	this: ILoadOptionsFunctions,
	path: string,
	nameOf: (item: IDataObject) => string,
	filter?: string,
	paginationToken?: string,
	qs: IDataObject = {},
): Promise<INodeListSearchResult> {
	const page = (await nubboApiRequest.call(this, 'GET', path, {
		qs: {
			...qs,
			limit: SEARCH_PAGE_LIMIT,
			...(paginationToken ? { cursor: paginationToken } : {}),
		},
	})) as unknown as NubboPage;
	const needle = filter?.trim().toLowerCase();
	const results = page.data
		.filter((item) => !item.encrypted && typeof item.id === 'string')
		.map((item) => ({ name: nameOf(item), value: item.id as string }))
		.filter((item) => !needle || item.name.toLowerCase().includes(needle));
	return { results, paginationToken: page.nextCursor ?? undefined };
}
