'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');
const zapier = require('zapier-platform-core');

const App = require('../index');

const apiKey = process.env.NUBBO_TEST_API_KEY;
const readKey = process.env.NUBBO_TEST_READ_API_KEY;
const skip =
  apiKey && process.env.NUBBO_BASE_URL ? false : 'set NUBBO_BASE_URL and NUBBO_TEST_API_KEY';
const appTester = zapier.createAppTester(App);
const run = Date.now().toString(36);
const folder = `zapier-tests/${run}/`;
const content = Buffer.from(`Nubbo Zapier test ${run}\n`);
const zapId = 'live-test';

const bundleOf = (inputData = {}, meta = {}) => ({
  authData: { apiKey },
  inputData,
  meta: { zap: { id: zapId }, ...meta },
});

const state = {};
let server;

before(async () => {
  server = http.createServer((request, response) => {
    if (request.url === '/big') {
      response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': 200 * 1024 * 1024 });
      response.write(Buffer.alloc(1024));
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="from-url.txt"',
    });
    response.end(content);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test('the connection shows the space and the key', { skip }, async () => {
  const me = await appTester(App.authentication.test, bundleOf());
  assert.equal(me.plan === 'PRO' || me.plan === 'TEAMS', true);
  const label = App.authentication.connectionLabel(null, { inputData: me });
  assert.equal(label, `${me.workspace.name} (${me.key.name})`);
});

test('dropdowns list the buckets', { skip }, async () => {
  const buckets = await appTester(
    App.triggers.bucket_list.operation.perform,
    bundleOf({}, { page: 0 }),
  );
  assert.ok(buckets.length > 0);
  state.bucketId = buckets[0].id;
});

test('a folder is created', { skip }, async () => {
  const created = await appTester(
    App.creates.create_folder.operation.perform,
    bundleOf({ bucketId: state.bucketId, path: folder }),
  );
  assert.equal(created.kind, 'folder');
});

test('upload from a URL goes straight to the provider', { skip }, async () => {
  const url = `http://127.0.0.1:${server.address().port}/file`;
  const file = await appTester(
    App.creates.upload_file.operation.perform,
    bundleOf({ bucketId: state.bucketId, file: url, folder, conflict: 'rename' }),
  );
  assert.equal(file.name, 'from-url.txt');
  assert.equal(file.size, content.length);
  state.fileId = file.id;
});

test('files above 100 MB fail before downloading', { skip }, async () => {
  await assert.rejects(
    appTester(
      App.creates.upload_file.operation.perform,
      bundleOf({
        bucketId: state.bucketId,
        file: `http://127.0.0.1:${server.address().port}/big`,
        folder,
      }),
    ),
    /ZAPIER_FILE_TOO_LARGE/,
  );
});

test('plain text uploads as a text file', { skip }, async () => {
  const file = await appTester(
    App.creates.upload_file.operation.perform,
    bundleOf({ bucketId: state.bucketId, file: 'hello', folder, fileName: 'note.txt' }),
  );
  assert.equal(file.path, `${folder}note.txt`);
  state.noteId = file.id;
});

test('download gives a working presigned link and a file', { skip }, async () => {
  const result = await appTester(
    App.creates.download_file.operation.perform,
    bundleOf({ fileId: state.fileId }),
  );
  assert.equal(typeof result.downloadFile, 'string');
  const response = await fetch(result.url);
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), content.toString());
});

test('find file by name and by id', { skip }, async () => {
  const byId = await appTester(
    App.searches.find_file.operation.perform,
    bundleOf({ fileId: state.fileId }),
  );
  assert.equal(byId[0].id, state.fileId);
  const missing = await appTester(
    App.searches.find_file.operation.perform,
    bundleOf({ fileId: '01a1e3ae-0000-7000-8000-000000000000' }),
  );
  assert.deepEqual(missing, []);
  const byName = await appTester(
    App.searches.find_file.operation.perform,
    bundleOf({ q: 'from-url', bucketId: state.bucketId, prefix: folder }),
  );
  assert.ok(byName.some((file) => file.id === state.fileId));
});

test('share links: create, find and pause', { skip }, async () => {
  const link = await appTester(
    App.creates.create_link.operation.perform,
    bundleOf({ fileId: state.fileId, maxDownloads: '5', accessPhrase: 'open-sesame' }),
  );
  assert.equal(link.hasPassword, true);
  const guarded = bundleOf({ fileId: state.fileId, duplicateGuard: `item-${run}` });
  const first = await appTester(App.creates.create_link.operation.perform, guarded);
  const retried = await appTester(App.creates.create_link.operation.perform, guarded);
  assert.equal(retried.id, first.id, 'a retry of the same run replays the first link');
  const nextRun = await appTester(
    App.creates.create_link.operation.perform,
    bundleOf({ fileId: state.fileId, duplicateGuard: `item-${run}-2` }),
  );
  assert.notEqual(nextRun.id, first.id, 'another run creates its own link');
  const unguarded = bundleOf({ fileId: state.fileId });
  const one = await appTester(App.creates.create_link.operation.perform, unguarded);
  const two = await appTester(App.creates.create_link.operation.perform, unguarded);
  assert.notEqual(two.id, one.id, 'without a guard every run creates');
  const found = await appTester(
    App.searches.find_link.operation.perform,
    bundleOf({ fileId: state.fileId }),
  );
  assert.ok(found.some((item) => item.id === link.id));
  const paused = await appTester(
    App.creates.update_link.operation.perform,
    bundleOf({ linkId: link.id, active: false }),
  );
  assert.equal(paused.status, 'paused');
});

test('labels: find or create, then label a file', { skip }, async () => {
  const name = `Zapier ${run}`;
  assert.deepEqual(
    await appTester(App.searches.find_label.operation.perform, bundleOf({ name })),
    [],
  );
  const label = await appTester(App.creates.create_label.operation.perform, bundleOf({ name }));
  const found = await appTester(
    App.searches.find_label.operation.perform,
    bundleOf({ name: name.toUpperCase() }),
  );
  assert.equal(found[0].id, label.id);
  const labelled = await appTester(
    App.creates.add_file_label.operation.perform,
    bundleOf({ fileId: state.fileId, labelId: label.id }),
  );
  assert.deepEqual(labelled.labelIds, [label.id]);
});

test('file requests: create and find', { skip }, async () => {
  const name = `Zapier inbox ${run}`;
  const inbox = await appTester(
    App.creates.create_inbox.operation.perform,
    bundleOf({
      bucketId: state.bucketId,
      path: `${folder}inbox`,
      name,
      allowedFileTypes: ['pdf', 'txt'],
    }),
  );
  assert.equal(inbox.path, `${folder}inbox/`);
  const found = await appTester(App.searches.find_inbox.operation.perform, bundleOf({ name }));
  assert.equal(found[0].id, inbox.id);
});

test('rename, move, trash and restore', { skip }, async () => {
  const renamed = await appTester(
    App.creates.rename_file.operation.perform,
    bundleOf({ fileId: state.noteId, name: 'note-renamed.txt' }),
  );
  assert.equal(renamed.name, 'note-renamed.txt');
  await appTester(
    App.creates.create_folder.operation.perform,
    bundleOf({ bucketId: state.bucketId, path: `${folder}moved` }),
  );
  const moved = await appTester(
    App.creates.move_files.operation.perform,
    bundleOf({ fileIds: [state.noteId], bucketId: state.bucketId, path: `${folder}moved` }),
  );
  assert.equal(moved.moved ?? 1, 1);
  const trashed = await appTester(
    App.creates.trash_files.operation.perform,
    bundleOf({ fileIds: [state.noteId] }),
  );
  assert.deepEqual(trashed.done, [state.noteId]);
  const restored = await appTester(
    App.creates.restore_files.operation.perform,
    bundleOf({ fileIds: [state.noteId] }),
  );
  assert.deepEqual(restored.done, [state.noteId]);
});

test('state changes run every time', { skip }, async () => {
  const rule = await appTester(
    App.creates.create_automation.operation.perform,
    bundleOf({
      name: `Zapier ${run}`,
      trigger: 'FOLDER_UPLOAD',
      bucketId: state.bucketId,
      folderPrefix: folder,
      action: 'HIDE',
    }),
  );
  let current;
  for (const ruleState of ['pause', 'resume', 'pause']) {
    current = await appTester(
      App.creates.set_automation_state.operation.perform,
      bundleOf({ ruleId: rule.id, state: ruleState }),
    );
  }
  assert.equal(current.isActive, false);
});

test('the new file trigger sees the upload and keeps the poll floor', { skip }, async () => {
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const items = await appTester(
    App.triggers.new_file.operation.perform,
    bundleOf({ bucketId: state.bucketId, prefix: folder, ignoreOwnChanges: false }),
  );
  const item = items.find((entry) => entry.file?.id === state.fileId);
  assert.ok(item, 'the uploaded file is delivered');
  assert.equal(typeof item.downloadFile, 'string');
  assert.equal(item.actor.kind, 'integration');
  await assert.rejects(
    appTester(
      App.triggers.new_file.operation.perform,
      bundleOf({ bucketId: state.bucketId, prefix: folder, ignoreOwnChanges: false }),
    ),
    (error) => {
      assert.equal(error.name, 'ThrottledError');
      assert.ok(JSON.parse(error.message).delay > 0);
      return true;
    },
  );
  const sample = await appTester(
    App.triggers.new_file.operation.perform,
    bundleOf({ bucketId: state.bucketId, prefix: folder }, { isLoadingSample: true }),
  );
  assert.equal(
    sample.some((entry) => entry.file?.id === state.fileId),
    false,
    'own uploads are skipped',
  );
});

test('the activity trigger filters by type', { skip }, async () => {
  const items = await appTester(
    App.triggers.new_activity.operation.perform,
    bundleOf({ types: ['SHARE_CREATED'], ignoreOwnChanges: 'false' }),
  );
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.type === 'SHARE_CREATED'));
});

test(
  'a read key cannot write',
  { skip: skip || (readKey ? false : 'set NUBBO_TEST_READ_API_KEY') },
  async () => {
    await assert.rejects(
      appTester(App.creates.create_folder.operation.perform, {
        authData: { apiKey: readKey },
        inputData: { bucketId: state.bucketId, path: `${folder}read-only/` },
        meta: {},
      }),
      /API_KEY_READ_ONLY/,
    );
  },
);
