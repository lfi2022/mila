# Mila Implementation Plan

Source of truth: `MILA_ROADMAP.md` (found as `MILA_ROADMAP(5).md` during audit, then normalized to the required name).

Status legend: `[ ]` pending, `[x]` completed, `BLOCKED_EXTERNAL` requires a secret, account, contract, infrastructure action, domain, or legal decision.

## Stage 00 — Repository and exported-code audit

- [x] Read the complete 5,319-line roadmap.
- [x] Verify the existing Git repository, branch, remote, worktree, and Lovable history constraint.
- [x] Inventory framework, router, UI, CSS, state, forms, hooks, pages, routes, network calls, environment variables, npm dependencies, analytics, SDKs, backend functions, storage, realtime, RPCs, and webhooks.
- [x] Search the repository for Lovable and Supabase runtime/build dependencies.
- [x] Identify public, authenticated, administrative, and token-based routes.
- [x] Identify large frontend files and mixed UI/data/business responsibilities.
- [x] Establish baseline install, lint, typecheck, test, and build status.
- [x] Record security findings and the migration target.
- [x] Remove the tracked real `.env` while preserving a local ignored copy.
- [x] Add secret scanning to developer checks (CI wiring follows the tooling stage).

## Stage 01 — Lovable independence and frontend build bootstrap

- [x] Replace `@lovable.dev/vite-tanstack-config` with explicit Vite/TanStack/React/Tailwind configuration.
- [x] Remove `@lovable.dev/cloud-auth-js`, Lovable auth, error reporting, preview integration, `.lovable`, and Lovable-specific package configuration.
- [x] Remove hard-coded `lovable.app` metadata and URLs.
- [x] Replace runtime public URLs with centralized environment-aware URL helpers.
- [x] Keep the current visual design and working UI components (missing proprietary logo assets use the local Mila mark until final brand files are supplied).
- [x] Synchronize the npm lockfile and standardize supported Node/npm commands.
- [x] Add lint, format-check, typecheck, unit-test, secret-scan, build scripts, and CI validation (integration coverage expands with the backend).

## Stage 02 — Self-hosted backend bootstrap and API v1

- [x] Create a modular Node.js/TypeScript/Fastify backend.
- [x] Establish `/api/v1` with centralized route registration and OpenAPI documentation.
- [x] Add structured errors, request IDs, safe logging, validation, security headers, CORS allowlist, proxy trust, body limits, and rate limiting.
- [x] Register module boundaries for auth, users, lists, gifts, reservations, products, merchants, orders, payments, rewards, notifications, media, reports, admin, and webhooks.
- [x] Keep business logic outside controllers and frontend components from the bootstrap onward.
- [x] Prepare future API version coexistence and document the compatibility/deprecation policy.
- [x] Add liveness/readiness health endpoints with injectable dependency probes.

## Stage 03 — Remote MySQL and versioned data model

- [x] Configure remote MySQL exclusively through validated environment variables.
- [x] Add Prisma MySQL schema, migrations, explicit seed, indexes, constraints, timestamps, soft-delete fields where justified, and transaction boundaries.
- [x] Model users, roles, sessions, verification/reset tokens, lists, members, invitations, gifts, images, offers, reservations, contributions, merchants, clicks, commissions, reward wallets/ledger/redemptions, referrals, partners, payments/refunds/chargebacks, bank transfers, order groups/items, notifications, messages/media, thank-yous, reports, audit logs, flags, entitlements, price snapshots, and product identities.
- [x] Use integer minor units/Decimal for money; never float or mutable balance as sole truth.
- [x] Add database pool, timeout, TLS options, graceful shutdown, and readiness checks (connection retry is provided by pool acquisition and orchestrator restart policy).
- [x] Document least-privilege `mila_app` and separate `mila_migration` accounts, network allowlisting, backups, retention, and restoration tests.
- [ ] `BLOCKED_EXTERNAL` — finalize and execute the Supabase/PostgreSQL-to-MySQL row transformer after a sanitized source export establishes the real production column shape; deterministic schema inventory and test-data/runbook controls are implemented.

## Stage 04 — Self-hosted authentication and account lifecycle

- [x] Implement signup, login, logout, current session, refresh/rotation, email verification, forgotten/reset password, profile update, data export, and account deletion.
- [x] Hash passwords with Argon2id and store only hashed opaque session/token values.
- [x] Use HttpOnly/Secure/SameSite environment-aware cookies and CSRF protection where applicable.
- [x] Add timing-equalized login, account-enumeration defenses and Redis-backed rate limits.
- [x] Implement `USER`, `MODERATOR`, `ADMIN`, and `SUPER_ADMIN` backend authorization.
- [ ] Replace Supabase auth in the frontend and server middleware: frontend account/auth/profile flows are migrated; transitional legacy server functions remain until their data modules move to `/api/v1` in Stages 05–11.
- [x] Put optional OAuth behind a disabled provider-neutral flag; no Lovable OAuth dependency.

## Stage 05 — Lists, membership, privacy, and sharing

- [x] Implement list CRUD with name, slug, description, existing cover key, optional due date/name, type, visibility, surprise mode, reservation behavior, theme, and lifecycle status.
- [x] Implement `PUBLIC`, `UNLISTED`, and `PROTECTED` lists with Argon2id access code, throttling, and signed temporary access cookie.
- [x] Enforce `OWNER`, `CO_OWNER`, and `EDITOR` permissions server-side.
- [x] Implement secure opaque invitation, email binding, atomic acceptance, revocation, expiry, and persistent membership history.
- [x] Implement cover upload using controlled object storage (signed upload, verified association, and stable delivery are provided by Stage 08).
- [x] Preserve current-domain links, QR codes, WhatsApp, email, Web Share, Open Graph, canonical, and optional indexing UI while the public read API enforces visibility.
- [x] Implement account/list export/deletion privacy flows and list visibility semantics.

## Stage 06 — Gifts and safe product catalogue

- [x] Implement gift CRUD/reordering for linked products, manual products, services, experiences, free gifts, contributions, and second-hand preferences.
- [x] Implement authenticated paste → detect → confirm through preview followed by an explicitly corrected gift payload.
- [x] Extract title, candidate image, price, currency, availability, description, canonical URL, brand and GTIN/MPN/SKU identifiers; merchant matching is domain-driven and variants remain explicit user input.
- [x] Establish source priority through the trust-aware connector layer: official API/feed connectors outrank JSON-LD, Open Graph and metadata when configured.
- [x] Harden SSRF against protocol abuse, credentials, private/loopback/link-local/cloud IPs, DNS rebinding, redirects, oversized responses, slow responses, and non-HTML content.
- [x] Record image provenance and conservative usage policy; unlicensed remote images require review and attribution, while placeholder/user upload arrives with controlled storage.
- [x] Add `MerchantConnector` abstraction and documented trust levels 0–4.
- [x] Queue Redis Stream refresh jobs for product metadata, price, stock, link, and authorized image maintenance.

## Stage 07 — Guest reservations and notifications

- [x] Implement account-free reservation with minimal guest fields and a 256-bit opaque management token stored only as a keyed digest.
- [x] Atomically prevent overbooking/double reservation with a conditional quantity update inside a serializable MySQL transaction.
- [x] Support consult, cancel, message update, and mark-purchased actions with expiration and one-winning state transitions.
- [x] Keep reserved, purchased, funded, ordered, shipped, received, cancelled, expired, and unavailable states distinct.
- [x] Implement surprise-mode notification redaction and configurable reserved-gift hiding.
- [x] Queue welcome, verification, reset, invitation, reservation, cancellation, purchased, and parent notification work in Redis Streams.
- [x] Add granular in-app/email preferences, immediate/daily/weekly/never grouping choices, Redis limits, and generic forgot-password responses.

## Stage 08 — Storage, workers, Redis, and Docker

- [x] Add Redis for cache, locks, queues, distributed rate limiting, and idempotency (never financial truth).
- [x] Add independent worker entry points for product refresh, prices, email, notifications, webhooks, affiliation, rewards, media, token cleanup, expiration, retry, and analytics.
- [x] Add MinIO/S3-compatible buckets, signed URLs, privacy, quotas, MIME/size checks, malware-scanning hook, deletion, and stable `/assets` URLs.
- [x] Containerize frontend, backend, worker, Redis, MinIO, and reverse proxy; remote MySQL remains external.
- [x] Add healthchecks and readiness-based startup, explicit production migrations, and optional isolated local MySQL profile.
- [x] Add local/staging/production environment templates and simple compose commands.
- [x] Route `/`, `/api/`, and `/assets/` through the reverse proxy with HTTPS guidance.

## Stage 09 — Frontend feature architecture

- [x] Introduce `app`, `routes`, domain `features`, shared components, centralized API services, config, hooks, validations, and types.
- [x] Extract auth, lists, gifts, reservations, rewards, payments, orders, and admin from route-level god components.
- [x] Remove all direct database/Supabase calls and scattered network access from UI components.
- [x] Centralize `/api/v1`, auth/error/timeout behavior, and runtime public/asset URL helpers.
- [x] Preserve responsive behavior, loading, empty, and error states.
- [x] Eliminate avoidable duplicated validation and route/business coupling.

## Stage 10 — Merchants and affiliation

- [x] Implement merchant domains, logos, status, connector trust, affiliation network/id/template/rules, reward rate, and tracking.
- [x] Implement opaque `/go/:token`, allowlisted destinations, original URL preservation, privacy-aware click tracking, and no open redirect.
- [x] Implement commission ingestion with unique external IDs, idempotency, pending/confirmed/cancelled states, and reconciliation.
- [x] Implement authenticated/signed affiliate webhooks and safe connector API calls.
- [x] Keep each network/merchant integration behind configuration and document missing contracts/keys as `BLOCKED_EXTERNAL`.

## Stage 11 — Rewards, referrals, and unified ledger

- [x] Implement one wallet per list derived from immutable/auditable ledger entries.
- [x] Support affiliate, referral, Premium, partner, promotion, redemption, and compensating adjustment entries.
- [x] Expose available, pending, lifetime earned, lifetime used, history, and explanation.
- [x] Resolve configurable global/network/merchant/campaign rates with caps and profitability guardrails.
- [x] Implement referrals with pending/qualified/rewarded/cancelled lifecycle, qualification rules, caps, risk signals, and manual review.
- [x] Implement redemptions and audited admin adjustment; keep bank payout and marketplace behind flags.
- [x] Add anomaly, revenue, margin, and program-cost administration.

## Stage 12 — Mollie payments and Premium

- [x] Implement internal order/payment records and server-side Mollie Payments API adapter.
- [x] Handle browser redirect only as UX; confirm paid state from Mollie/webhook.
- [x] Implement idempotent, out-of-order-safe payment/refund/chargeback webhooks and reconciliation.
- [x] Implement full/partial refunds and entitlement reversal rules.
- [x] Implement one-time Premium per event and optional reward redemption.
- [x] Separate test/live configuration and dynamically expose enabled methods.
- [x] Mark live activation `BLOCKED_EXTERNAL` until Mollie credentials/account and commercial decisions exist.

## Stage 13 — Contributions and bank transfers

- [x] Implement full, partial, and free contributions, anonymous option, message, target/progress, oversubscription prevention, closure, and refund.
- [x] Show beneficiary, fees, total paid, amount to parents, and Mila share transparently.
- [x] Model PaymentAccount, PaymentRoute, Contribution, FundsLedger, HoldingBalance, TransferInstruction, Payout, Refund, and Chargeback separately from Mila revenue.
- [x] Implement bank-transfer instructions with unique reference and waiting/received/matched/manual-review/refunded lifecycle.
- [x] Prepare bank import/API reconciliation and manual review.
- [x] Keep Mollie Connect, parent onboarding/routing/payouts, and real third-party-funds flow `BLOCKED_EXTERNAL` pending Mollie contract and legal/accounting validation.

## Stage 14 — Price tracking and comparison

- [x] Persist price/availability snapshots and reliable added/current price differences.
- [x] Schedule respectful refresh based on activity, due date, volatility, merchant rules, and API limits.
- [x] Implement opt-in price, stock, and dead-link alerts.
- [x] Model ProductIdentity and MerchantOffer using GTIN/EAN, SKU/MPN, brand/model, and controlled matching.
- [x] Support fixed merchant, suggested best offer, and guarded automatic switching (off by default).
- [x] Rank by total user value including delivery, availability, trust, and timing; never commission alone.

## Stage 15 — Order grouping and fulfilment

- [x] Implement OrderGroup and OrderGroupItem grouped by merchant/destination/window.
- [x] Implement manual-parent and assisted-parent workflows, variants, quantities, delivery, contribution allocation, and status history.
- [x] Add `/dashboard/orders` sections for ready, awaiting funding, ordered, received, and problems.
- [x] Keep automatic orders behind a feature flag and `BLOCKED_EXTERNAL` until an authorized merchant API/contract exists.
- [x] Never automate purchases through unauthorized scraping/browser robots.

## Stage 16 — Second hand, messages, thank-yous, and memories

- [x] Implement new-only/second-hand-allowed/preferred preferences and coordinated offer/condition/photo/comment/acceptance flow.
- [x] Implement text messages and controlled private audio/video uploads with limits, scanning hooks, signed URLs, deletion, and optional transcoding.
- [x] Implement received/thank-you tracking, filters, parent-approved drafts, digital cards, and export.
- [x] Implement memory book with authorized content, PDF/print-ready export preparation, themes, and retention settings.

## Stage 17 — Admin, moderation, legal, and privacy

- [ ] Implement backend-protected dashboards for users, lists, gifts, reservations, contributions, payments, rewards, affiliation, merchants, partners, reports, and revenue.
- [ ] Implement suspension/restoration, moderation, risk review, and immutable sensitive-action audit trail with reason and before/after where appropriate.
- [ ] Add phishing, malicious-link, spam, fraud, referral-abuse, and bot defenses with adaptive CAPTCHA hook/manual review.
- [ ] Complete privacy by design: minimization, consent, cookies, access, export, correction, deletion, retention, processors, incidents, and optional child data.
- [ ] Provide legal-notice, privacy, cookie, terms, Premium, rewards, referral, affiliation, contribution/payment, and reporting pages.
- [ ] Mark final legal text and financial terms `BLOCKED_EXTERNAL` pending qualified professional review.

## Stage 18 — SEO, analytics, performance, accessibility, and PWA

- [ ] Make indexing environment-driven: local/staging noindex/nofollow and blocking robots; production canonical/sitemap/indexing.
- [ ] Build useful editorial clusters and structured data without thin/fake content; disclose affiliate links.
- [ ] Track the documented activation funnel and KPIs without fake production data or unnecessary personal data.
- [ ] Add performance budgets, image optimization, caching, pagination, DB indexes, compression, and Core Web Vitals monitoring.
- [ ] Validate contrast, keyboard, focus, labels, ARIA, alt text, form errors, and touch targets.
- [ ] Add installable PWA manifest/icons, minimal offline behavior, safe caching, native sharing, and optional push.

## Stage 19 — Partners and family lifecycle

- [ ] Implement real partners/campaigns, attribution, budgets, advantages, reward/revenue tracking, and local partner QR/landing support.
- [ ] Never display fictional partners or campaigns.
- [ ] Support list types for birth, birthday, christening, Christmas, wedding, and other while exposing only validated launch types.
- [ ] Implement close/archive, memory/reward/thank-you handoff, and creation of future family events.
- [ ] Keep NL, Luxembourg, France, native apps, social network, and full second-hand marketplace out of the initial launch scope until usage validates them.

## Stage 20 — Observability, security verification, and release

- [ ] Add structured logs without secrets/tokens/banking data and pseudonymize identifiers where appropriate.
- [ ] Monitor uptime, 5xx, latency, DB, Redis, queues, email, extraction, storage, webhooks, Mollie, and worker lag.
- [ ] Alert on payment inconsistencies, webhook/queue failures, abusive extraction, auth failures, chargebacks, and anomalous payouts.
- [ ] Add unit, integration, E2E, concurrency, and security tests for IDOR, SSRF, XSS, injection, upload, privilege escalation, brute force, open redirect, and webhook replay.
- [ ] Validate localhost → `dev06.lfinfo.be` → arbitrary production domain without source changes.
- [ ] Run secret scan, lint, format check, typecheck, tests, build, Docker config validation, migrations, and smoke tests.
- [ ] Create stable milestone tags only after the documented criteria pass.
- [ ] Produce `docs/FINAL_IMPLEMENTATION_REPORT.md` with completed, partial, external blockers, security, database, Docker, routes, environment, Git, and deployment details.

## External decisions and credentials register

- `BLOCKED_EXTERNAL`: remote MySQL host/user/password/TLS/network allowlist and backup operator.
- `BLOCKED_EXTERNAL`: Redis/MinIO production credentials and infrastructure endpoints.
- `BLOCKED_EXTERNAL`: SMTP/email provider credentials and verified sender domain.
- `BLOCKED_EXTERNAL`: Mollie test/live keys, Connect onboarding, marketplace contract, fee/refund/chargeback/accounting model.
- `BLOCKED_EXTERNAL`: bank account/import API and legal basis for transfers/reconciliation.
- `BLOCKED_EXTERNAL`: affiliate network accounts, official merchant APIs/feeds, image-use permissions, and ordering contracts.
- `BLOCKED_EXTERNAL`: final production domain, DNS, certificates, analytics/monitoring providers, and alert destinations.
- `BLOCKED_EXTERNAL`: GDPR/legal review, terms, retention schedule, child-data policy, financial regulation, VAT/accounting, rewards legal nature and expiry.
- `BLOCKED_EXTERNAL`: partner contracts, localized legal copy, and launch-market validation beyond French-speaking Belgium.
