'use strict';

const { version } = require('../package.json');

const DEFAULT_BASE_URL = 'https://api.nubbo.app';
const THROTTLE_CODES = ['API_RATE_LIMITED', 'API_TRIGGER_TOO_FREQUENT'];
const DEFAULT_RETRY_AFTER_SECONDS = 60;
const PAGE_LIMIT = 100;

const baseUrl = () => (process.env.NUBBO_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const isNubboUrl = (url) => typeof url === 'string' && url.startsWith(`${baseUrl()}/v1/`);

const addApiKey = (request, z, bundle) => {
  if (!isNubboUrl(request.url)) return request;
  request.headers = {
    ...request.headers,
    Accept: 'application/json',
    'User-Agent': `Zapier nubbo-zapier/${version}`,
    Authorization: `Bearer ${bundle.authData.apiKey}`,
  };
  return request;
};

const queryOf = (params = {}) => {
  const query = {};
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) query[name] = value.join(',');
      continue;
    }
    query[name] = String(value);
  }
  return query;
};

const bodyOf = (response) => {
  try {
    return response.content ? JSON.parse(response.content) : {};
  } catch {
    return {};
  }
};

const secondsOf = (value, now) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  if (/^\d+$/.test(text)) return Number(text);
  const date = Date.parse(text);
  return Number.isNaN(date) ? undefined : Math.ceil((date - now) / 1000);
};

const retryAfterOf = (response, now = Date.now()) => {
  const seconds =
    secondsOf(response.getHeader('retry-after'), now) ??
    secondsOf(response.getHeader('x-ratelimit-reset'), now);
  return seconds !== undefined && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS;
};

const errorOf = (z, response) => {
  const body = bodyOf(response);
  const code = typeof body.code === 'string' ? body.code : `HTTP_${response.status}`;
  const message = Array.isArray(body.message)
    ? body.message.join('; ')
    : body.message || `The Nubbo API answered ${response.status}`;
  const requestId = body.requestId || response.getHeader('x-request-id');
  const text = requestId ? `${message} (${code}, request ${requestId})` : `${message} (${code})`;
  if (response.status === 401) return new z.errors.ExpiredAuthError(text);
  if (response.status === 429 && THROTTLE_CODES.includes(code)) {
    return new z.errors.ThrottledError(text, retryAfterOf(response));
  }
  return new z.errors.Error(text, code, response.status);
};

const nubboRequest = async (
  z,
  bundle,
  { method = 'GET', path, params, body, idempotencyKey, flow, missingAsNull = false },
) => {
  const headers = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (flow) headers['X-Nubbo-Flow'] = flow;
  const request = {
    method,
    url: `${baseUrl()}${path}`,
    params: queryOf(params),
    headers,
    skipThrowForStatus: true,
    throwForThrottlingEarly: false,
  };
  if (body !== undefined) request.body = body;
  const response = await z.request(request);
  if (response.status === 404 && missingAsNull) return null;
  if (response.status >= 400) throw errorOf(z, response);
  return bodyOf(response);
};

const idempotencyKeyOf = (z, bundle, action, ...parts) => {
  const guard = String(bundle.inputData?.duplicateGuard ?? '').trim();
  if (!guard) return undefined;
  return `zapier-${z.hash(
    'sha256',
    JSON.stringify([bundle.meta?.zap?.id ?? null, action, guard, ...parts]),
  )}`;
};

const flowOf = (bundle) => {
  const zapId = bundle.meta?.zap?.id;
  const flow = zapId ? `zapier:${zapId}` : 'zapier';
  return bundle.meta?.isLoadingSample ? `${flow}:sample` : flow;
};

const listPage = async (z, bundle, path, params = {}) => {
  const page = bundle.meta?.page ?? 0;
  let cursor;
  if (page > 0) {
    cursor = await z.cursor.get();
    if (!cursor) return [];
  }
  const result = await nubboRequest(z, bundle, {
    path,
    params: { ...params, limit: PAGE_LIMIT, cursor },
  });
  if (page > 0 || result.nextCursor) await z.cursor.set(result.nextCursor ?? '');
  return result.data ?? [];
};

const findAll = async (z, bundle, path, params, matches, maxPages = 10) => {
  const found = [];
  let cursor;
  for (let page = 0; page < maxPages; page++) {
    const result = await nubboRequest(z, bundle, {
      path,
      params: { ...params, limit: PAGE_LIMIT, cursor },
    });
    found.push(...(result.data ?? []).filter(matches));
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return found;
};

const sameName = (wanted) => (value) =>
  typeof value === 'string' && value.trim().toLowerCase() === String(wanted).trim().toLowerCase();

const idPath = (value) => encodeURIComponent(String(value).trim());

module.exports = {
  PAGE_LIMIT,
  addApiKey,
  baseUrl,
  findAll,
  flowOf,
  idPath,
  idempotencyKeyOf,
  isNubboUrl,
  listPage,
  nubboRequest,
  queryOf,
  retryAfterOf,
  sameName,
};
