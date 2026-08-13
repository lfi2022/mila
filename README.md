# Mila

Mila is a universal, family-friendly gift-list platform. This repository is being migrated from its exported prototype to a fully self-hosted architecture with a TanStack/React frontend, a versioned Node.js API, remote MySQL, Redis, workers, and S3-compatible storage.

The complete execution checklist is in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md). The exported-code audit and migration design are in [`MIGRATION_FROM_LOVABLE.md`](MIGRATION_FROM_LOVABLE.md).

## Current migration state

The Lovable build preset, runtime auth bridge, preview metadata, and error-reporting hook have been removed. Browser auth, lists, gifts, reservations, notifications, storage, affiliation, rewards, payments, and Premium use the self-hosted API. Supabase is retained only as historical migration evidence and is not a runtime dependency.

Do not use the migration branch as production until the stage journal marks the required technical and product stages complete.

## Requirements

- Node.js 22.12 or newer
- npm 11 or newer
- an environment file generated with the configuration wizard

## Configuration wizard

Run the interactive assistant from the repository root:

```sh
npm run config
```

It selects the local, staging, or production template; configures URLs and infrastructure; optionally enables SMTP, observability, and Mollie; generates independent secrets; checks dependencies; and writes `.env` atomically. Existing `.env` files are preserved unless overwrite is explicitly confirmed. Sensitive answers are masked.

Validate the current file at any time:

```sh
npm run config:check
```

For automated disposable local environments, `npm run config -- --profile local --defaults --force` creates a complete Docker-oriented configuration without prompts. `--defaults` is intentionally unavailable for staging and production.

## Development

```sh
npm ci
npm run dev
```

The development server listens on port 8080 by default.

The self-hosted API is a separate workspace:

```sh
npm run backend:dev
```

It listens on `PORT` (3000 by default), exposes `/api/v1`, and refuses to start when required base environment configuration is invalid.

The container stack and explicit migration flow are documented in [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md). In short: run `npm run config`, then `docker compose --profile migrate run --rm migrate` and `docker compose --profile local-db --profile local-storage up --build -d` for the local Docker profile.

## Validation

```sh
npm run check
```

Individual commands are available for secret scanning, formatting, linting, type checking, unit tests, and the production build.

API routes and compatibility rules are documented in [`docs/API.md`](docs/API.md).

## Environment safety

Real `.env` files, keys, certificates, and credentials are ignored. Only `*.example` templates may be committed. Unknown values must remain `A_REMPLIR`.

Public URLs are environment-driven. Local and staging builds are non-indexable by default; production indexing must be explicitly enabled.

## Git and Lovable history

This repository is connected to Lovable for synchronization of pushed commits. Never rewrite published history: no force push, and no rebase/amend/squash of commits already pushed.
