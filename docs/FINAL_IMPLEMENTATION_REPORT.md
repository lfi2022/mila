# Mila final implementation report

Date: 2026-08-13  
Branch: `migration/self-hosted-roadmap`  
Technical implementation state: stages 00–20 completed, with external activation gates documented below.

## Completed scope

Mila now has an independently buildable TanStack frontend and a versioned Fastify API backed by Prisma/MySQL, Redis Streams and private S3-compatible storage. The implementation covers self-hosted authentication, family lists and roles, gifts and reservations, notifications, merchant affiliation, rewards/referrals, Premium payments, contribution accounting, price history, guarded offer switching, order planning, second-hand proposals, messages and memories, administration/moderation, privacy operations, SEO/analytics/accessibility/PWA, verified partner campaigns and family-event lifecycle.

Stage 20 adds safe structured request/error/worker logs, protected Prometheus metrics, operational alerts, worker lag and financial-risk signals, expanded security/concurrency tests, release smoke probes and stronger CI release checks. No fictional merchant, partner, campaign, financial settlement or production integration is presented as real.

The last active public-list/reservation caller was migrated from transitional Supabase server functions to `/api/v1`. The Supabase runtime client, auth middleware, generated runtime types and npm SDK were removed; only historical SQL and migration-audit material remain.

## Security verification

Automated tests cover object-level authorization/IDOR, owner/admin privilege boundaries, SSRF-safe product URLs, script/XSS non-reflection, injection-shaped identifiers, MIME/signature/size upload checks, distributed brute-force throttling, exact-origin redirects and CORS, CSRF-protected writes, hashed opaque tokens, replay-safe webhooks and payment reconciliation, serializable reservation/budget/payment flows, and dead-letter handling without secret error text.

Secrets are excluded from source and logs; the repository secret scan passes. Sessions and attribution cookies are HttpOnly with controlled SameSite/secure behavior. Financial values use integer minor units and append-only ledgers or compensating entries.

## Database and migration state

The target schema consists of 13 ordered Prisma migrations and validates successfully. A clean MySQL 8.4 rehearsal applied every migration, `prisma migrate status` reported current, and `prisma migrate diff` reported no difference from the Prisma schema.

That rehearsal found and corrected a pre-production defect in `202608130003_list_appearance`: it referred to the nonexistent legacy table `gift_lists` instead of `lists`. The correction is published normally in `b61669b`; Git history was not rewritten. Any environment that already recorded the previous checksum as applied must stop and have its migration history reviewed/rebaselined by the database operator before deployment.

The legacy Supabase migrations remain migration evidence. Import mapping and reconciliation require a sanitized source export. Remote backup/PITR activation and a witnessed restore remain external gates.

## Docker, routes and environment

Compose provides frontend, API, worker, Redis, MinIO initialization/storage and Caddy, with local MySQL available only through the explicit `local-db` profile. Production MySQL remains external by design. Caddy exposes the application while data-service ports remain private.

The public API is rooted at `/api/v1`; liveness and readiness are `/api/v1/health/live` and `/api/v1/health/ready`. When enabled, authenticated Prometheus metrics are served at `/api/v1/health/metrics`. Feature contracts are catalogued in `docs/API.md`; templates cover local, staging and production without source edits. Tests validate localhost, `dev06.lfinfo.be` and an arbitrary production origin (`mila.example.org`).

## Validation evidence

- `npm run check`: PASS — secret scan, formatting, lint, typechecks, 19 frontend tests, 83 backend tests, production builds and performance budget.
- Prisma schema validation and legacy migration audit: PASS.
- Docker Compose configuration: PASS.
- Clean MySQL migration rehearsal: PASS, 13 migrations and zero schema difference.
- Full isolated Docker build and container health: PASS.
- Frontend, robots, API, liveness and readiness smoke: PASS.
- Protected metrics and Redis worker heartbeat: PASS.

Eight existing Fast Refresh advisory warnings and TanStack `inputValidator` deprecation notices remain non-blocking; there are no lint errors.

## Git and release decision

Every roadmap stage was committed and pushed incrementally to `origin/migration/self-hosted-roadmap`; published history was not rewritten. Stage 20 implementation is `b61669b` plus final runtime-removal commit `f389893`; the final documentation commit follows them.

No stable milestone tag is created. Stable promotion is blocked until the release gate in `docs/OBSERVABILITY_AND_RELEASE.md` has real staging/production evidence.

## Partial and externally blocked work

The code paths and safe defaults exist, but these cannot be truthfully activated from the repository alone:

- production DNS/TLS/domain, hosting, remote MySQL credentials/allowlisting, Redis/MinIO credentials, backup/PITR and restore evidence;
- SMTP/sender verification, malware scanner, monitoring vendor, alert destinations and named incident/on-call owners;
- Mollie accounts/Connect approval, webhook endpoints, payout/refund/chargeback/accounting policy and bank/provider access;
- affiliate accounts, official merchant feeds/APIs, image-use permission and ordering contracts;
- signed partner/campaign agreements, budgets, approved claims and reconciliation sources;
- GDPR/legal/child-data/retention review, processor contracts, terms, financial regulation, VAT/accounting and rewards decisions;
- sanitized Supabase export, rehearsed production data mapping and final cutover window;
- validation for additional languages, regions, native apps, social features or a full marketplace.

Until owners and credentials exist, related features remain disabled, pending, read-only, manual or explicitly `BLOCKED_EXTERNAL`. This is the release boundary, not an unimplemented repository task.
