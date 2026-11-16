# nubbo-integrations — Claude guide

> This repo is public. Commits, PRs, README and code carry no internal paths, issue or decision references, personal names or AI attribution.

## What lives here

Official integrations built on the public Nubbo API (`/v1`). The reference is `https://api.nubbo.app/v1/docs` and the OpenAPI document `https://api.nubbo.app/v1/openapi.json`.

| Folder | Integration | Published as |
| --- | --- | --- |
| `n8n/` | n8n community nodes «Nubbo» and «Nubbo Trigger» | npm `n8n-nodes-nubbo` |

Each integration is its own package with its own lockfile; there is no root package.

## Git

- Commits are authored and committed by «Nubbo <info@nubbo.app>» (set in the repo config). Conventional Commits, English.
- Branch from `develop`, PR to `develop`; `main` only through a release PR.
- Nothing is published from a laptop. npm releases go through the manual workflow `Publish n8n node` on `main`, with provenance.

## n8n package (`n8n/`)

- Scaffolded with `@n8n/node-cli`: `npm run lint`, `npm run build`, `npm run dev` (local n8n with the node linked). Lint must stay clean: it runs the same rules as `npx @n8n/scan-community-package`, which n8n uses for verification.
- No runtime `dependencies`; only `n8n-workflow` as a peer. Imports are limited to `n8n-workflow` and `crypto`; no Node globals such as `setTimeout` or `process` (use `sleep` from `n8n-workflow`).
- English only, sentence-case actions, options sorted by name.
- Layout: `nodes/Nubbo/Nubbo.node.ts` (resource and operation router), `NubboTrigger.node.ts` (polling), `GenericFunctions.ts` (authenticated requests, `Retry-After`, errors, pagination, idempotency keys), `Transfer.ts` (uploads and downloads), `descriptions/` (node properties), `ActivityTypes.ts` (the public activity types of the API; update it when the API adds or removes one).
- Every Nubbo call goes through `nubboRawRequest`/`nubboApiRequest` with the credential. Presigned URLs are called with the plain `httpRequest` helper, never with the credential, so the API key never reaches a storage provider.
- POST and PATCH calls that create or change something send an `Idempotency-Key` from the execution, node, run and item. The upload start sends none (it creates nothing visible and a replay after an abort would return a dead upload); `complete` carries one bound to the upload id.
- The trigger keeps `cursor` and a filter fingerprint in the node's static data, seeds without emitting on the first poll and after a filter change, sends `X-Nubbo-Flow: <workflow id>:<node id>` on every poll (`:test` added for manual tests, which never touch the stored cursor), returns nothing on `API_TRIGGER_TOO_FREQUENT` and re-seeds on `API_CURSOR_INVALID`.
- When the API adds or changes a route, update the description, the router and the README table in the same PR.
- Before the n8n verification request, remove the Development option from `credentials/NubboApi.credentials.ts` (keep Production only) and release again.
- Release: bump `version` in `n8n/package.json` and `CHANGELOG.md`, merge to `main`, then run the publish workflow with the version as input.
