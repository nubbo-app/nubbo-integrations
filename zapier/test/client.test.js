'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { errors } = require('zapier-platform-core');

const {
  addApiKey,
  baseUrl,
  flowOf,
  idempotencyKeyOf,
  nubboRequest,
  queryOf,
} = require('../lib/client');

const fakeZ = (responses = []) => ({
  errors,
  hash: (algorithm, data) => crypto.createHash(algorithm).update(data).digest('hex'),
  requests: [],
  async request(options) {
    this.requests.push(options);
    const { status, body = {}, headers = {} } = responses.shift();
    return {
      status,
      content: JSON.stringify(body),
      getHeader: (name) => headers[name.toLowerCase()],
    };
  },
});

const bundle = { authData: { apiKey: 'nbk_test' }, inputData: { b: 1, a: [2, 3] }, meta: {} };

test('the key goes only to the Nubbo API', () => {
  const toNubbo = addApiKey({ url: `${baseUrl()}/v1/me`, headers: {} }, null, bundle);
  assert.equal(toNubbo.headers.Authorization, 'Bearer nbk_test');
  const toProvider = addApiKey(
    { url: 'https://bucket.example.com/a.pdf', headers: {} },
    null,
    bundle,
  );
  assert.equal(toProvider.headers.Authorization, undefined);
});

test('query values drop empties and join lists', () => {
  assert.deepEqual(queryOf({ a: '', b: null, c: ['X', 'Y'], d: 0, e: [] }), { c: 'X,Y', d: '0' });
});

test('idempotency keys are stable for the same input and differ per call', () => {
  const z = fakeZ();
  const reordered = { ...bundle, inputData: { a: [2, 3], b: 1 } };
  assert.equal(
    idempotencyKeyOf(z, bundle, 'create_link'),
    idempotencyKeyOf(z, reordered, 'create_link'),
  );
  assert.notEqual(
    idempotencyKeyOf(z, bundle, 'upload_file', 'start'),
    idempotencyKeyOf(z, bundle, 'upload_file', 'complete', 'u1'),
  );
  assert.match(idempotencyKeyOf(z, bundle, 'create_link'), /^zapier-[0-9a-f]{64}$/);
});

test('each Zap polls as its own flow, and samples apart from live polls', () => {
  assert.equal(flowOf({ meta: { zap: { id: '42' } } }), 'zapier:42');
  assert.equal(flowOf({ meta: { zap: { id: '42' }, isLoadingSample: true } }), 'zapier:42:sample');
  assert.equal(flowOf({ meta: {} }), 'zapier');
});

test('a rate limit becomes a ThrottledError with Retry-After', async () => {
  const z = fakeZ([
    {
      status: 429,
      body: { code: 'API_RATE_LIMITED', message: 'Too many' },
      headers: { 'retry-after': '17' },
    },
  ]);
  await assert.rejects(nubboRequest(z, bundle, { path: '/v1/buckets' }), (error) => {
    assert.equal(error.name, 'ThrottledError');
    assert.equal(JSON.parse(error.message).delay, 17);
    return true;
  });
});

test('a spent quota is a plain error, not a retry', async () => {
  const z = fakeZ([
    {
      status: 429,
      body: { code: 'API_QUOTA_EXCEEDED', message: 'Quota' },
      headers: { 'retry-after': '900000' },
    },
  ]);
  await assert.rejects(nubboRequest(z, bundle, { path: '/v1/buckets' }), (error) => {
    assert.equal(error.name, 'AppError');
    assert.equal(JSON.parse(error.message).code, 'API_QUOTA_EXCEEDED');
    return true;
  });
});

test('a refused key asks to reconnect', async () => {
  const z = fakeZ([{ status: 401, body: { code: 'API_KEY_REVOKED', message: 'Revoked' } }]);
  await assert.rejects(nubboRequest(z, bundle, { path: '/v1/me' }), { name: 'ExpiredAuthError' });
});

test('flow and idempotency headers are sent', async () => {
  const z = fakeZ([{ status: 200, body: { data: [] } }]);
  await nubboRequest(z, bundle, {
    path: '/v1/triggers/new-files',
    flow: 'zapier:1',
    idempotencyKey: 'k',
  });
  assert.equal(z.requests[0].headers['X-Nubbo-Flow'], 'zapier:1');
  assert.equal(z.requests[0].headers['Idempotency-Key'], 'k');
  assert.equal(z.requests[0].throwForThrottlingEarly, false);
});
