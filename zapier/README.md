# Nubbo for Zapier

Nubbo is a workspace for all your S3-compatible storage.

The Zapier integration for [Nubbo](https://nubbo.app). It connects with a Nubbo API key and works through the public API (`/v1`, reference at `https://api.nubbo.app/v1/docs`). Built with the Zapier Platform CLI (`zapier-platform-core` 19, JavaScript).

The API, and so this integration, comes with the Pro and Teams plans.

## What it offers

**Triggers** (polling, deduplicated by Zapier on the event `id`):

| Trigger | API |
|---|---|
| New File | `GET /v1/triggers/new-files` (bucket and folder filters) |
| New File Request Upload | `GET /v1/triggers/new-inbox-uploads` (file request filter) |
| New Activity Event | `GET /v1/triggers/new-activity` (event types filter) |

New File and New Activity Event skip, by default, what the same API key did («Ignore Changes Made With This Key»), so a Zap that writes to Nubbo does not trigger itself. File triggers carry a `downloadFile` field: the file, fetched from the storage provider through a fresh presigned link when a later step uses it.

**Actions**: Upload File, Create Folder, Rename File or Folder, Move Files or Folders, Move Files to Trash, Restore Files From Trash, Add Label to File, Remove Label From File, Download File, Create Share Link, Update Share Link, Create File Request, Update File Request, Create Gallery, Update Gallery, Create Label, Create Embed, Create Automation Rule, Pause or Resume Automation Rule, Add Folder to Project.

**Searches**: Find File or Folder, Find Share Link, Find Label (with Find or Create Label), Find File Request, Find Gallery, Find Project.

Hidden triggers feed the dropdowns (buckets, file requests, labels, projects, share links, galleries, automation rules).

## How it talks to the API

- **Authentication**: one field, the API key, sent as `Authorization: Bearer nbk_…` only to the Nubbo API, never to storage providers or file URLs. The connection test is `GET /v1/me` (not metered) and the connection label is `<space> (<key name>)`.
- **Base URL**: `https://api.nubbo.app`. The `NUBBO_BASE_URL` environment variable overrides it for the live tests below; the published version never sets it.
- **Files**: uploads start with `POST /v1/buckets/{bucketId}/uploads`, send the bytes straight to the presigned URL and finish with `POST /v1/uploads/{uploadId}/complete`. Downloads sign a link with `POST /v1/files/{fileId}/download-link` and fetch it from the provider. File content never passes through Nubbo. Uploads are buffered in memory, so Upload File takes files up to 100 MB and stops with `ZAPIER_FILE_TOO_LARGE` above it, before downloading when the source announces its size.
- **Triggers**: Zapier polls without `since` and gets the latest 50 items, newest first, then keeps only the ids it has not seen. Each poll sends `X-Nubbo-Flow: zapier:<zap id>` (`zapier:<zap id>:sample` when the editor loads samples), so Zaps sharing a key keep apart. When Zapier does not pass the Zap id, every Zap of the key shares the flow `zapier`. The API keeps at most 20 flows per key and trigger polled in the last 30 days, and each Zap uses two (live and sample), so one key serves about 10 Zaps per trigger; use another key beyond that.
- **Idempotency**: Zapier gives an action no run id that stays the same across retries of one step, and the input values alone cannot tell a retry from a new run with the same input, so keys are never derived from the input. The actions where a duplicate would hurt (Upload File, Create Share Link, Create File Request, Create Gallery, Create Embed, Create Automation Rule) have an optional **Duplicate Guard** field: map a value unique to each run, usually the ID of the trigger item, and the step sends `Idempotency-Key: zapier-<sha256 of the Zap id, the action and that value>` (Upload File uses one key for the upload start and another per upload for its completion). A retry of that run within 24 hours replays the first answer; another run, with another value, creates again. Left empty, no key is sent and every run creates. Create Folder (it skips a folder that exists by default), Create Label (a taken name is refused) and the actions that change state (rename, move, trash, restore, labels, updates, pause and resume) send no key, so they always run.
- **Limits**: `API_RATE_LIMITED` and `API_TRIGGER_TOO_FREQUENT` throw Zapier's `ThrottledError` with the `Retry-After` delay (the API sends whole seconds; an HTTP date is also understood, then `X-RateLimit-Reset`, then 60 seconds), so Zapier retries later. `API_QUOTA_EXCEEDED` and `API_KEY_FAILURES` are plain errors (the quota only resets with the period). A 401 asks to reconnect the account.
- **Errors** show the API message, its code and the request id.

## Develop

```sh
cd zapier
npm ci
npm run validate          # schema checks offline; Zapier's integration checks use the saved login
npm test                  # unit tests; the live tests skip without the variables below
```

Live tests run against a Nubbo API you control (never production):

```sh
NUBBO_BASE_URL=http://localhost:<port> \
NUBBO_TEST_API_KEY=nbk_… \
NUBBO_TEST_READ_API_KEY=nbk_… \
npm test
```

They need a Pro space with one bucket, a read-and-write whole-space key and, optionally, a read key. They create files under `zapier-tests/<run>/` and use about 50 requests, so wait a minute between runs (60 requests a minute per Pro key).

## Publishing (owner)

These steps need the Zapier developer account on info@nubbo.app. Run them from `zapier/`. The integration is registered; `.zapierapprc` holds its id.

1. Log in:

   ```sh
   npm ci
   npx zapier-platform login
   ```

2. Check the remote state: `npx zapier-platform versions` and `npx zapier-platform env:get 1.0.0`.

3. Push the version. If an older push set `NUBBO_BASE_URL`, remove it so the version uses production:

   ```sh
   npx zapier-platform push
   npx zapier-platform env:unset 1.0.0 NUBBO_BASE_URL
   ```

4. With a production key, build one Zap for each trigger, action and search, turn them on and run each one successfully (checks T001 to T005). Include a Zap where a later step uses the File field of New File or Download File, so the file is fetched from the provider. Check in `npx zapier-platform logs --type=http` that trigger polls carry `X-Nubbo-Flow: zapier:<zap id>`.

5. Invite at least two more users and have them turn on live Zaps: check S001 asks for 3 users with live Zaps, and S002 asks for a live Zap on every trigger, action and search. Run `npx zapier-platform validate` until no publishing task is left.

   ```sh
   npx zapier-platform users:add tester@example.com 1.0.0
   npx zapier-platform validate
   ```

6. In the Zapier developer platform, fill in the listing:
   - Description: `Nubbo is a workspace for all your S3-compatible storage.`
   - Logo, homepage `https://nubbo.app`, and the category chosen at register.
   - An admin with an @nubbo.app email.
   - A test account for Zapier's reviewers on `integration-testing@zapier.com`: a Nubbo account with a non-expiring Pro plan, one bucket and a key.

7. Until S001, S002 and T001 pass, the integration stays private. Share it with the invite link: in the Platform UI, open **My Integrations**, choose Nubbo, then **Manage › Sharing**, and copy the public invite link.

8. Once those checks pass, and with the owner's consent, promote the version and send the public submission form:

   ```sh
   npx zapier-platform promote 1.0.0
   ```

## License

[MIT](../LICENSE)
