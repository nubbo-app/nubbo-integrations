'use strict';

const bucketField = (required = true, helpText = 'The bucket in Nubbo.') => ({
  key: 'bucketId',
  label: 'Bucket',
  required,
  dynamic: 'bucket_list.id.name',
  helpText,
});

const fileIdField = (helpText = 'The ID of the file or folder, from a trigger or a search.') => ({
  key: 'fileId',
  label: 'File ID',
  required: true,
  search: 'find_file.id',
  helpText,
});

const fileIdsField = {
  key: 'fileIds',
  label: 'File IDs',
  required: true,
  list: true,
  helpText: 'The IDs of the files or folders, from a trigger or a search.',
};

const conflictField = (choices, fallback, helpText) => ({
  key: 'conflict',
  label: 'If the Name Is Taken',
  choices,
  default: fallback,
  helpText,
});

const CONFLICT_CHOICES = {
  fail: 'Stop with an error',
  rename: 'Keep both, renaming the new one',
  skip: 'Skip it',
  replace: 'Replace the existing file',
};

const conflictChoices = (...keys) =>
  keys.map((key) => ({ value: key, sample: key, label: CONFLICT_CHOICES[key] }));

const expiresAtField = (helpText) => ({
  key: 'expiresAt',
  label: 'Expires At',
  type: 'datetime',
  helpText,
});

const passwordField = (helpText) => ({
  key: 'accessPhrase',
  label: 'Visitor Password',
  helpText,
});

const isoDateOf = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

const numberOf = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
};

const booleanOf = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['true', 'yes', '1'].includes(String(value).toLowerCase());
};

const listOf = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : String(value).split(','))
    .map((item) => String(item).trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
};

const compact = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const folderPathOf = (value) => {
  const path = String(value ?? '')
    .trim()
    .replace(/^\/+/, '');
  return path && !path.endsWith('/') ? `${path}/` : path;
};

module.exports = {
  booleanOf,
  bucketField,
  compact,
  conflictChoices,
  conflictField,
  expiresAtField,
  fileIdField,
  fileIdsField,
  folderPathOf,
  isoDateOf,
  listOf,
  numberOf,
  passwordField,
};
