# Mila Stages

## Stage 00 — Audit

Status: DONE

Commit: `a1e17be`

Implemented:

- complete roadmap read;
- repository, Git remote, framework, routes, components, dependencies, backend functions, environment, Lovable, Supabase, network, security, and architecture audit;
- executable roadmap checklist;
- migration inventory and target architecture;
- baseline reproducibility check.
- tracked `.env` removed from the index while the ignored local file was preserved;
- complete safe environment templates and tracked-file secret scanner added.

Tests:

- `npm ci`: FAILED_BASELINE — lockfile is out of sync;
- Bun: UNAVAILABLE;
- lint/typecheck/unit/build: pending dependency repair in Stage 01.
- `node scripts/scan-secrets.mjs`: PASS after staging Stage 00 files.

Environment:

- initial tracked keys inventoried without recording values;
- real `.env` remediation pending in this stage.

Migration: none (audit only).

Notes:

- Initial repository commit: `60d4d92`.
- Remote: existing GitHub `origin`; no repository was recreated.
- Branch: `migration/self-hosted-roadmap`.
- Published history will not be rebased, amended, squashed, force-pushed, or rewritten due to Lovable synchronization.

## Stage 01 — Lovable independence and frontend build bootstrap

Status: DONE

Commit: pending

Implemented:

- proprietary Lovable Vite preset, Cloud OAuth bridge, runtime reporting hooks, preview metadata, asset URLs, package references, Bun lock/config, and `.lovable` project files removed;
- explicit upstream Vite, TanStack Start, React, Tailwind and Nitro Node build configured;
- public/canonical URLs centralized and made environment-driven;
- local/staging indexing disabled by default;
- npm lockfile repaired and clean install made reproducible;
- direct test, typecheck, format, secret-scan, build and aggregate quality commands added;
- GitHub quality workflow added;
- existing codebase formatted and initial lint errors corrected;
- source-of-truth roadmap normalized to `MILA_ROADMAP.md`.

Tests:

- `npm ci`: PASS;
- `npm run security:secrets`: PASS;
- `npm run format:check`: PASS;
- `npm run lint`: PASS with 8 non-blocking Fast Refresh warnings in legacy/shared exports;
- `npm run typecheck`: PASS;
- `npm run test`: PASS — 12 tests;
- `npm run build`: PASS — Node/Nitro client and SSR production bundles.

Environment:

- `PUBLIC_APP_URL`, `APP_URL`, `VITE_PUBLIC_APP_URL`;
- `VITE_API_BASE_URL`, `VITE_ASSET_BASE_URL`;
- `SEO_INDEXING_ENABLED`, `VITE_SEO_INDEXING_ENABLED`;
- `PRODUCT_FETCH_USER_AGENT`.

Migration: none.

Notes:

- Supabase is deliberately still transitional and is removed by the backend/data/auth stages.
- Final full-size Mila logo artwork is `BLOCKED_EXTERNAL`; the local mark prevents runtime Lovable asset calls.
