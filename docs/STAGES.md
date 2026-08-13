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

Commit: `90b34cd`

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

## Stage 02 — Self-hosted backend bootstrap and API v1

Status: DONE

Commit: `e1b7f4f`

Implemented:

- independent `@mila/backend` npm workspace using Node.js, TypeScript and Fastify;
- validated environment configuration with HTTPS/SEO consistency checks;
- explicit `/api/v1` root and module registry;
- liveness and dependency-aware readiness endpoints;
- OpenAPI generation and interactive documentation;
- UUID request IDs, structured/redacted logging, normalized errors and 404 contract;
- Helmet security headers, environment CORS allowlist, request body limit, proxy trust and rate limiting;
- graceful SIGINT/SIGTERM shutdown;
- backend unit/injection tests and root quality-pipeline integration.

Tests:

- `npm run backend:typecheck`: PASS;
- `npm run backend:test`: PASS — 3 tests;
- `npm run backend:build`: PASS.

Environment:

- `APP_ENV`, `NODE_ENV`, `APP_NAME`, `APP_URL`;
- `API_PUBLIC_URL`, `ASSET_PUBLIC_URL`;
- `HOST`, `PORT`, `TRUST_PROXY`, `LOG_LEVEL`;
- `CORS_ALLOWED_ORIGINS`, `REQUEST_BODY_LIMIT_BYTES`;
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`;
- `SEO_INDEXING_ENABLED`.

Migration: none.

Notes:

- Rate limiting is process-local for this bootstrap and becomes Redis-backed in the infrastructure stage.
- Product endpoints are intentionally not exposed as placeholders; each module is activated only when its domain stage satisfies the Definition of Done.

## Stage 03 — Remote MySQL and versioned data model

Status: DONE_WITH_EXTERNAL_BLOCKERS

Commit: `83b8aad`

Implemented:

- validated remote MySQL host, port, database, user, password, URL, TLS, pool and timeout configuration;
- Prisma 7 MySQL schema covering the complete roadmap domain with UUID identifiers, foreign keys, unique constraints, indexes, timestamps and intentional soft deletion;
- integer minor-unit financial fields and immutable ledger-entry models;
- generated initial SQL migration and idempotent, disabled-by-default feature-flag seed;
- MariaDB driver adapter, bounded pool, TLS modes, `SELECT 1` readiness and graceful pool shutdown;
- least-privilege runtime/migration account, network, migration deployment, backup and restore-test runbook;
- deterministic audit of the 12 legacy Supabase migrations and their 24 source tables.

Tests:

- `npm run prisma:validate --workspace @mila/backend`: PASS;
- `npm run backend:typecheck`: PASS;
- `npm run backend:test`: PASS — 6 tests;
- `npm run backend:build`: PASS;
- `npm run migration:audit`: PASS.

Environment:

- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`;
- `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_URL`;
- `DATABASE_SSL_MODE`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`;
- `DATABASE_CONNECT_TIMEOUT_MS`.

Migration: `202608130001_initial`.

External blockers:

- remote database provisioning, firewall allowlist, TLS certificate, accounts and backup activation require operator access;
- a sanitized Supabase export is required to finalize, rehearse and approve the production row-level mapping without guessing personal-data transformations.

## Stage 04 — Self-hosted authentication and account lifecycle

Status: CORE_DONE_TRANSITIONAL_CALLERS_REMAIN

Commit: `ac17e2c`

Implemented:

- autonomous `/api/v1/auth` signup, login, current-session, rotation, logout, verification, reset, profile, export and deletion endpoints;
- Argon2id passwords and 256-bit opaque session/verification/reset tokens stored only as keyed digests;
- transactional session rotation, global revocation after password reset, suspension/deletion enforcement and timing-equalized invalid login;
- HttpOnly environment-aware session cookie plus constant-time double-submit CSRF protection;
- Redis-backed global and authentication-specific rate limiting, and MySQL/Redis readiness;
- backend role enforcement helpers for `USER`, `MODERATOR`, `ADMIN`, and `SUPER_ADMIN`;
- centralized frontend API client and autonomous auth/profile/reset/verification pages;
- frontend session bootstrap, admin presentation check and account lifecycle no longer use Supabase Auth;
- optional OAuth disabled behind `FEATURE_OAUTH`.

Tests:

- `npm run check`: PASS;
- frontend tests: 12 PASS;
- backend tests: 11 PASS, including hashing/token-storage, non-enumeration, CSRF, environment and role behavior.

Environment:

- `AUTH_SECRET`, `SESSION_SECRET`, `SESSION_TTL_SECONDS`;
- `EMAIL_VERIFICATION_TTL_SECONDS`, `PASSWORD_RESET_TTL_SECONDS`;
- `COOKIE_NAME`, `VITE_AUTH_COOKIE_NAME`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`;
- `REDIS_URL`, `QUEUE_PREFIX`, `FEATURE_OAUTH`.

External/transition blockers:

- SMTP/provider credentials and sender-domain DNS are required for production delivery of generated verification/reset links (`BLOCKED_EXTERNAL`);
- legacy TanStack server functions still use the transitional Supabase auth middleware while their data access is migrated module-by-module in the following stages; the new frontend auth path and Fastify API are independent of it.

## Stage 05 — Lists, membership, privacy, and sharing

Status: CORE_DONE_STORAGE_PENDING

Commit: `49db1bc`

Implemented:

- authenticated list create/read/update/soft-delete and user list collection endpoints;
- complete list metadata, lifecycle, themes, surprise/reservation display controls and indexing choice;
- server-side `OWNER`, `CO_OWNER`, and `EDITOR` authorization on every member operation;
- Argon2id-protected lists, throttled unlock and one-hour signed HttpOnly access grants;
- public-list projection that never returns access-code hashes;
- opaque, expiring, email-bound invitations with transactional acceptance and revocation;
- CSRF protection on all cookie-authenticated list writes;
- onboarding list creation and invitation acceptance migrated to `/api/v1`;
- existing domain-aware sharing, QR, Web Share, social metadata and privacy flows retained.

Tests:

- `npm run check`: PASS;
- frontend tests: 12 PASS;
- backend tests: 14 PASS, including access-code hashing/redaction and permission rejection.

External/transition blocker:

- cover object upload is completed with the controlled MinIO/S3 storage service in Stage 08; no uncontrolled interim upload endpoint was added.

## Stage 06 — Gifts and safe product catalogue

Status: DONE_WITH_CONNECTOR_CONFIGURATION

Commits: `fc9f2be`, `d47725e`

Implemented:

- role-protected gift CRUD, ordering and soft deletion across all roadmap gift kinds;
- integer-minor-unit prices, contribution targets, variants, quantities and second-hand/offer preferences;
- authenticated and throttled product preview followed by explicit corrected creation;
- JSON-LD, Open Graph and metadata extraction for identity, price, currency, availability and candidate image;
- merchant-domain matching and product identity persistence;
- SSRF guard with protocol/credential checks, DNS/IP public-address validation, DNS pinning, redirect revalidation, timeout, content length, streamed byte cap and MIME restriction;
- conservative image source/usage/attribution records, with remote images requiring manual rights review;
- `MerchantConnector` trust levels 0–4 and highest-authorized-connector selection;
- Redis Stream refresh jobs covering metadata, price, stock, links and authorized images.

Tests:

- backend typecheck: PASS;
- backend tests: 31 PASS, including private/metadata IPs, unsafe URL forms, extraction precedence/money parsing, image provenance and refresh enqueueing.

External configuration:

- merchant official API and affiliate-feed connectors above trust level 1 remain `BLOCKED_EXTERNAL` per merchant until contracts, credentials, schemas, rate limits and image-use rights are supplied;
- controlled user uploads and placeholder storage are activated with MinIO in Stage 08.

## Stage 07 — Guest reservations and notifications

Status: DONE_EMAIL_DELIVERY_EXTERNAL

Commit: `53067f9`

Implemented:

- guest reservation creation with minimal identity fields and opaque hashed management tokens;
- conditional MySQL quantity claim in a serializable transaction, preventing concurrent overbooking;
- consult, message, purchased and cancellation flows with expiry and atomic state transitions;
- cancellation-safe inventory release and distinct gift/reservation/payment/fulfilment states;
- surprise-mode notification redaction and hidden-reserved-gift policy;
- durable in-app notifications and Redis Stream jobs for welcome, verification, reset, invitation, reservation, purchased and cancellation events;
- per-event in-app/email and immediate/daily/weekly/never notification preferences;
- migrated no-referrer guest reservation management page.

Migration: `202608130002_notification_preferences`.

Tests:

- `npm run check`: PASS before the final surprise-policy adjustment;
- backend tests: 34 PASS, including concurrent-capacity rejection, token hashing, manager fan-out and cancellation inventory release;
- Prisma schema validation: PASS.

External blocker:

- queued email delivery remains `BLOCKED_EXTERNAL` until SMTP/provider credentials and sender-domain DNS exist; the independent worker and retry/dead-letter runtime are completed in Stage 08.

## Stage 08 — Storage, workers, Redis, and Docker

Status: DONE_WITH_EXTERNAL_SCANNER

Commit: `f8db05c`

Implemented:

- private S3-compatible buckets, short-lived signed upload/download, server-generated owner keys, quotas, MIME/signature verification, ownership-checked deletion and cover association;
- stable `/assets` streaming guarded by active public database associations and clean-scan metadata;
- Redis cache, compare-and-delete locks, idempotency results, distributed Fastify limits and durable Streams;
- independently selectable/concurrent stream consumers with bounded retry and dead-letter streams;
- concrete notification email, product/price refresh, reservation expiry and auth-token cleanup processors;
- frontend/API/worker/Redis/MinIO/Caddy containers, private buckets, readiness gates and graceful shutdown;
- explicit migration job, external MySQL default, optional isolated MySQL profile and complete environment templates;
- reverse-proxy routing for `/`, `/api/` and `/assets/`, with production HTTPS guidance.

Validation:

- backend typecheck: PASS;
- backend tests: 37 PASS, including signed-key policy and SMTP configuration;
- `docker compose --env-file .env.local.example config --quiet`: PASS (placeholder root-password warning only).
- frontend, backend and worker container image builds: PASS.

External blockers:

- SMTP credentials and sender-domain DNS remain `BLOCKED_EXTERNAL` for real email delivery;
- the malware scanner service is `BLOCKED_EXTERNAL`; uploads remain pending and public asset delivery fails closed until a scanner marks objects clean.
