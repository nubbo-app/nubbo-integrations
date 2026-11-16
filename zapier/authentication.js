'use strict';

const { nubboRequest } = require('./lib/client');

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText:
        'Create a key in Nubbo, in [Settings › API](https://app.nubbo.app/settings?tab=api) (Pro) or in your team page, **API** tab (Teams). It starts with `nbk_` and is shown once.',
    },
  ],
  test: (z, bundle) => nubboRequest(z, bundle, { path: '/v1/me' }),
  connectionLabel: (z, bundle) => {
    const { workspace, key } = bundle.inputData;
    return key?.name ? `${workspace.name} (${key.name})` : workspace.name;
  },
};
