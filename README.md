# Mila

Mila is a universal, family-friendly gift-list platform. This repository is being migrated from its exported prototype to a fully self-hosted architecture with a TanStack/React frontend, a versioned Node.js API, remote MySQL, Redis, workers, and S3-compatible storage.

The complete execution checklist is in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md). The exported-code audit and migration design are in [`MIGRATION_FROM_LOVABLE.md`](MIGRATION_FROM_LOVABLE.md).

## Current migration state

The Lovable build preset, runtime auth bridge, preview metadata, and error-reporting hook have been removed. Supabase remains temporarily connected while its auth/data/storage features are replaced stage by stage; it is not part of the target architecture.

Do not use the migration branch as production until the stage journal marks the required technical and product stages complete.

## Requirements

- Node.js 22.12 or newer
- npm 11 or newer
- environment values copied from `.env.example`

## Development

```sh
npm ci
npm run dev
```

The development server listens on port 8080 by default.

## Validation

```sh
npm run check
```

Individual commands are available for secret scanning, formatting, linting, type checking, unit tests, and the production build.

## Environment safety

Real `.env` files, keys, certificates, and credentials are ignored. Only `*.example` templates may be committed. Unknown values must remain `A_REMPLIR`.

Public URLs are environment-driven. Local and staging builds are non-indexable by default; production indexing must be explicitly enabled.

## Git and Lovable history

This repository is connected to Lovable for synchronization of pushed commits. Never rewrite published history: no force push, and no rebase/amend/squash of commits already pushed.
