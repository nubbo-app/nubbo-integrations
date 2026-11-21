'use strict';

const { version } = require('./package.json');
const { version: platformVersion } = require('zapier-platform-core');

const authentication = require('./authentication');
const { addApiKey } = require('./lib/client');
const { hydrateDownload } = require('./lib/files');
const newActivity = require('./triggers/new_activity');
const newFile = require('./triggers/new_file');
const newInboxUpload = require('./triggers/new_inbox_upload');
const listTriggers = require('./triggers/lists');
const { creates: fileCreates } = require('./creates/files');
const uploadFile = require('./creates/upload_file');
const { creates: resourceCreates } = require('./creates/resources');
const searches = require('./searches');

const byKey = (operations) =>
  Object.fromEntries(operations.map((operation) => [operation.key, operation]));

module.exports = {
  version,
  platformVersion,
  authentication,
  beforeRequest: [addApiKey],
  hydrators: { downloadFile: hydrateDownload },
  triggers: byKey([newFile, newInboxUpload, newActivity, ...listTriggers]),
  creates: byKey([uploadFile, ...fileCreates, ...resourceCreates]),
  searches: byKey(searches),
  searchOrCreates: {
    find_label: {
      key: 'find_label',
      display: {
        label: 'Find or Create Label',
        description: 'Finds a label by its name, or creates it when there is none.',
      },
      search: 'find_label',
      create: 'create_label',
    },
  },
};
