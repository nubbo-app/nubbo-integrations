'use strict';

const { findAll, idPath, nubboRequest, sameName } = require('../lib/client');
const { bucketField, listOf } = require('../lib/fields');
const { withDownload } = require('../lib/files');
const { FILE_SAMPLE } = require('../creates/files');
const { samples } = require('../creates/resources');

const SEARCH_LIMIT = 25;

const findFile = {
  key: 'find_file',
  noun: 'File',
  display: {
    label: 'Find File or Folder',
    description: 'Finds a file or folder by its ID, or by words of its name and other filters.',
  },
  operation: {
    inputFields: [
      {
        key: 'fileId',
        label: 'File ID',
        helpText: 'Finds this exact file or folder; the other fields are ignored.',
      },
      { key: 'q', label: 'Name', helpText: 'Words of the name; each word matches a part of it.' },
      bucketField(false, 'Search one bucket only.'),
      {
        key: 'prefix',
        label: 'Folder',
        helpText: 'Search inside this folder and its subfolders. Needs a bucket.',
      },
      {
        key: 'kind',
        label: 'Kind',
        list: true,
        choices: [
          'folders',
          'images',
          'videos',
          'audio',
          'documents',
          'code',
          'archives',
          'others',
        ],
      },
      {
        key: 'extension',
        label: 'Extensions',
        list: true,
        helpText: 'Such as `pdf`, without the dot.',
      },
    ],
    perform: async (z, bundle) => {
      const { fileId, q, bucketId, prefix, kind, extension } = bundle.inputData;
      let files;
      if (fileId) {
        const file = await nubboRequest(z, bundle, {
          path: `/v1/files/${idPath(fileId)}`,
          missingAsNull: true,
        });
        files = file ? [file] : [];
      } else {
        const page = await nubboRequest(z, bundle, {
          path: '/v1/files/search',
          params: {
            q,
            bucketId,
            prefix,
            kind: listOf(kind),
            extension: listOf(extension),
            limit: SEARCH_LIMIT,
          },
        });
        files = page.data ?? [];
      }
      return files.map((file) => withDownload(z, file, file.kind === 'file' ? file.id : undefined));
    },
    sample: FILE_SAMPLE,
    outputFields: [{ key: 'downloadFile', label: 'File', type: 'file' }],
  },
};

const findByName = ({ key, noun, label, description, path, nameOf, field, sample }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    inputFields: [
      {
        key: 'name',
        label: field,
        required: true,
        helpText: 'The exact name; capitals do not matter.',
      },
    ],
    perform: (z, bundle) =>
      findAll(
        z,
        bundle,
        path,
        {},
        (item) => !item.encrypted && sameName(bundle.inputData.name)(nameOf(item)),
      ),
    sample,
  },
});

const findLink = {
  key: 'find_link',
  noun: 'Share Link',
  display: {
    label: 'Find Share Link',
    description: 'Finds the share links of a file or folder.',
  },
  operation: {
    inputFields: [
      {
        key: 'fileId',
        label: 'File ID',
        required: true,
        helpText: 'The file or folder that is shared.',
      },
      {
        key: 'status',
        label: 'Status',
        choices: [
          { value: 'active', sample: 'active', label: 'Active' },
          { value: 'paused', sample: 'paused', label: 'Paused' },
          { value: 'expired', sample: 'expired', label: 'Expired' },
        ],
      },
    ],
    perform: (z, bundle) =>
      findAll(
        z,
        bundle,
        '/v1/links',
        { fileId: bundle.inputData.fileId, status: bundle.inputData.status },
        (link) => !link.encrypted,
        1,
      ),
    sample: samples.LINK_SAMPLE,
  },
};

const findLabel = findByName({
  key: 'find_label',
  noun: 'Label',
  label: 'Find Label',
  description: 'Finds a label by its name.',
  path: '/v1/labels',
  nameOf: (label) => label.name,
  field: 'Name',
  sample: samples.LABEL_SAMPLE,
});

const findInbox = findByName({
  key: 'find_inbox',
  noun: 'File Request',
  label: 'Find File Request',
  description: 'Finds a file request by its name.',
  path: '/v1/inboxes',
  nameOf: (inbox) => inbox.name,
  field: 'Name',
  sample: samples.INBOX_SAMPLE,
});

const findGallery = findByName({
  key: 'find_gallery',
  noun: 'Gallery',
  label: 'Find Gallery',
  description: 'Finds a gallery by its title.',
  path: '/v1/galleries',
  nameOf: (gallery) => gallery.title,
  field: 'Title',
  sample: samples.GALLERY_SAMPLE,
});

const findProject = findByName({
  key: 'find_project',
  noun: 'Project',
  label: 'Find Project',
  description: 'Finds a project by its name.',
  path: '/v1/projects',
  nameOf: (project) => project.name,
  field: 'Name',
  sample: samples.PROJECT_SAMPLE,
});

module.exports = [findFile, findLink, findLabel, findInbox, findGallery, findProject];
