# n8n-nodes-nubbo

n8n community nodes for [Nubbo](https://nubbo.app), the multi-cloud manager for S3-compatible storage. Work with the files, folders, share links, file requests, galleries, embeds, labels, projects and automation rules of your Nubbo workspace, and start workflows when something changes.

The package has two nodes:

- **Nubbo**: actions on everything the Nubbo API covers. It can also be used as a tool by AI agents.
- **Nubbo Trigger**: starts a workflow on a new file, a new file request upload or a new activity event.

Files travel straight between n8n and your storage provider through presigned URLs. Nubbo never receives their content.

## Installation

In a self-hosted n8n, open **Settings › Community nodes**, choose **Install** and enter `n8n-nodes-nubbo`. See the [n8n guide to community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) for other ways to install.

## Credentials

The nodes use a **Nubbo API** credential:

1. In Nubbo, create an API key in **Settings › API** (Pro) or **Team › API** (owners and admins of a team). The key is shown once, when you create it.
2. In n8n, create a **Nubbo API** credential and paste the key. Leave **Environment** on **Production**.
3. Save. n8n tests the key with `GET /v1/me`.

**Development** points at the Nubbo test environment (`dev.api.nubbo.app`) and is only for testing the node. It is removed from the credential before the package is submitted for n8n verification.

A key belongs to one space, reaches the whole space or chosen buckets and projects, and reads only or reads and writes. Create the key with the reach and access your workflow needs. The API comes with the Pro and Teams plans.

## Nubbo node

| Resource | Operations |
| --- | --- |
| Account | Get (space, plan, key and quota of the key) |
| Activity | Get many |
| Automation rule | Create, delete, get, get many, pause, resume, update |
| Bucket | Get many |
| Embed | Create, delete, get, get many, update |
| File | Add label, download, get, get download link, get many (list a folder), move, remove label, rename, search, trash, upload |
| File request | Create, delete, get, get many, get uploads, update |
| Folder | Create |
| Gallery | Create, delete, get, get many, update |
| Label | Create, delete, get groups, get many, merge, update |
| Operation | Get (a move that runs in the background) |
| Project | Add items, get, get many, remove items |
| Share link | Create, delete, get, get many, update |
| Trash | Get many, restore |

Notes:

- **Upload** sends the binary data of the input item to the storage provider. Files above 5 GB are uploaded in parts; turn on **Multipart** to upload in parts from 5 MiB. Missing parent folders are created.
- **Download** returns the file as binary data, read straight from the storage provider.
- **Move** finishes small moves in the call. Folder moves, large selections and moves to another bucket run in the background and return an `operationId`: follow it with **Operation › Get**.
- **Update** operations change only the fields you add. Use **Clear Fields** to remove a password, an expiry or a limit.
- Labels and project items belong to the whole space: creating, changing or merging them needs a read and write key for the whole space.
- Encrypted items appear without name or size, and every action on them is refused. Open them in Nubbo.
- Automation rules that use Nubbo AI can be read, paused and deleted, but are created and changed in Nubbo.

## Nubbo Trigger

| Event | Fires for | Filters |
| --- | --- | --- |
| New file | Files uploaded through Nubbo: the app, the API, file requests and embeds | Bucket, folder |
| New file request upload | Files received through a file request | File request |
| New activity | Events of the activity log | Event types |

The trigger polls Nubbo once a minute or less often, as you set it in the node. It keeps its position in the workflow, so each event is delivered once and in order, also after n8n restarts or the workflow is paused. Activating a workflow does not deliver past events. Changing a filter starts again from that moment.

**Ignore Changes Made by This Key** is on by default: events caused by the key of the credential are skipped, so a workflow that uploads into the folder it watches does not start itself again.

**Fetch Test Event** in the editor shows the latest matching event and does not move the position of the active workflow.

Polling does not use API requests. Each delivered event counts once against the trigger events of the plan. When the space has used its monthly trigger events, polls fail with `API_QUOTA_EXCEEDED` until the quota resets at the start of the next period; nothing is lost, and the events are delivered once polling works again.

## Limits and retries

- Each key has a limit of calls a minute. When Nubbo answers `429` with `Retry-After` of a minute or less, the node waits and retries, up to three times.
- When the monthly quota of the space is used, calls fail with `API_QUOTA_EXCEEDED` until the period renews.
- Creates and changes send an `Idempotency-Key` made from the execution, the node and the item, so a retry of the same execution does not create the same thing twice.

## Examples

**File the PDFs a file request receives**

1. **Nubbo Trigger**, event **New file request upload**, with the file request.
2. **Nubbo**, **File › Move**, with **File IDs** `{{ $json.file.id }}`, into a folder by month such as `invoices/{{ $now.toFormat('yyyy-MM') }}/`.

**Back up attachments to a bucket**

1. A trigger that brings files as binary data, for example an email trigger.
2. **Nubbo**, **File › Upload**, with the bucket, the folder and **Input Binary Field** `attachment_0`.

**Send a share link for every new report**

1. **Nubbo Trigger**, event **New file**, with the bucket and the folder `reports/`.
2. **Nubbo**, **Share Link › Create**, with **File or Folder ID** `{{ $json.file.id }}` and an expiry.
3. A message node that sends `{{ $json.url }}`.

## Reference

- [Nubbo API reference](https://api.nubbo.app/v1/docs)
- [OpenAPI document](https://api.nubbo.app/v1/openapi.json)
- [Nubbo](https://nubbo.app)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
