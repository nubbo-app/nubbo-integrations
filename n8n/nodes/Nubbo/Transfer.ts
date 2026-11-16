import { createHash } from 'crypto';

import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	encodePath,
	idempotencyKeyOf,
	nubboApiRequest,
	nubboRawRequest,
	toNodeApiError,
} from './GenericFunctions';

type Readable = Awaited<ReturnType<IExecuteFunctions['helpers']['getBinaryStream']>>;

const PART_URL_BATCH = 100;
const DOWNLOAD_LINK_SECONDS = 900;

interface UploadStart extends IDataObject {
	uploadId: string;
	multipart: boolean;
	method?: string;
	url?: string;
	partSize?: number;
	totalParts?: number;
}

interface PartUrls extends IDataObject {
	parts: Array<{ partNumber: number; url: string }>;
}

type Source =
	| { size: number; buffer: Buffer }
	| { size: number; streamOf: () => Promise<Readable> };

export const folderOf = (value: string): string => {
	const trimmed = value.trim().replace(/^\/+/, '');
	return trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

function providerError(
	this: IExecuteFunctions,
	error: unknown,
	message: string,
	itemIndex: number,
): NodeApiError {
	const response = (error as { response?: { status?: number } }).response;
	const statusCode = response?.status ?? (error as { httpCode?: string }).httpCode;
	return new NodeApiError(this.getNode(), { message, statusCode: statusCode ?? '' } as JsonObject, {
		message,
		description: 'The storage provider refused the transfer. Nubbo was not sent the file.',
		httpCode: statusCode ? String(statusCode) : undefined,
		itemIndex,
	});
}

async function sourceOf(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
	binaryData: IBinaryData,
): Promise<Source> {
	if (binaryData.id) {
		const id = binaryData.id;
		const metadata = await this.helpers.getBinaryMetadata(id);
		return {
			size: metadata.fileSize,
			streamOf: async () => await this.helpers.getBinaryStream(id),
		};
	}
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	return { size: buffer.length, buffer };
}

async function* partsOf(source: Source, partSize: number): AsyncGenerator<Buffer> {
	if ('buffer' in source) {
		for (let offset = 0; offset < source.size; offset += partSize) {
			yield source.buffer.subarray(offset, Math.min(offset + partSize, source.size));
		}
		return;
	}
	let pending: Buffer[] = [];
	let pendingLength = 0;
	for await (const chunk of await source.streamOf()) {
		let data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
		while (pendingLength + data.length >= partSize) {
			const take = partSize - pendingLength;
			pending.push(data.subarray(0, take));
			yield Buffer.concat(pending);
			data = data.subarray(take);
			pending = [];
			pendingLength = 0;
		}
		if (data.length > 0) {
			pending.push(data);
			pendingLength += data.length;
		}
	}
	if (pendingLength > 0) yield Buffer.concat(pending);
}

async function putTo(
	this: IExecuteFunctions,
	url: string,
	body: Buffer | Readable,
	size: number,
	contentType: string | undefined,
): Promise<void> {
	const headers: Record<string, string> = { 'Content-Length': String(size) };
	if (contentType) headers['Content-Type'] = contentType;
	const request: IHttpRequestOptions = {
		method: 'PUT',
		url,
		headers,
		body: body as Buffer,
		json: false,
	};
	await this.helpers.httpRequest(request);
}

async function sendParts(
	this: IExecuteFunctions,
	start: UploadStart,
	source: Source,
	itemIndex: number,
): Promise<void> {
	const partSize = start.partSize as number;
	const totalParts = start.totalParts as number;
	let urls = new Map<number, string>();
	let partNumber = 0;
	for await (const part of partsOf(source, partSize)) {
		partNumber++;
		if (!urls.has(partNumber)) {
			const partNumbers: number[] = [];
			for (let n = partNumber; n <= Math.min(totalParts, partNumber + PART_URL_BATCH - 1); n++) {
				partNumbers.push(n);
			}
			const signed = (await nubboRawRequest.call(
				this,
				'POST',
				`/v1/uploads/${encodePath(start.uploadId)}/parts`,
				{ body: { partNumbers } },
			)) as PartUrls;
			urls = new Map(signed.parts.map((signedPart) => [signedPart.partNumber, signedPart.url]));
		}
		try {
			await putTo.call(this, urls.get(partNumber) as string, part, part.length, undefined);
		} catch (error) {
			throw providerError.call(this, error, `Part ${partNumber} could not be uploaded`, itemIndex);
		}
	}
}

export async function uploadFile(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const bucketId = this.getNodeParameter('bucketId', itemIndex, '', {
		extractValue: true,
	}) as string;
	const folder = folderOf(this.getNodeParameter('folderPath', itemIndex, '') as string);
	const fileName =
		(this.getNodeParameter('fileName', itemIndex, '') as string).trim() ||
		binaryData.fileName ||
		'file';
	const options = this.getNodeParameter('uploadOptions', itemIndex, {}) as IDataObject;
	const contentType = (options.contentType as string) || binaryData.mimeType || undefined;
	const source = await sourceOf.call(this, itemIndex, binaryPropertyName, binaryData);

	const body: IDataObject = { path: `${folder}${fileName}`, size: source.size };
	if (contentType) body.contentType = contentType;
	if (options.conflict) body.conflict = options.conflict;
	if (options.multipart) body.multipart = true;

	let start: UploadStart;
	try {
		start = (await nubboRawRequest.call(
			this,
			'POST',
			`/v1/buckets/${encodePath(bucketId)}/uploads`,
			{ body },
		)) as UploadStart;
	} catch (error) {
		throw toNodeApiError.call(this, error, itemIndex);
	}

	try {
		if (start.multipart) {
			await sendParts.call(this, start, source, itemIndex);
		} else {
			try {
				const payload = 'buffer' in source ? source.buffer : await source.streamOf();
				await putTo.call(this, start.url as string, payload, source.size, contentType);
			} catch (error) {
				throw providerError.call(this, error, 'The file could not be uploaded', itemIndex);
			}
		}
		return (await nubboRawRequest.call(
			this,
			'POST',
			`/v1/uploads/${encodePath(start.uploadId)}/complete`,
			{
				idempotencyKey: idempotencyKeyOf.call(
					this,
					itemIndex,
					`complete:${createHash('sha256').update(start.uploadId).digest('hex').slice(0, 16)}`,
				),
			},
		)) as IDataObject;
	} catch (error) {
		if (start.multipart) {
			await nubboRawRequest
				.call(this, 'DELETE', `/v1/uploads/${encodePath(start.uploadId)}`)
				.catch((abortError: unknown) => {
					this.logger.warn('Nubbo: the unfinished multipart upload could not be aborted', {
						error: (abortError as Error).message,
					});
				});
		}
		throw error instanceof NodeApiError ? error : toNodeApiError.call(this, error, itemIndex);
	}
}

const fileNameOfUrl = (url: string): string => {
	try {
		const segments = new URL(url).pathname.split('/').filter(Boolean);
		return decodeURIComponent(segments[segments.length - 1] ?? 'file');
	} catch {
		return 'file';
	}
};

export async function downloadFile(
	this: IExecuteFunctions,
	itemIndex: number,
	item: INodeExecutionData,
): Promise<INodeExecutionData> {
	const fileId = this.getNodeParameter('fileId', itemIndex) as string;
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const options = this.getNodeParameter('downloadOptions', itemIndex, {}) as IDataObject;
	const link = await nubboApiRequest.call(
		this,
		'POST',
		`/v1/files/${encodePath(fileId)}/download-link`,
		{ body: { expiresIn: DOWNLOAD_LINK_SECONDS } },
	);
	const url = link.url as string;
	let response: { body: Readable; headers: Record<string, string | undefined> };
	try {
		response = (await this.helpers.httpRequest({
			method: 'GET',
			url,
			encoding: 'stream',
			returnFullResponse: true,
			json: false,
		})) as typeof response;
	} catch (error) {
		throw providerError.call(this, error, 'The file could not be downloaded', itemIndex);
	}
	const fileName = (options.fileName as string) || fileNameOfUrl(url);
	const mimeType = response.headers['content-type'] || undefined;
	const length = Number(response.headers['content-length']);
	const binary = await this.helpers.prepareBinaryData(response.body, fileName, mimeType);
	return {
		json: {
			fileId,
			fileName: binary.fileName,
			mimeType: binary.mimeType,
			size: Number.isFinite(length) ? length : null,
		},
		binary: { ...(item.binary ?? {}), [binaryPropertyName]: binary },
		pairedItem: { item: itemIndex },
	};
}
