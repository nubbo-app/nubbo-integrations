# Nubbo app for Make

The source of the Nubbo app for [Make](https://www.make.com). It runs on the Nubbo public API (`/v1`, reference at `https://api.nubbo.app/v1/docs`). The layout is the local development format of the Make Apps Editor for VS Code: one `makecomapp.json` manifest and one folder per component.

## What the app has

| Component | Items |
|---|---|
| Connection | `nubbo`: an API key (`nbk_…`) and an environment, as an advanced option with Production (`api.nubbo.app`) only. Verified with `GET /v1/me`; the connection shows the space and the key name. |
| Triggers (polling) | Watch New Files, Watch New File Request Uploads, Watch New Activity |
| Files and folders | List Files in a Folder, Search Files, Get a File or Folder, Create a Folder, Rename a File or Folder, Move Files and Folders, Get an Operation, Get a Download Link, Add a Label to a File, Remove a Label from a File |
| Uploads and downloads | Upload a File, Download a File, Start an Upload, Sign Upload Parts, Complete an Upload, Abort a Multipart Upload |
| Trash | Move Files to the Trash, Restore Files from the Trash, List the Trash |
| Labels | List Labels, Create a Label, Update a Label, Merge Labels, Delete a Label, List Label Groups |
| Projects | List Projects, Get a Project, Add Items to a Project, Remove Items from a Project |
| Share links, file requests, galleries, embeds | List, Create, Get, Update and Delete for each; plus List File Request Uploads |
| Automation rules | List, Create, Get, Update, Delete, Pause, Resume |
| Activity | List Activity |
| Other | Get the API Key and Quota, List Buckets, Make an API Call |
| RPCs | `listBuckets`, `listInboxes`, `listLabels`, `listLabelGroups`, `listProjects`, `listLinks`, `listGalleries`, `listEmbeds`, `listAutomations` (dynamic options of the select fields) |

## Layout

```text
makecomapp.json         manifest: components, code files, Make origin
general/base.iml.json   base URL ({{connection.baseUrl}}/v1), error mapping, log sanitization
general/readme.md       the app description that Make shows to users
connections/nubbo/      connection communication and parameters
modules/<id>/           communication, epoch (triggers), static and mappable parameters, interface, samples, scope
modules/groups.json     module groups in the Make module picker
rpcs/<id>/              dynamic options for select fields
assets/icon-512.png     app icon to upload in the app settings
scripts/deploy.mjs      deploys the source to Make through its API
```

## How it works

- **Authorization per request.** Every request to Nubbo sends `Authorization: Bearer {{connection.apiKey}}` itself; the base has no headers. The requests to the storage provider (the presigned PUT of Upload a File and the GET of Download a File) therefore never carry the key, and `log.sanitize` hides it in Make's logs.
- **Download a File** asks for the link with `fileNameInLink: false`. Make decodes the query of a URL before sending it, which breaks a file name encoded in the signed link; without it the link survives, and the module takes the file name from the file's metadata. Errors from the storage provider show its status and answer.
- **Make an API Call** puts the host in front of the path (`{{connection.baseUrl}}/v1/<path>`), so a mapped value cannot send the key to another host, and the app's `Authorization` header wins over any header the user adds.
- **Triggers.** Make keeps only the id and the date of the last item a trigger emitted. Each item's trigger id is `<activity id>|<cursor>`, where the cursor is the `nextCursor` of the page it came in. The next poll sends the part after `|` as `since`, so polls continue from the server cursor (oldest first, up to 100 items, `hasMore` waits for the next minute) and each new item counts once as a trigger event. Until the first item is emitted (right after the scenario is turned on, or after a start date is chosen) the poll goes without `since`: the latest 50 items come newest first, Make keeps those newer than the start, and nothing is metered. While `since` is used, the trigger date is the poll time, so Make's own date filter never drops an item the server already delivered.
- Triggers have no user limit: the module limit is fixed at 100, the page size of the API, so Make never emits part of a page and skips the rest.
- `X-Nubbo-Flow: make:{{scenario.id}}` gives each scenario its own position and once-a-minute floor when several scenarios share a key and filter.
- Every item carries `madeByThisKey` (true when the action was made with the key of this connection). Add a filter on it to ignore the scenario's own uploads; the trigger never hides items itself, because a hidden item would stop the cursor.
- The «Choose where to start» list reads `GET /v1/activity`, not the trigger, so opening it does not take the poll slot.
- Upload a File always gets one presigned PUT: `/v1` answers multipart only when the file is above 5 GB (`singleMax`) or when `multipart: true` is sent, which the module never sends, and Make's largest file size (1000 MB on Enterprise plans) is far below 5 GB. For multipart uploads from other tools use Start an Upload, Sign Upload Parts and Complete an Upload.
- Update modules send only the fields that are filled in. **Fields to clear** empties the chosen fields (null, an empty list or an empty text, as the API documents).
- Writes do not send `Idempotency-Key`, because Make offers no value that stays the same across its retries. Make an API Call can send one.
- Errors map to Make error types: 400, 404, 409, 422 `DataError`; 401 `InvalidAccessTokenError` (missing, wrong, revoked or expired key); 403 and 410 `InvalidConfigurationError` (plan, read-only key, suspended or read-only team, and `ACCOUNT_SCHEDULED_FOR_DELETION`, the only 410 of `/v1`, for a key whose owner account is in its deletion grace period: reconnecting does not help); 429 `RateLimitError`. Messages show the Nubbo code, for example `[404] API_FILE_NOT_FOUND: …`.

## Deploy to Make

The app needs a Make account for Nubbo (info@nubbo.app) with access to Custom apps.

1. In Make, open **Custom apps** and create an app:
   - Name: `nubbo` (Make adds a suffix if the name is taken; it becomes part of the app ID).
   - Label: `Nubbo`.
   - Description: `One workspace for all your S3 storage. Automate it from Make.`
   - Theme: `#094ad7`.
   - Language: English. Audience: global.
2. Upload `assets/icon-512.png` as the app icon.
3. Note the zone in the address bar (for example `eu2.make.com`). In `makecomapp.json`, set `origins[0].baseUrl` to `https://<zone>.make.com/api` and `origins[0].appId` to the app ID Make shows (the name with its suffix).
4. In Make, open your profile, **API access**, and create a token with the scopes `sdk-apps:read` and `sdk-apps:write`. Save it in `make/.secrets/apikey` (the folder is ignored by git; never commit it).
5. From `make/`, compare the source with Make: `node scripts/deploy.mjs --dry-run`. It lists what would be created or changed and writes nothing.
6. Deploy: `node scripts/deploy.mjs`. It creates the components that are missing, updates the rest and writes the pairing of each new component into `origins[0].idMapping`; commit that change so later deploys update the same components. It needs Node 20 or later and no packages. It never publishes the app.
7. Later changes: edit the files, then run the script again. `--only module:<id>` (also `rpc:<id>` and `connection:<id>`, repeatable) deploys one component.

The app in `makecomapp.json` is `nubbo-fepsab` on `eu1.make.com`, already paired. The **Make Apps Editor** extension for VS Code (`Integromat.apps-sdk`) reads the same `makecomapp.json` and token file.

## Test

Use a Nubbo account with Pro, and a key from **Settings › API** on `app.nubbo.app`.

1. Create a connection and paste the key. The connection name shows `<space> · <key name>`. Try a wrong key once: it must fail with `API_KEY_INVALID`.
2. Scenario A (actions, one chain): Create a Folder > Upload a File (map a file from an HTTP «Get a file» module) > Get a File or Folder > Download a File > Get a Download Link > Rename a File or Folder > Create a Label > Add a Label to a File > Create a Share Link > Update a Share Link (clear the password) > Create a File Request > Create a Gallery > Create an Embed > Create an Automation Rule > Pause and Resume it > Move Files and Folders > Move Files to the Trash > Restore Files from the Trash > Delete modules for what was created > Make an API Call (`GET`, URL `buckets`).
3. Scenario B (searches): List Buckets, List Files in a Folder, Search Files, List Share Links, List File Requests, List Galleries, List Embeds, List Automation Rules, List Labels, List Projects, List Activity, each with a limit above 100 on a folder with more than 100 files once, so the log shows a second page.
4. Scenario C (triggers), one per trigger, scheduled every minute (or 15 minutes on a free Make plan):
   - Turn it on with **From now on**, upload 3 files in Nubbo, wait for the next run: 3 bundles, nothing older.
   - Open the execution log of two runs in a row. Check that the request header `X-Nubbo-Flow` reads `make:<scenario id>` (not just `make:`), and that the `since` of a run equals the `nextCursor` of the response of the run before. If `since` is never sent, the trigger still works but only with the latest 50 items per run: tell the developer.
   - Upload a file with Upload a File in the same scenario and check that its bundle has `madeByThisKey: true`.
   - Two scenarios with the same key and filter must both get every file.
   - Watch New File Request Uploads: upload through a file request link in a private window.
   - Watch New Activity: pick `LABEL_CREATED`, create a label in Nubbo.
   - **Run once** twice within a minute answers `API_TRIGGER_TOO_FREQUENT` as a rate limit error: that is expected.
5. Scenario D (errors): Get a File or Folder with an ID that does not exist (`[404] API_FILE_NOT_FOUND`), and Create a Folder with a read-only key (`[403] API_KEY_READ_ONLY`).

## Invite link and review

Publishing cannot be undone, and published components cannot be deleted, so the app stays private until the API answers in production.

1. Deploy the connection (`node scripts/deploy.mjs --only connection:nubbo`), create a production connection and run scenarios A to D on `api.nubbo.app`.
2. Remove any test modules or connections made in the Make web editor.
3. Click **Publish**. Make shows the invite link: open it with another Make organization and check that the app installs and a connection works.
4. On the **Modules** tab, make every module visible.
5. Open **Review**, fill in the API documentation (`https://api.nubbo.app/v1/docs`), the help link (`https://nubbo.app`), the categories (File management, Cloud storage) and the links to scenarios A to D, then **Request review**. Answer Make's emails; after each fix deploy, run the scenarios again and reply.

After approval, Make gives the app a development version: deploy changes there first, test, then promote.

## Known limits

- Polling only: Nubbo sends no webhooks, so there are no instant triggers. The shortest interval is one minute.
- The first poll after turning a scenario on reads at most the latest 50 items.
- Upload a File does one presigned PUT, which covers every file Make can hold. Files above 5 GB need the multipart modules and another tool to send the parts.
- Embed `config` takes a collection (for example the output of Parse JSON); anything left out keeps the default of the kind.
