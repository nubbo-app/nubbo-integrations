'use strict';

const { listPage } = require('../lib/client');

const listTrigger = (key, noun, path, nameOf, sample) => ({
  key,
  noun,
  display: {
    label: `List ${noun}s`,
    description: `Lists the ${noun.toLowerCase()}s the API key reaches, for dropdowns.`,
    hidden: true,
  },
  operation: {
    type: 'polling',
    canPaginate: true,
    perform: async (z, bundle) =>
      (await listPage(z, bundle, path))
        .filter((item) => item.id && !item.encrypted)
        .map((item) => ({ ...item, name: nameOf(item) })),
    sample,
  },
});

module.exports = [
  listTrigger('bucket_list', 'Bucket', '/v1/buckets', (bucket) => bucket.name, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60',
    name: 'Facturas',
  }),
  listTrigger('inbox_list', 'File Request', '/v1/inboxes', (inbox) => inbox.name, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a90',
    name: 'Invoices from Acme',
  }),
  listTrigger('label_list', 'Label', '/v1/labels', (label) => label.name, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a62',
    name: 'Paid',
  }),
  listTrigger('project_list', 'Project', '/v1/projects', (project) => project.name, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a63',
    name: 'Marketing',
  }),
  listTrigger('link_list', 'Share Link', '/v1/links', (link) => link.name ?? link.path, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a80',
    name: 'invoice-0042.pdf',
  }),
  listTrigger('gallery_list', 'Gallery', '/v1/galleries', (gallery) => gallery.title, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4aa0',
    name: 'Summer shoot',
  }),
  listTrigger('automation_list', 'Automation Rule', '/v1/automations', (rule) => rule.name, {
    id: '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4ac0',
    name: 'File invoices by month',
  }),
];
