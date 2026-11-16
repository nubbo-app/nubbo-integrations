'use strict';

const { idempotencyKeyOf, nubboRequest } = require('./client');

const createAction = ({ key, noun, label, description, inputFields, sample, request, after }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    inputFields,
    perform: async (z, bundle) => {
      const { method = 'POST', path, body } = request(bundle);
      const idempotent = method === 'POST' || method === 'PATCH';
      const result = await nubboRequest(z, bundle, {
        method,
        path,
        body,
        idempotencyKey: idempotent ? idempotencyKeyOf(z, bundle, key) : undefined,
      });
      return after ? after(z, bundle, result) : result;
    },
    sample,
  },
});

module.exports = { createAction };
