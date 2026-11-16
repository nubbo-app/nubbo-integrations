'use strict';

const ACTIVITY_TYPES = require('../lib/activity-types');
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
    '/v1/triggers/new-activity',
    { types: bundle.inputData.types },
    { ignoreOwn: ignoresOwn(bundle), download: false },
  );

module.exports = {
  key: 'new_activity',
  noun: 'Activity Event',
  display: {
    label: 'New Activity Event',
    description:
      'Triggers when something happens in your Nubbo space, such as a link created or a gallery visited.',
  },
  operation: {
    type: 'polling',
    inputFields: [
      {
        key: 'types',
        label: 'Event Types',
        list: true,
        choices: ACTIVITY_TYPES,
        helpText: 'Only these kinds of events. Leave empty for every kind.',
      },
      IGNORE_OWN_CHANGES_FIELD,
    ],
    perform,
    sample: ACTIVITY_SAMPLE,
    outputFields: ACTIVITY_OUTPUT_FIELDS,
  },
};
