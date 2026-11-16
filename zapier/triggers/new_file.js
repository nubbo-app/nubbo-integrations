'use strict';

const {
  ACTIVITY_OUTPUT_FIELDS,
  ACTIVITY_SAMPLE,
  IGNORE_OWN_CHANGES_FIELD,
  ignoresOwn,
  pollTrigger,
} = require('../lib/triggers');

const perform = (z, bundle) =>
  pollTrigger(
    z,
    bundle,
    '/v1/triggers/new-files',
    { bucketId: bundle.inputData.bucketId, prefix: bundle.inputData.prefix },
    { ignoreOwn: ignoresOwn(bundle), download: true },
  );

module.exports = {
  key: 'new_file',
  noun: 'File',
  display: {
    label: 'New File',
    description:
      'Triggers when a file is uploaded to Nubbo, through a file request or through an embed.',
  },
  operation: {
    type: 'polling',
    inputFields: [
      {
        key: 'bucketId',
        label: 'Bucket',
        dynamic: 'bucket_list.id.name',
        helpText:
          'Only files uploaded to this bucket. Leave empty for every bucket the key reaches.',
      },
      {
        key: 'prefix',
        label: 'Folder',
        helpText:
          'Only files inside this folder and its subfolders, such as `invoices/2026/`. Needs a bucket.',
      },
      IGNORE_OWN_CHANGES_FIELD,
    ],
    perform,
    sample: ACTIVITY_SAMPLE,
    outputFields: [...ACTIVITY_OUTPUT_FIELDS, { key: 'downloadFile', label: 'File', type: 'file' }],
  },
};
