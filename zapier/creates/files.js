'use strict';

const { idPath, nubboRequest } = require('../lib/client');
const {
  bucketField,
  conflictChoices,
  conflictField,
  fileIdField,
  fileIdsField,
  folderPathOf,
  listOf,
  numberOf,
} = require('../lib/fields');
const { downloadLinkOf, withDownload } = require('../lib/files');
const { createAction } = require('../lib/operations');

const FILE_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61',
  bucketId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
  kind: 'file',
  encrypted: false,
  name: 'invoice-0042.pdf',
  path: 'invoices/2026/invoice-0042.pdf',
  size: 184320,
  mimeType: 'application/pdf',
  labelIds: [],
  hidden: false,
  modifiedAt: '2026-11-02T09:14:05.000Z',
  trashedAt: null,
};

const FOLDER_SAMPLE = {
  ...FILE_SAMPLE,
  kind: 'folder',
  name: '11',
  path: 'invoices/2026/11/',
  size: null,
  mimeType: null,
};

const BULK_SAMPLE = { done: ['0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61'], failed: [] };

const FILE_LABELS_SAMPLE = {
  fileId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61',
  labelIds: ['0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62'],
};

const labelIdField = {
  key: 'labelId',
  label: 'Label',
  required: true,
  dynamic: 'label_list.id.name',
  search: 'find_label.id',
};

const createFolder = createAction({
  key: 'create_folder',
  idempotent: true,
  noun: 'Folder',
  label: 'Create Folder',
  description: 'Creates a folder in a bucket, with any missing parent folders.',
  inputFields: [
    bucketField(),
    {
      key: 'path',
      label: 'Folder Path',
      required: true,
      helpText: 'The full path of the new folder, such as `invoices/2026/11/`.',
    },
    conflictField(
      conflictChoices('skip', 'rename', 'fail'),
      'skip',
      'What to do when a folder with this path already exists.',
    ),
  ],
  sample: FOLDER_SAMPLE,
  request: (bundle) => ({
    path: `/v1/buckets/${idPath(bundle.inputData.bucketId)}/folders`,
    body: { path: folderPathOf(bundle.inputData.path), conflict: bundle.inputData.conflict },
  }),
});

const renameFile = createAction({
  key: 'rename_file',
  noun: 'File',
  label: 'Rename File or Folder',
  description: 'Renames a file or a folder.',
  inputFields: [
    fileIdField(),
    { key: 'name', label: 'New Name', required: true, helpText: 'The new name, without a path.' },
    conflictField(
      conflictChoices('fail', 'rename'),
      'fail',
      'What to do when the new name is already taken.',
    ),
  ],
  sample: FILE_SAMPLE,
  request: (bundle) => ({
    method: 'PATCH',
    path: `/v1/files/${idPath(bundle.inputData.fileId)}`,
    body: { name: bundle.inputData.name, conflict: bundle.inputData.conflict },
  }),
});

const moveFiles = createAction({
  key: 'move_files',
  noun: 'File',
  label: 'Move Files or Folders',
  description:
    'Moves files or folders of one bucket to a folder. Large moves continue in the background.',
  inputFields: [
    fileIdsField,
    bucketField(true, 'The bucket to move them to.'),
    {
      key: 'path',
      label: 'Destination Folder',
      required: true,
      helpText:
        'An existing folder to move them into, such as `invoices/paid/`. Use `/` for the top of the bucket.',
    },
    conflictField(
      conflictChoices('rename', 'skip', 'fail'),
      'rename',
      'What to do when the destination already has an item with the same name.',
    ),
  ],
  sample: { status: 'done', moved: 1, skipped: 0, failed: 0, failedCodes: {} },
  request: (bundle) => ({
    path: '/v1/files/move',
    body: {
      fileIds: listOf(bundle.inputData.fileIds),
      destination: {
        bucketId: bundle.inputData.bucketId,
        path: bundle.inputData.path === '/' ? '' : folderPathOf(bundle.inputData.path),
      },
      conflict: bundle.inputData.conflict,
    },
  }),
});

const trashFiles = createAction({
  key: 'trash_files',
  noun: 'File',
  label: 'Move Files to Trash',
  description: 'Moves files or folders to the trash in Nubbo, where they can be restored.',
  inputFields: [fileIdsField],
  sample: BULK_SAMPLE,
  request: (bundle) => ({
    path: '/v1/files/trash',
    body: { fileIds: listOf(bundle.inputData.fileIds) },
  }),
});

const restoreFiles = createAction({
  key: 'restore_files',
  noun: 'File',
  label: 'Restore Files From Trash',
  description: 'Restores files or folders from the trash to where they were.',
  inputFields: [fileIdsField],
  sample: BULK_SAMPLE,
  request: (bundle) => ({
    path: '/v1/trash/restore',
    body: { fileIds: listOf(bundle.inputData.fileIds) },
  }),
});

const addFileLabel = createAction({
  key: 'add_file_label',
  noun: 'Label',
  label: 'Add Label to File',
  description: 'Adds a label to a file or folder.',
  inputFields: [fileIdField(), labelIdField],
  sample: FILE_LABELS_SAMPLE,
  request: (bundle) => ({
    path: `/v1/files/${idPath(bundle.inputData.fileId)}/labels/${idPath(bundle.inputData.labelId)}`,
  }),
});

const removeFileLabel = createAction({
  key: 'remove_file_label',
  noun: 'Label',
  label: 'Remove Label From File',
  description: 'Removes a label from a file or folder.',
  inputFields: [fileIdField(), labelIdField],
  sample: { ...FILE_LABELS_SAMPLE, labelIds: [] },
  request: (bundle) => ({
    method: 'DELETE',
    path: `/v1/files/${idPath(bundle.inputData.fileId)}/labels/${idPath(bundle.inputData.labelId)}`,
  }),
});

const downloadFile = {
  key: 'download_file',
  noun: 'File',
  display: {
    label: 'Download File',
    description:
      'Gets a file from its storage provider for the next steps, with a temporary download link.',
  },
  operation: {
    inputFields: [
      fileIdField('The ID of the file, from a trigger or a search.'),
      {
        key: 'expiresIn',
        label: 'Link Lifetime (Seconds)',
        type: 'integer',
        helpText: 'How long the download link works. Nubbo uses its default when empty.',
      },
    ],
    perform: async (z, bundle) => {
      const fileId = bundle.inputData.fileId;
      const file = await nubboRequest(z, bundle, { path: `/v1/files/${idPath(fileId)}` });
      const link = await downloadLinkOf(z, bundle, fileId, numberOf(bundle.inputData.expiresIn));
      return withDownload(z, { ...file, url: link.url, expiresAt: link.expiresAt }, file.id);
    },
    sample: {
      ...FILE_SAMPLE,
      url: 'https://facturas.example.com/invoices/2026/invoice-0042.pdf?X-Amz-Signature=…',
      expiresAt: '2026-11-13T19:00:00.000Z',
      downloadFile: 'SAMPLE FILE',
    },
    outputFields: [
      { key: 'downloadFile', label: 'File', type: 'file' },
      { key: 'url', label: 'Download Link' },
      { key: 'expiresAt', label: 'Link Expires At', type: 'datetime' },
    ],
  },
};

module.exports = {
  FILE_SAMPLE,
  creates: [
    createFolder,
    renameFile,
    moveFiles,
    trashFiles,
    restoreFiles,
    addFileLabel,
    removeFileLabel,
    downloadFile,
  ],
};
