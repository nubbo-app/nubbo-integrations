# Nubbo for Zapier

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
- **Base URL**: `https://api.nubbo.app`, or the `NUBBO_BASE_URL` environment variable of the Zapier version (used for the private version on develop).
- **Files**: uploads start with `POST /v1/buckets/{bucketId}/uploads`, send the bytes straight to the presigned URL and finish with `POST /v1/uploads/{uploadId}/complete`. Downloads sign a link with `POST /v1/files/{fileId}/download-link` and fetch it from the provider. File content never passes through Nubbo. Uploads are buffered in memory, so Upload File takes files up to 100 MB and stops with `ZAPIER_FILE_TOO_LARGE` above it, before downloading when the source announces its size.
- **Triggers**: Zapier polls without `since` and gets the latest 50 items, newest first, then keeps only the ids it has not seen. Each poll sends `X-Nubbo-Flow: zapier:<zap id>` (`zapier:<zap id>:sample` when the editor loads samples), so Zaps sharing a key keep apart. When Zapier does not pass the Zap id, every Zap of the key shares the flow `zapier`. The API keeps at most 20 flows per key and trigger polled in the last 30 days, and each Zap uses two (live and sample), so one key serves about 10 Zaps per trigger; use another key beyond that.
- **Idempotency**: Zapier gives an action no run id that stays the same across retries of one step, and the input values alone cannot tell a retry from a new run with the same input, so keys are never derived from the input. The actions where a duplicate would hurt (Upload File, Create Share Link, Create File Request, Create Gallery, Create Embed, Create Automation Rule) have an optional **Duplicate Guard** field: map a value unique to each run, usually the ID of the trigger item, and the step sends `Idempotency-Key: zapier-<sha256 of the Zap id, the action and that value>` (Upload File uses one key for the upload start and another per upload for its completion). A retry of that run within 24 hours replays the first answer; another run, with another value, creates again. Left empty, no key is sent and every run creates. Create Folder (it skips a folder that exists by default), Create Label (a taken name is refused) and the actions that change state (rename, move, trash, restore, labels, updates, pause and resume) send no key, so they always run.
- **Limits**: `API_RATE_LIMITED` and `API_TRIGGER_TOO_FREQUENT` throw Zapier's `ThrottledError` with the `Retry-After` delay (the API sends whole seconds; an HTTP date is also understood, then `X-RateLimit-Reset`, then 60 seconds), so Zapier retries later. `API_QUOTA_EXCEEDED` and `API_KEY_FAILURES` are plain errors (the quota only resets with the period). A 401 asks to reconnect the account.
- **Errors** show the API message, its code and the request id.

## Develop

```sh
cd zapier
npm ci
npm run validate          # schema and Zapier's integration checks, no login needed
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

These steps need the Zapier developer account on info@nubbo.app. Run them from `zapier/`.

1. Log in and register the integration (once). `register` writes `.zapierapprc`; commit it.

   ```sh
   npm ci
   npx zapier-platform login
   npx zapier-platform register "Nubbo" --audience global --role employee --category files
   ```

2. Push the private version and point it at the develop API:

   ```sh
   npx zapier-platform push
   npx zapier-platform env:set 1.0.0 NUBBO_BASE_URL=https://dev.api.nubbo.app
   ```

3. Invite the testers and build real Zaps with a dev key: every trigger, search and action needs a successful run. Include a Zap where a later step uses the File field of New File or Download File (for example, saving it to another app), so the file is fetched from the provider. Check in `npx zapier-platform logs --type=http` that trigger polls carry `X-Nubbo-Flow: zapier:<zap id>`; if they show only `zapier`, Zapier is not passing the Zap id to polls.

   ```sh
   npx zapier-platform users:add tester@example.com 1.0.0
   npx zapier-platform validate
   ```

4. In the Zapier developer platform, fill in the listing (logo, description, homepage `https://nubbo.app`, category chosen at register), and add an admin with an @nubbo.app email.

5. When the API is live in production, push a version for production, remove the develop base URL and promote it:

   ```sh
   npx zapier-platform push
   npx zapier-platform env:unset 1.0.0 NUBBO_BASE_URL
   npx zapier-platform promote 1.0.0
   ```

6. Submit for public listing with the test account `integration-testing@zapier.com`: a Nubbo account on that email with a non-expiring granted Pro plan (Nubbo admin), one bucket, and a key for Zapier's reviewers.

## License

[MIT](../LICENSE)
