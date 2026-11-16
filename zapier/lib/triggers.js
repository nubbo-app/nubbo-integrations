'use strict';

const { flowOf, nubboRequest } = require('./client');
const { withDownload } = require('./files');

const IGNORE_OWN_CHANGES_FIELD = {
  key: 'ignoreOwnChanges',
  label: 'Ignore Changes Made With This Key',
  type: 'boolean',
  default: 'true',
  helpText:
    'Skips what this same API key did, so a Zap that writes to Nubbo does not trigger itself.',
};

const ACTIVITY_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a90',
  occurredAt: '2026-11-14T10:15:00.000Z',
  type: 'FILE_UPLOADED',
  actor: { kind: 'person' },
  bucketId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
  file: {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61',
    name: 'invoice-0042.pdf',
    path: 'invoices/2026/invoice-0042.pdf',
  },
  resource: null,
  encrypted: false,
  detail: { size: 184320 },
};

const ACTIVITY_OUTPUT_FIELDS = [
  { key: 'id', label: 'Event ID' },
  { key: 'occurredAt', label: 'Occurred At', type: 'datetime' },
  { key: 'type', label: 'Event Type' },
  { key: 'actor__kind', label: 'Actor Kind' },
  { key: 'actor__apiKey__name', label: 'API Key Name' },
  { key: 'bucketId', label: 'Bucket ID' },
  { key: 'file__id', label: 'File ID' },
  { key: 'file__name', label: 'File Name' },
  { key: 'file__path', label: 'File Path' },
  { key: 'resource__type', label: 'Resource Type' },
  { key: 'resource__id', label: 'Resource ID' },
];

const pollTrigger = async (z, bundle, path, params, { ignoreOwn, download }) => {
  const page = await nubboRequest(z, bundle, { path, params, flow: flowOf(bundle) });
  let items = page.data ?? [];
  if (ignoreOwn && items.some((item) => item.actor?.apiKey)) {
    const me = await nubboRequest(z, bundle, { path: '/v1/me' });
    items = items.filter((item) => item.actor?.apiKey?.id !== me.key.id);
  }
  return download ? items.map((item) => withDownload(z, item, item.file?.id)) : items;
};

const ignoresOwn = (bundle) =>
  !['false', 'no', '0'].includes(String(bundle.inputData.ignoreOwnChanges));

module.exports = {
  ACTIVITY_OUTPUT_FIELDS,
  ACTIVITY_SAMPLE,
  IGNORE_OWN_CHANGES_FIELD,
  ignoresOwn,
  pollTrigger,
};
