'use strict';

const { ACTIVITY_OUTPUT_FIELDS, ACTIVITY_SAMPLE, pollTrigger } = require('../lib/triggers');

const perform = (z, bundle) =>
  pollTrigger(
    z,
    bundle,
    '/v1/triggers/new-inbox-uploads',
    { inboxId: bundle.inputData.inboxId },
    { ignoreOwn: false, download: true },
  );

module.exports = {
  key: 'new_inbox_upload',
  noun: 'File Request Upload',
  display: {
    label: 'New File Request Upload',
    description: 'Triggers when someone sends a file through a file request.',
  },
  operation: {
    type: 'polling',
    inputFields: [
      {
        key: 'inboxId',
        label: 'File Request',
        dynamic: 'inbox_list.id.name',
        helpText: 'Only uploads to this file request. Leave empty for every file request.',
      },
    ],
    perform,
    sample: {
      ...ACTIVITY_SAMPLE,
      type: 'FILE_REQUEST_RECEIVED',
      actor: { kind: 'visitor' },
      resource: { type: 'FILE_REQUEST', id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a90' },
    },
    outputFields: [...ACTIVITY_OUTPUT_FIELDS, { key: 'downloadFile', label: 'File', type: 'file' }],
  },
};
