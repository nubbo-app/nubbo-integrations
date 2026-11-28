# nubbo-integrations — Claude guide

> This repo is public. Commits, PRs, README and code carry no internal paths, issue or decision references, personal names or AI attribution.

## What lives here

Official integrations built on the public Nubbo API (`/v1`). The reference is `https://api.nubbo.app/v1/docs` and the OpenAPI document `https://api.nubbo.app/v1/openapi.json`.

| Folder | Integration | Published as |
| --- | --- | --- |
| `zapier/` | Zapier integration «Nubbo» (Zapier Platform CLI) | Zapier app `nubbo-zapier` |
| `make/` | Make custom app «Nubbo» (Make Apps Editor local format) | Make app `nubbo-fepsab` |

Each integration is its own package with its own lockfile; there is no root package. The n8n nodes live in their own repository, https://github.com/nubbo-app/n8n-nodes-nubbo (n8n verifies one package per repository).

## Git

- Commits are authored and committed by «Nubbo <info@nubbo.app>» (set in the repo config). Conventional Commits, English.
- Branch from `develop`, PR to `develop`; `main` only through a release PR.
- Nothing is published from a laptop.

