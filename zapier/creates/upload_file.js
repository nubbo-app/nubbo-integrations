'use strict';

const { idPath, idempotencyKeyOf, nubboRequest } = require('../lib/client');
const {
  bucketField,
  conflictChoices,
  conflictField,
  duplicateGuardField,
  folderPathOf,
} = require('../lib/fields');
const { FILE_SAMPLE } = require('./files');

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const tooLarge = (z) =>
  new z.errors.Error(
    'Zapier uploads files up to 100 MB; upload larger files in Nubbo or from your own code.',
    'ZAPIER_FILE_TOO_LARGE',
    413,
  );

const nameFromResponse = (response, url) => {
  const disposition = response.getHeader('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  if (plain) return plain[1];
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    return '';
  }
};

const contentOf = async (z, value) => {
  const source = String(value ?? '');
  if (!/^https?:\/\//i.test(source)) {
    const buffer = Buffer.from(source, 'utf8');
    if (buffer.length > MAX_UPLOAD_BYTES) throw tooLarge(z);
    return { buffer, name: '', contentType: 'text/plain' };
  }
  const response = await z.request({ url: source, raw: true });
  if (Number(response.getHeader('content-length')) > MAX_UPLOAD_BYTES) throw tooLarge(z);
  const buffer = await response.buffer();
  if (buffer.length > MAX_UPLOAD_BYTES) throw tooLarge(z);
  return {
    buffer,
    name: nameFromResponse(response, source),
    contentType: (response.getHeader('content-type') ?? '').split(';')[0].trim(),
  };
};

const perform = async (z, bundle) => {
  const { bucketId, folder, fileName, contentType, conflict } = bundle.inputData;
  const content = await contentOf(z, bundle.inputData.file);
  const name = String(fileName || content.name || '').trim();
  if (!name) {
    throw new z.errors.Error(
      'Give the file a name in File Name.',
      'ZAPIER_FILE_NAME_REQUIRED',
      400,
    );
  }
  const type = contentType || content.contentType || DEFAULT_CONTENT_TYPE;
  const upload = await nubboRequest(z, bundle, {
    method: 'POST',
    path: `/v1/buckets/${idPath(bucketId)}/uploads`,
    body: {
      path: `${folderPathOf(folder)}${name}`,
      size: content.buffer.length,
      contentType: type,
      conflict,
    },
    idempotencyKey: idempotencyKeyOf(z, bundle, 'upload_file', 'start'),
  });
  const sent = await z.request({
    method: upload.method || 'PUT',
    url: upload.url,
    body: content.buffer,
    headers: { 'Content-Type': type },
    skipThrowForStatus: true,
    throwForThrottlingEarly: false,
  });
  if (sent.status >= 300) {
    throw new z.errors.Error(
      `The storage provider refused the upload with status ${sent.status}.`,
      'ZAPIER_PROVIDER_UPLOAD_FAILED',
      502,
    );
  }
  return nubboRequest(z, bundle, {
    method: 'POST',
    path: `/v1/uploads/${idPath(upload.uploadId)}/complete`,
    idempotencyKey: idempotencyKeyOf(z, bundle, 'upload_file', 'complete', upload.uploadId),
  });
};

module.exports = {
  key: 'upload_file',
  noun: 'File',
  display: {
    label: 'Upload File',
    description:
      'Uploads a file to a bucket. The file goes straight to your storage provider, never through Nubbo.',
  },
  operation: {
    inputFields: [
      bucketField(),
      {
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
        helpText:
          'The file from an earlier step, up to 100 MB. Plain text is uploaded as a text file.',
      },
      {
        key: 'folder',
        label: 'Folder',
        helpText:
          'The folder to upload to, such as `invoices/2026/`. Missing folders are created. Leave empty for the top of the bucket.',
      },
      {
        key: 'fileName',
        label: 'File Name',
        helpText: 'The name to save it with. Leave empty to keep the name of the file.',
      },
      {
        key: 'contentType',
        label: 'Content Type',
        helpText: 'Such as `application/pdf`. Leave empty to use the type of the file.',
      },
      conflictField(
        conflictChoices('rename', 'replace', 'fail'),
        'rename',
        'What to do when the folder already has a file with this name.',
      ),
      duplicateGuardField,
    ],
    perform,
    sample: FILE_SAMPLE,
  },
};
