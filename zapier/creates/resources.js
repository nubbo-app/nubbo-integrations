'use strict';

const { idPath } = require('../lib/client');
const {
  booleanOf,
  bucketField,
  compact,
  expiresAtField,
  fileIdField,
  folderPathOf,
  isoDateOf,
  listOf,
  numberOf,
  passwordField,
} = require('../lib/fields');
const { createAction } = require('../lib/operations');

const LINK_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a80',
  encrypted: false,
  kind: 'file',
  fileId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61',
  bucketId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
  path: 'invoices/2026/invoice-0042.pdf',
  name: 'invoice-0042.pdf',
  url: 'https://app.nubbo.app/s/Xk3pQ9',
  status: 'active',
  hasPassword: false,
  maxDownloads: 10,
  downloadCount: 0,
  viewCount: 0,
  expiresAt: '2026-11-20T00:00:00.000Z',
  createdAt: '2026-11-14T09:00:00.000Z',
};

const INBOX_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a90',
  encrypted: false,
  name: 'Invoices from Acme',
  description: null,
  bucketId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
  path: 'inbox/acme/',
  url: 'https://app.nubbo.app/r/Yh7Lm2',
  status: 'active',
  hasPassword: false,
  maxFileSize: null,
  allowedFileTypes: ['pdf'],
  maxUploads: null,
  uploadCount: 0,
  visitorIdentity: 'none',
  expiresAt: null,
  createdAt: '2026-11-14T09:00:00.000Z',
};

const GALLERY_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4aa0',
  encrypted: false,
  folderId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61',
  bucketId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
  path: 'shoots/summer/',
  title: 'Summer shoot',
  layout: 'masonry',
  individualDownloads: true,
  zipDownload: true,
  url: 'https://app.nubbo.app/g/Pq8Rt3',
  status: 'active',
  hasPassword: false,
  viewCount: 0,
  downloadCount: 0,
  expiresAt: null,
  createdAt: '2026-11-14T09:00:00.000Z',
};

const LABEL_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62',
  encrypted: false,
  name: 'Paid',
  color: '#22c55e',
  description: 'Invoices already paid',
  groupId: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const EMBED_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4ab0',
  kind: 'inbox',
  name: 'Upload box',
  status: 'active',
  inboxId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a90',
  linkId: null,
  bucketId: null,
  path: null,
  allowedDomains: ['example.com'],
  hasPassword: false,
  config: { presentation: 'dropzone', locale: 'auto' },
  snippet: {
    html: '<iframe src="https://app.nubbo.app/e/Zt4" …></iframe>',
    react: '<iframe src="https://app.nubbo.app/e/Zt4" … />',
    url: 'https://app.nubbo.app/e/Zt4',
  },
  impressionCount: 0,
  expiresAt: null,
  createdAt: '2026-11-14T09:00:00.000Z',
  updatedAt: '2026-11-14T09:00:00.000Z',
};

const AUTOMATION_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4ac0',
  name: 'File invoices by month',
  isActive: true,
  pausedReason: null,
  trigger: 'FOLDER_UPLOAD',
  action: 'MOVE',
  bucketId: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
  folderPrefix: 'inbox/',
  fileRequestId: null,
  destinationFolder: 'invoices/',
  usesAi: false,
  lastRunAt: null,
  createdAt: '2026-11-14T09:00:00.000Z',
};

const PROJECT_SAMPLE = {
  id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a63',
  name: 'Marketing',
  color: '#6366f1',
  archived: false,
  folderCount: 1,
  createdAt: '2026-09-01T08:00:00.000Z',
  lastActivityAt: null,
  folders: [],
};

const linkIdField = {
  key: 'linkId',
  label: 'Share Link',
  required: true,
  dynamic: 'link_list.id.name',
  search: 'find_link.id',
};

const inboxIdField = (required = true) => ({
  key: 'inboxId',
  label: 'File Request',
  required,
  dynamic: 'inbox_list.id.name',
  search: 'find_inbox.id',
});

const activeField = (noun) => ({
  key: 'active',
  label: 'Active',
  type: 'boolean',
  helpText: `No pauses the ${noun}; yes turns it back on. Leave empty to keep it as it is.`,
});

const createLink = createAction({
  key: 'create_link',
  noun: 'Share Link',
  label: 'Create Share Link',
  description: 'Creates a share link for a file or folder.',
  inputFields: [
    fileIdField('The file or folder to share, from a trigger or a search.'),
    expiresAtField('When the link stops working. Leave empty for a link that does not expire.'),
    passwordField('A password visitors must type, 4 to 50 characters.'),
    { key: 'maxDownloads', label: 'Download Limit', type: 'integer' },
  ],
  sample: LINK_SAMPLE,
  request: ({ inputData }) => ({
    path: '/v1/links',
    body: compact({
      fileId: inputData.fileId,
      expiresAt: isoDateOf(inputData.expiresAt),
      password: inputData.accessPhrase || undefined,
      maxDownloads: numberOf(inputData.maxDownloads),
    }),
  }),
});

const updateLink = createAction({
  key: 'update_link',
  noun: 'Share Link',
  label: 'Update Share Link',
  description: 'Changes, pauses or turns back on a share link.',
  inputFields: [
    linkIdField,
    activeField('link'),
    expiresAtField('A new expiry date. Leave empty to keep the current one.'),
    passwordField('A new password. Leave empty to keep the current one.'),
    { key: 'maxDownloads', label: 'Download Limit', type: 'integer' },
  ],
  sample: LINK_SAMPLE,
  request: ({ inputData }) => ({
    method: 'PATCH',
    path: `/v1/links/${idPath(inputData.linkId)}`,
    body: compact({
      active: booleanOf(inputData.active),
      expiresAt: isoDateOf(inputData.expiresAt),
      password: inputData.accessPhrase || undefined,
      maxDownloads: numberOf(inputData.maxDownloads),
    }),
  }),
});

const createInbox = createAction({
  key: 'create_inbox',
  noun: 'File Request',
  label: 'Create File Request',
  description: 'Creates a file request: a public link where anyone can send files to a folder.',
  inputFields: [
    bucketField(),
    {
      key: 'path',
      label: 'Folder',
      helpText:
        'The folder uploads land in, such as `inbox/acme/`. Leave empty for the top of the bucket.',
    },
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    expiresAtField('When the file request closes. Leave empty to keep it open.'),
    passwordField('A password senders must type, 4 to 50 characters.'),
    {
      key: 'allowedFileTypes',
      label: 'Allowed File Types',
      list: true,
      helpText: 'File extensions accepted, such as `pdf`. Leave empty to accept every type.',
    },
    { key: 'maxFileSize', label: 'Largest File (Bytes)', type: 'integer' },
    { key: 'maxUploads', label: 'Upload Limit', type: 'integer' },
    {
      key: 'visitorIdentity',
      label: 'Ask Senders for Their Name',
      choices: [
        { value: 'none', sample: 'none', label: 'No' },
        { value: 'optional', sample: 'optional', label: 'Optional' },
        { value: 'required', sample: 'required', label: 'Required' },
      ],
      default: 'none',
    },
  ],
  sample: INBOX_SAMPLE,
  request: ({ inputData }) => ({
    path: '/v1/inboxes',
    body: compact({
      bucketId: inputData.bucketId,
      path: folderPathOf(inputData.path),
      name: inputData.name,
      description: inputData.description || undefined,
      expiresAt: isoDateOf(inputData.expiresAt),
      password: inputData.accessPhrase || undefined,
      allowedFileTypes: listOf(inputData.allowedFileTypes),
      maxFileSize: numberOf(inputData.maxFileSize),
      maxUploads: numberOf(inputData.maxUploads),
      visitorIdentity: inputData.visitorIdentity || undefined,
    }),
  }),
});

const updateInbox = createAction({
  key: 'update_inbox',
  noun: 'File Request',
  label: 'Update File Request',
  description: 'Changes, pauses or turns back on a file request.',
  inputFields: [
    inboxIdField(),
    activeField('file request'),
    { key: 'name', label: 'Name' },
    expiresAtField('A new closing date. Leave empty to keep the current one.'),
    passwordField('A new password. Leave empty to keep the current one.'),
    { key: 'maxUploads', label: 'Upload Limit', type: 'integer' },
  ],
  sample: INBOX_SAMPLE,
  request: ({ inputData }) => ({
    method: 'PATCH',
    path: `/v1/inboxes/${idPath(inputData.inboxId)}`,
    body: compact({
      active: booleanOf(inputData.active),
      name: inputData.name || undefined,
      expiresAt: isoDateOf(inputData.expiresAt),
      password: inputData.accessPhrase || undefined,
      maxUploads: numberOf(inputData.maxUploads),
    }),
  }),
});

const createGallery = createAction({
  key: 'create_gallery',
  noun: 'Gallery',
  label: 'Create Gallery',
  description: 'Creates a public gallery of the photos and videos of a folder.',
  inputFields: [
    fileIdField('The ID of the folder, from a trigger or a search.'),
    { key: 'title', label: 'Title', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    {
      key: 'layout',
      label: 'Layout',
      choices: [
        { value: 'masonry', sample: 'masonry', label: 'Masonry' },
        { value: 'grid', sample: 'grid', label: 'Grid' },
        { value: 'slideshow', sample: 'slideshow', label: 'Slideshow' },
      ],
      default: 'masonry',
    },
    { key: 'individualDownloads', label: 'Allow Downloading Each File', type: 'boolean' },
    { key: 'zipDownload', label: 'Allow Downloading Everything as a ZIP', type: 'boolean' },
    passwordField('A password visitors must type, 4 to 50 characters.'),
    expiresAtField(
      'When the gallery stops working. Leave empty for a gallery that does not expire.',
    ),
    { key: 'watermarkText', label: 'Watermark Text' },
  ],
  sample: GALLERY_SAMPLE,
  request: ({ inputData }) => ({
    path: '/v1/galleries',
    body: compact({
      fileId: inputData.fileId,
      title: inputData.title,
      description: inputData.description || undefined,
      layout: inputData.layout || undefined,
      individualDownloads: booleanOf(inputData.individualDownloads),
      zipDownload: booleanOf(inputData.zipDownload),
      password: inputData.accessPhrase || undefined,
      expiresAt: isoDateOf(inputData.expiresAt),
      watermarkText: inputData.watermarkText || undefined,
    }),
  }),
});

const updateGallery = createAction({
  key: 'update_gallery',
  noun: 'Gallery',
  label: 'Update Gallery',
  description: 'Changes, pauses or turns back on a gallery.',
  inputFields: [
    {
      key: 'galleryId',
      label: 'Gallery',
      required: true,
      dynamic: 'gallery_list.id.name',
      search: 'find_gallery.id',
    },
    activeField('gallery'),
    { key: 'title', label: 'Title' },
    expiresAtField('A new expiry date. Leave empty to keep the current one.'),
    passwordField('A new password. Leave empty to keep the current one.'),
  ],
  sample: GALLERY_SAMPLE,
  request: ({ inputData }) => ({
    method: 'PATCH',
    path: `/v1/galleries/${idPath(inputData.galleryId)}`,
    body: compact({
      active: booleanOf(inputData.active),
      title: inputData.title || undefined,
      expiresAt: isoDateOf(inputData.expiresAt),
      password: inputData.accessPhrase || undefined,
    }),
  }),
});

const createLabel = createAction({
  key: 'create_label',
  noun: 'Label',
  label: 'Create Label',
  description: 'Creates a label. Needs a key that reads and writes the whole space.',
  inputFields: [
    { key: 'name', label: 'Name', required: true },
    {
      key: 'color',
      label: 'Color',
      helpText: 'A hex color such as `#22c55e`. Leave empty for a color from the palette.',
    },
    { key: 'description', label: 'Description' },
  ],
  sample: LABEL_SAMPLE,
  request: ({ inputData }) => ({
    path: '/v1/labels',
    body: compact({
      name: inputData.name,
      color: inputData.color || undefined,
      description: inputData.description || undefined,
    }),
  }),
});

const createEmbed = createAction({
  key: 'create_embed',
  noun: 'Embed',
  label: 'Create Embed',
  description: 'Creates an embed to show a file request, a share link or a folder on a website.',
  inputFields: [
    {
      key: 'kind',
      label: 'Kind',
      required: true,
      choices: [
        { value: 'inbox', sample: 'inbox', label: 'File request upload box' },
        { value: 'shared', sample: 'shared', label: 'Share link' },
        { value: 'explorer', sample: 'explorer', label: 'Folder explorer' },
      ],
    },
    { key: 'name', label: 'Name', required: true },
    { ...inboxIdField(false), helpText: 'For a file request upload box.' },
    {
      key: 'linkId',
      label: 'Share Link',
      dynamic: 'link_list.id.name',
      search: 'find_link.id',
      helpText: 'For a share link embed.',
    },
    bucketField(false, 'For a folder explorer.'),
    {
      key: 'path',
      label: 'Folder',
      helpText: 'For a folder explorer. Leave empty for the whole bucket.',
    },
    {
      key: 'allowedDomains',
      label: 'Allowed Sites',
      list: true,
      helpText:
        'Domains allowed to show the embed, such as `example.com`. Leave empty to allow any site.',
    },
    expiresAtField('When the embed stops working.'),
    passwordField('For a folder explorer, 4 to 128 characters.'),
  ],
  sample: EMBED_SAMPLE,
  request: ({ inputData }) => ({
    path: '/v1/embeds',
    body: compact({
      kind: inputData.kind,
      name: inputData.name,
      inboxId: inputData.kind === 'inbox' ? inputData.inboxId : undefined,
      linkId: inputData.kind === 'shared' ? inputData.linkId : undefined,
      bucketId: inputData.kind === 'explorer' ? inputData.bucketId : undefined,
      path: inputData.kind === 'explorer' ? folderPathOf(inputData.path) : undefined,
      allowedDomains: listOf(inputData.allowedDomains),
      expiresAt: isoDateOf(inputData.expiresAt),
      password: inputData.accessPhrase || undefined,
    }),
  }),
});

const createAutomation = createAction({
  key: 'create_automation',
  noun: 'Automation Rule',
  label: 'Create Automation Rule',
  description:
    'Creates an automation rule that Nubbo runs by itself, such as moving every new file of a folder.',
  inputFields: [
    { key: 'name', label: 'Name', required: true },
    {
      key: 'trigger',
      label: 'When',
      required: true,
      choices: [
        { value: 'FOLDER_UPLOAD', sample: 'FOLDER_UPLOAD', label: 'A file arrives in a folder' },
        {
          value: 'INBOX_UPLOAD',
          sample: 'INBOX_UPLOAD',
          label: 'A file arrives through a file request',
        },
        { value: 'SCHEDULE', sample: 'SCHEDULE', label: 'On a schedule' },
        { value: 'THRESHOLD', sample: 'THRESHOLD', label: 'A bucket passes a size' },
        { value: 'INACTIVITY', sample: 'INACTIVITY', label: 'Files go unused for a while' },
      ],
    },
    bucketField(false, 'The bucket the rule watches.'),
    {
      key: 'folderPrefix',
      label: 'Folder',
      helpText: 'The folder the rule watches, such as `inbox/`.',
    },
    {
      ...inboxIdField(false),
      key: 'fileRequestId',
      helpText: 'When a file arrives through a file request.',
    },
    {
      key: 'interval',
      label: 'Schedule',
      choices: [
        { value: 'DAILY', sample: 'DAILY', label: 'Daily' },
        { value: 'WEEKLY', sample: 'WEEKLY', label: 'Weekly' },
        { value: 'MONTHLY', sample: 'MONTHLY', label: 'Monthly' },
      ],
      helpText: 'For rules on a schedule.',
    },
    {
      key: 'thresholdGb',
      label: 'Size (GB)',
      type: 'number',
      helpText: 'For rules on a bucket size.',
    },
    {
      key: 'inactivityDays',
      label: 'Unused for (Days)',
      type: 'integer',
      helpText: 'For rules on unused files.',
    },
    {
      key: 'action',
      label: 'Then',
      required: true,
      choices: [
        { value: 'MOVE', sample: 'MOVE', label: 'Move the file' },
        {
          value: 'COPY_TO_BUCKET',
          sample: 'COPY_TO_BUCKET',
          label: 'Copy or move it to another bucket',
        },
        {
          value: 'MIRROR_TO_BUCKET',
          sample: 'MIRROR_TO_BUCKET',
          label: 'Mirror the folder to another bucket',
        },
        { value: 'SHARE_LINK', sample: 'SHARE_LINK', label: 'Create a share link' },
        { value: 'COMPRESS', sample: 'COMPRESS', label: 'Compress into a ZIP' },
        { value: 'FAVORITE', sample: 'FAVORITE', label: 'Add to favorites' },
        { value: 'HIDE', sample: 'HIDE', label: 'Hide it' },
        { value: 'TRASH', sample: 'TRASH', label: 'Move to trash' },
        { value: 'NOTIFY', sample: 'NOTIFY', label: 'Notify me' },
      ],
      helpText: 'Rules that use Nubbo AI are set up in the Nubbo app.',
    },
    { key: 'destinationFolder', label: 'Destination Folder', helpText: 'For moves.' },
    {
      key: 'copyDestBucketId',
      label: 'Destination Bucket',
      dynamic: 'bucket_list.id.name',
      helpText: 'For copies and mirrors to another bucket.',
    },
    {
      key: 'copyDestinationFolder',
      label: 'Destination Folder in That Bucket',
      helpText: 'For copies and mirrors to another bucket.',
    },
    {
      key: 'copyMode',
      label: 'Copy or Move',
      choices: [
        { value: 'copy', sample: 'copy', label: 'Copy' },
        { value: 'move', sample: 'move', label: 'Move' },
      ],
      helpText: 'For copies to another bucket.',
    },
    {
      key: 'compressDestinationFolder',
      label: 'ZIP Destination Folder',
      helpText: 'For compressing into a ZIP.',
    },
    {
      key: 'trashOlderThanDays',
      label: 'Trash Files Older Than (Days)',
      type: 'integer',
      helpText: 'For moving to trash.',
    },
    {
      key: 'shareExpiresInDays',
      label: 'Link Expires After (Days)',
      type: 'integer',
      helpText: 'For share links.',
    },
    { key: 'shareAccessPhrase', label: 'Link Visitor Password', helpText: 'For share links.' },
    {
      key: 'shareMaxDownloads',
      label: 'Link Download Limit',
      type: 'integer',
      helpText: 'For share links.',
    },
  ],
  sample: AUTOMATION_SAMPLE,
  request: ({ inputData }) => ({
    path: '/v1/automations',
    body: compact({
      name: inputData.name,
      trigger: inputData.trigger,
      bucketId: inputData.bucketId || undefined,
      folderPrefix: inputData.folderPrefix ? folderPathOf(inputData.folderPrefix) : undefined,
      fileRequestId: inputData.fileRequestId || undefined,
      interval: inputData.interval || undefined,
      thresholdGb: numberOf(inputData.thresholdGb),
      inactivityDays: numberOf(inputData.inactivityDays),
      action: inputData.action,
      destinationFolder: inputData.destinationFolder
        ? folderPathOf(inputData.destinationFolder)
        : undefined,
      copyDestBucketId: inputData.copyDestBucketId || undefined,
      copyDestinationFolder: inputData.copyDestinationFolder
        ? folderPathOf(inputData.copyDestinationFolder)
        : undefined,
      copyMode: inputData.copyMode || undefined,
      compressDestinationFolder: inputData.compressDestinationFolder
        ? folderPathOf(inputData.compressDestinationFolder)
        : undefined,
      trashOlderThanDays: numberOf(inputData.trashOlderThanDays),
      shareExpiresInDays: numberOf(inputData.shareExpiresInDays),
      sharePassword: inputData.shareAccessPhrase || undefined,
      shareMaxDownloads: numberOf(inputData.shareMaxDownloads),
    }),
  }),
});

const setAutomationState = createAction({
  key: 'set_automation_state',
  noun: 'Automation Rule',
  label: 'Pause or Resume Automation Rule',
  description: 'Pauses an automation rule, or turns a paused one back on.',
  inputFields: [
    {
      key: 'ruleId',
      label: 'Automation Rule',
      required: true,
      dynamic: 'automation_list.id.name',
    },
    {
      key: 'state',
      label: 'Action',
      required: true,
      choices: [
        { value: 'pause', sample: 'pause', label: 'Pause' },
        { value: 'resume', sample: 'resume', label: 'Resume' },
      ],
    },
  ],
  sample: AUTOMATION_SAMPLE,
  request: ({ inputData }) => ({
    path: `/v1/automations/${idPath(inputData.ruleId)}/${inputData.state === 'resume' ? 'resume' : 'pause'}`,
  }),
});

const addFolderToProject = createAction({
  key: 'add_folder_to_project',
  noun: 'Project',
  label: 'Add Folder to Project',
  description: 'Adds a folder to a project. Needs a key that reads and writes the whole space.',
  inputFields: [
    {
      key: 'projectId',
      label: 'Project',
      required: true,
      dynamic: 'project_list.id.name',
      search: 'find_project.id',
    },
    bucketField(),
    { key: 'path', label: 'Folder', required: true, helpText: 'Such as `clients/acme/`.' },
  ],
  sample: PROJECT_SAMPLE,
  request: ({ inputData }) => ({
    path: `/v1/projects/${idPath(inputData.projectId)}/items`,
    body: { folders: [{ bucketId: inputData.bucketId, path: folderPathOf(inputData.path) }] },
  }),
});

module.exports = {
  samples: {
    LINK_SAMPLE,
    INBOX_SAMPLE,
    GALLERY_SAMPLE,
    LABEL_SAMPLE,
    PROJECT_SAMPLE,
  },
  creates: [
    createLink,
    updateLink,
    createInbox,
    updateInbox,
    createGallery,
    updateGallery,
    createLabel,
    createEmbed,
    createAutomation,
    setAutomationState,
    addFolderToProject,
  ],
};
