# Nubbo app for Make

The source of the Nubbo app for [Make](https://www.make.com). It runs on the Nubbo public API (`/v1`, reference at `https://api.nubbo.app/v1/docs`). The layout is the local development format of the Make Apps Editor for VS Code: one `makecomapp.json` manifest and one folder per component.

## What the app has

| Component | Items |
|---|---|
| Connection | `nubbo`: an API key (`nbk_…`) for `api.nubbo.app`. Verified with `GET /v1/me`; the connection shows the space and the key name. |
| Triggers (polling) | Watch new files, Watch new file request uploads, Watch new activity |
| Account and buckets | Get the API key and quota, List buckets |
| Files and folders | List files in a folder, Search files, Get a file or folder, Create a folder, Rename a file or folder, Move files and folders, Get an operation, Get a download link, Add a label to a file, Remove a label from a file |
| Uploads and downloads | Upload a file, Download a file, Start an upload, Sign upload parts, Complete an upload, Abort a multipart upload |
| Trash | Move files to the trash, Restore files from the trash, List the trash |
| Labels | List labels, Create a label, Update a label, Merge labels, Delete a label, List label groups |
| Projects | List projects, Get a project, Add items to a project, Remove items from a project |
| Share links, file requests, galleries, embeds | List, create, get, update and delete for each; plus List file request uploads |
| Automation rules | List, create, get, update, delete, pause, resume |
| Activity | List activity |
| Other | Make an API call |
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

- **Authorization in the base.** The base sends `Authorization: Bearer {{connection.apiKey}}` to `https://api.nubbo.app/v1`. The requests to the storage provider (the presigned PUT of Upload a file and the GET of Download a file) set `Authorization` to `{{undefined}}`, so the key never reaches a provider, and `log.sanitize` hides it in Make's logs.
- **Download a file** asks for the link with `fileNameInLink: false`. Make decodes the query of a URL before sending it, which breaks a file name encoded in the signed link; without it the link survives. The module returns the file object with `fileName` and `data`. Errors from the storage provider show its status and answer.
- **Make an API call** takes a path relative to `https://api.nubbo.app` (for example `/v1/buckets`; a path without `v1/` gets it), so a mapped value cannot send the key to another host.
- **Dates.** Every date in an output goes through `parseDate`, so Make shows it as a date.
- **Triggers.** Make keeps only the id and the date of the last item a trigger emitted. Each item carries its own `cursor`, which resumes right after that item, and the trigger id is `<position>|<activity id>|<cursor>`. The next poll sends the part after the last `|` as `since`, so a poll continues right after the last item Make emitted, whatever the Limit. With `since` the API answers what came after, oldest first, up to 100 items; the trigger date is then the poll time, so Make's date filter never drops an item, and `<position>` (the item's place in the page, zero-padded) makes Make's order by date and id the order of the API. Items Make did not emit come again in the next poll and are not counted twice as trigger events. Until the first item is emitted (right after the scenario is turned on, or after a start date is chosen) the poll goes without `since`: the latest 50 items come newest first, the trigger date is the item date, Make keeps those newer than the start and emits the oldest first.
- **Limit** on triggers (default 2, up to 100) is the most items one run emits. Scenarios saved before it existed keep 100.
- `X-Nubbo-Flow: make:{{scenario.id}}` gives each scenario its own position and once-a-minute floor when several scenarios share a key and filter.
- Every item carries `madeByThisKey` (true when the action was made with the key of this connection). Add a filter on it to ignore the scenario's own uploads; the trigger never hides items itself, because a hidden item would stop the cursor.
- The «Choose where to start» list reads `GET /v1/activity`, not the trigger, so opening it does not take the poll slot.
- Upload a file always gets one presigned PUT: `/v1` answers multipart only when the file is above 5 GB (`singleMax`) or when `multipart: true` is sent, which the module never sends, and Make's largest file size (1000 MB on Enterprise plans) is far below 5 GB. Start an upload, Sign upload parts, Complete an upload and Abort a multipart upload cover files above that size or bytes that another tool sends: Nubbo only signs the URLs, and the bytes go to them with Make's HTTP module (one PUT per part).
- Create and update modules send the filled-in parameters as they are (`omit(parameters, …)` without the path parameters), so mapping `erase` sends `null` and removes a password, an expiry date, a limit, a cover or a label group. Lists and texts that the API empties with an empty value instead of `null` (allowed file extensions, allowed sites, route categories, label description, name pattern, link password of a rule) turn `erase` into that empty value. Fields the API cannot empty (names, paths, layouts, rule settings) ignore `erase`.
- Writes do not send `Idempotency-Key`, because Make offers no value that stays the same across its retries. Make an API Call can send one.
- Errors map to Make error types: 400, 404, 409, 422 `DataError`; 401 `InvalidAccessTokenError` (missing, wrong, revoked or expired key); 403 `InvalidConfigurationError` only when the key or the space cannot work at all (`ACCOUNT_SUSPENDED`, `WORKSPACE_SUSPENDED`, `WORKSPACE_READ_ONLY`, `API_PLAN_REQUIRED`, `API_KEY_MCP_ONLY`, `API_KEY_READ_ONLY`, `API_KEY_WHOLE_SPACE_REQUIRED`) and `DataError` for the rest (plan limits, one bucket or item refused); 410 `InvalidConfigurationError` (`ACCOUNT_SCHEDULED_FOR_DELETION`, the only 410 of `/v1`: the key's owner account is in its deletion grace period); 429 `RateLimitError`. A storage provider refusing a presigned upload or download is a `DataError` (429 `RateLimitError`). Messages show the Nubbo code, for example `[404] API_FILE_NOT_FOUND: …`.

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
2. Scenario A (actions, one chain): Create a Folder > Upload a File (map a file from an HTTP «Get a file» module) > Get a File or Folder > Download a File > Get a Download Link > Rename a File or Folder > Create a Label > Add a Label to a File > Create a Share Link > Update a share link (map `erase` to the password) > Create a File Request > Create a Gallery > Create an Embed > Create an Automation Rule > Pause and Resume it > Move Files and Folders > Move Files to the Trash > Restore Files from the Trash > Delete modules for what was created > Make an API call (`GET`, URL `/v1/buckets`).
3. Scenario B (searches): List Buckets, List Files in a Folder, Search Files, List Share Links, List File Requests, List Galleries, List Embeds, List Automation Rules, List Labels, List Projects, List Activity, each with a limit above 100 on a folder with more than 100 files once, so the log shows a second page.
4. Scenario C (triggers), one per trigger, scheduled every minute (or 15 minutes on a free Make plan):
   - Turn it on with **From now on** and Limit 2, upload 5 files in Nubbo, run it three times a minute apart: 2, 2 and 1 bundles, oldest first, nothing older, nothing skipped or repeated.
   - Open the execution log of two runs in a row. Check that the request header `X-Nubbo-Flow` reads `make:<scenario id>` (not just `make:`), and that the `since` of a run equals the `cursor` of the last bundle the run before emitted. If `since` is never sent, the trigger still works but only with the latest 50 items per run: tell the developer.
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
- Upload a file does one presigned PUT, which covers every file Make can hold. Files above 5 GB need the multipart modules and another tool to send the parts.
- Embed `config` takes a collection (for example the output of Parse JSON); anything left out keeps the default of the kind.
