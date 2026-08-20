# Mila Stages

## Product Media Compliance — DONE

- [x] Modèle `ProductMedia`, provenance, droits, cache et réclamations.
- [x] `MerchantMediaPolicy` en refus par défaut avec preuve et révision.
- [x] Fournisseurs Amazon, IKEA, Vertbaudet, Cybex, bol et repli générique.
- [x] Pipeline worker sécurisé et configuration documentée.
- [x] Bibliothèque Mila poussette, doudou lapin, transat et lit.
- [x] Choix parent avec déclaration de droits non pré-cochée.
- [x] Inventaire et blocage administratif immédiat.
- [x] Tests de politique, fournisseurs, ports, adresses et dimensions.

Les autorisations contractuelles propres aux marchands restent **À COMPLÉTER** et sont désactivées.

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

Status: DONE_WITH_PRODUCTION_DATA_IMPORT_BLOCKED_EXTERNAL

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

External blockers and final migration:

- SMTP/provider credentials and sender-domain DNS are required for production delivery of generated verification/reset links (`BLOCKED_EXTERNAL`);
- Stage 20 moved the final public-list/reservation caller to `/api/v1` and removed the Supabase runtime client, middleware, generated runtime types and npm dependency. Only historical migrations and migration-audit evidence remain; importing real legacy data still requires the sanitized export described in Stage 03.

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

## Stage 09 — Frontend feature architecture

Status: DONE_WITH_LATER_DOMAIN_ADAPTERS

Commit: `c9091bb`

Implemented:

- explicit `app`, `features`, `routes`, shared UI, config, hook and centralized transport boundaries;
- typed self-hosted adapters for auth, lists, gifts, reservations, notifications, products and storage;
- dashboard and notification UI migrated away from browser Supabase/database access without changing responsive presentation states;
- list appearance persistence, direct signed cover upload and stable asset URL construction;
- parent reservation reads/cancellation and member removal backed by server-side role checks and CSRF;
- global API timeout/error/session-expiry behavior and conservative TanStack Query retry policy;
- feature boundaries for rewards/admin transitional adapters and payment/order types until their dedicated implementation stages;
- unused browser Supabase client and obsolete list/product/cover server functions removed.

Migration: `202608130003_list_appearance`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS, including centralized API success/error behavior;
- backend tests: 38 PASS, including authorized manager reservation release;
- Prisma schema validation and migration audit: PASS.

Transition note:

- rewards, admin and public compatibility server functions remain isolated legacy Supabase consumers until Stages 11 and 19 expose their self-hosted domain APIs; the affiliate redirect moved in Stage 10.

## Stage 10 — Merchants and affiliation

Status: DONE_WITH_NETWORK_CONFIGURATION

Commit: `98ee698`

Implemented:

- merchant public/staff APIs for domains, logo, lifecycle, connector trust, affiliate network/identifier/template/rules and reward rate;
- opaque gift-token `/go` redirect moved from Supabase to Fastify;
- original merchant and generated tracking destinations protected by separate domain allowlists, preventing open redirects;
- minimal click persistence with original URL, opaque click ID and daily keyed IP pseudonym;
- commission ingestion unique by network/external ID with pending/confirmed/cancelled state and stale/regressive-event rejection;
- timestamped HMAC webhook authentication and feature-flag fail-closed behavior;
- all merchant/network activation remains configuration-driven.

Migration: `202608130004_affiliate_config`.

Validation:

- backend tests: 41 PASS, including destination allowlists and webhook signatures;
- backend typecheck and Prisma validation: PASS.

External blockers:

- every real affiliate network remains `BLOCKED_EXTERNAL` until contract, publisher ID, tracking host/template, webhook schema/signing convention and API credentials are supplied and verified.

## Stage 11 — Rewards, referrals, and unified ledger

Status: DONE_WITH_FLAGGED_EXTERNAL_PRODUCTS

Commit: `7bb45fe`

Implemented:

- one wallet per list with balances derived exclusively from signed immutable ledger entries;
- affiliate, referral, Premium, partner, promotion, redemption and compensating adjustment sources with idempotency keys;
- confirmed/pending/lifetime/history/explanation parent UI backed by the versioned API;
- global, network, merchant and campaign basis-point resolution with per-entry and share-rate profitability caps;
- referral codes, caps, risk signals, manual review and pending/qualified/rewarded/cancelled lifecycle;
- conversion balance reservation, audited approve/reject workflow, compensating rejection entry and audited staff adjustment;
- staff revenue, reward cost, margin, flagged-wallet, negative-balance and review-queue views;
- removal of the legacy Supabase reward functions and duplicate legacy affiliate webhook.

Migration: `202608130005_referral_codes`.

Validation:

- frontend and backend typecheck: PASS;
- backend tests: 43 PASS, including immutable ledger balance and compensation behavior;
- frontend and backend production builds: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

Environment variables:

- reward feature flags plus `REWARD_DEFAULT_SHARE_RATE_BPS`, `REWARD_MIN_REDEMPTION_MINOR`, `REFERRAL_REWARD_MINOR`, and `REFERRAL_MAX_PER_USER`.

External blockers:

- bank payout remains `BLOCKED_EXTERNAL` pending a regulated provider flow, legal/accounting validation and credentials;
- real marketplace offers, partner campaigns and production Premium funding remain disabled until commercial catalogs/contracts and the Stage 12 payment provider are configured.

## Stage 12 — Mollie payments and Premium

Status: DONE_WITH_LIVE_ACTIVATION_BLOCKED

Commit: `9a5bafa`

Implemented:

- server-only Mollie Payments API adapter with official-origin enforcement, timeouts, exact minor-unit conversion and provider idempotency keys;
- separate, validated test/live configuration and dynamic payment-method discovery;
- internal payment reservation that prevents concurrent Premium checkouts for one event;
- one-time Premium checkout, browser return polling and entitlement activation only after authenticated provider fetch-back;
- classic Mollie webhook handling, manual reconciliation, identity/mode/amount/currency verification and out-of-order-safe transitions;
- separate refunds and chargebacks, partial/full refund guardrails, immutable financial adjustments and audited staff refund requests;
- full-refund/chargeback Premium revocation while partial refunds preserve access pending commercial policy;
- atomic full-price Reward redemption as an optional non-cash Premium funding path;
- parent Premium UI and staff payment/reconciliation/refund administration.

Migration: `202608130006_entitlement_payment`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS;
- backend tests: 48 PASS, including exact money conversion, test/live separation, stale-event non-regression, provider-authenticated activation and refund reversal;
- Prisma validation and legacy migration audit: PASS;
- Docker Compose configuration: PASS (optional local MySQL root-password warning only).

Environment variables:

- `FEATURE_PREMIUM`, `FEATURE_MOLLIE_PAYMENTS`, `FEATURE_MOLLIE_CONNECT`;
- `MOLLIE_MODE`, `MOLLIE_API_KEY`, `MOLLIE_API_URL`, `MOLLIE_WEBHOOK_URL`, `MOLLIE_REDIRECT_URL`, `MOLLIE_TIMEOUT_MS`;
- `PREMIUM_PRICE_MINOR`, `PREMIUM_CURRENCY`.

External blockers:

- Mollie live activation is `BLOCKED_EXTERNAL` until a verified Mollie account, live API key, enabled methods, production domain/webhook and accounting/refund/chargeback policy are supplied and approved;
- Mollie Connect and all third-party-funds routing remain disabled for Stage 13 pending the marketplace contract plus legal/accounting validation;
- final Premium price, benefits, tax treatment and partial-refund access policy require commercial/legal approval before production activation.

## Stage 13 — Contributions and bank transfers

Status: DONE_WITH_THIRD_PARTY_FUNDS_ACTIVATION_BLOCKED

Commit: `56d6cc5`

Implemented:

- target-backed full/partial participation and target-free contribution gifts with anonymous display, message, progress, closure and expiry release;
- serializable target reservation, global idempotency keys and exact minor-unit fee/Mila/net-parent calculation;
- direct parent bank instructions returned on demand, encrypted IBAN snapshots, unique references and 48-hour expiry;
- waiting, exact-match, manual-review and refund lifecycle with single and 500-row staff reconciliation APIs plus audit records;
- separate contribution, bank-transfer, transfer-instruction, parent-funds ledger, holding projection and disabled payout models;
- ledger-derived held parent balance separated from Mila revenue, append-only confirmed/refund movements and parent dashboard breakdown;
- public contribution flow without Mila fees, parent contribution history and manual receipt confirmation by an owner or co-owner;
- fail-closed contribution/bank/payout flags and startup validation for cost policy, bank details and Mollie Connect dependency.

Migration: `202608130007_contribution_funds`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS;
- backend tests: 52 PASS, including exact integer contribution splits and fail-closed financial configuration;
- frontend and backend production builds: PASS;
- Prisma validation, legacy migration audit and Docker Compose configuration: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

Environment variables:

- `FEATURE_CONTRIBUTIONS`, `FEATURE_BANK_TRANSFERS`, `FEATURE_PARENT_PAYOUTS`;
- `CONTRIBUTION_FEE_RATE_BPS=0`, `CONTRIBUTION_PLATFORM_SHARE_RATE_BPS=0`, `CONTRIBUTION_MIN_MINOR`;
- `BANK_ACCOUNT_ENCRYPTION_KEY` (32 random bytes encoded as base64).

External blockers:

- real third-party-funds collection remains disabled until legal/accounting validation identifies an authorized account and operating process;
- Mollie Connect, parent onboarding/routing and executable payouts remain `BLOCKED_EXTERNAL` pending the marketplace contract, provider approval, KYC model and production credentials;
- payout UI/API is intentionally absent until those regulated-flow prerequisites are approved.

## Stage 14 — Price tracking and comparison

Status: DONE_WITH_MERCHANT_FEEDS_CONFIGURATION_PENDING

Commit: `484beba`

Implemented:

- immutable added price plus successful/failed price, availability and link-health snapshots with reliable same-currency differences;
- background scheduler with atomic leases, global/per-merchant batches, due-date/volatility/status cadence, merchant minimum intervals and failure backoff;
- explicit price-drop, stock and dead-link opt-ins with in-app/immediate-email preference enforcement;
- normalized controlled identities using GTIN/EAN, brand+MPN or brand+model, and staff offer ingestion with domain/match provenance checks;
- user-value ranking based on product plus delivery cost, availability, delivery timing, merchant trust, freshness and match confidence;
- fixed, suggested and guarded automatic modes, all default-safe and controlled from the parent dashboard;
- automatic switching gated by global/list/gift consent, 90%+ match, trusted merchant, availability, configurable savings and unreserved state;
- append-only offer-switch history and public cheaper-offer suggestions; affiliate eligibility never changes the rank.

Migration: `202608130008_price_tracking`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS;
- backend tests: 57 PASS, including cadence/backoff, controlled identity creation and commission-independent offer ranking;
- frontend and backend production builds: PASS;
- Prisma validation, legacy migration audit and Docker Compose configuration: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

Environment variables:

- `FEATURE_PRICE_TRACKING`, `FEATURE_PRICE_ALERTS`, `FEATURE_PRICE_COMPARISON`;
- `PRICE_SCHEDULER_INTERVAL_MS`, `PRICE_REFRESH_BATCH_SIZE`, `PRICE_REFRESH_PER_MERCHANT_BATCH`;
- `PRICE_REFRESH_MIN_HOURS`, `PRICE_REFRESH_MAX_HOURS`, `PRICE_AUTO_SWITCH_MIN_SAVINGS_BPS`.

External configuration:

- official merchant APIs/affiliate feeds, their rate limits and contractual data/image permissions remain configuration work per merchant;
- without an authorized feed/API, the hardened HTML metadata connector remains conservative and merchant minimum intervals apply;
- automatic comparison stays feature-flagged off until trusted merchants and controlled offers are populated.

## Stage 15 — Order grouping and fulfilment

Status: DONE_WITH_AUTOMATIC_ORDERING_BLOCKED_EXTERNAL

Commit: `0d59663`

Implemented:

- persisted order groups grouped by merchant, currency, destination and fulfilment window, with immutable item snapshots and append-only status history;
- atomic, serializable preparation that prevents duplicate claims and enforces a configurable maximum group size;
- manual-parent and assisted-parent workflows with quantity, variant, inclusion and delivery-cost adjustments;
- ledger-backed contribution allocation plans that never misrepresent planned funds as financial settlement;
- forward-only ready, ordered, received and problem lifecycles, including required external order references and gift-status synchronization;
- a parent order center with candidate, ready, awaiting-funding, ordered, received and problem sections;
- automatic ordering guarded by both a global feature flag and explicit merchant authorization, while returning `BLOCKED_EXTERNAL` because no authorized connector exists;
- an explicit prohibition on scraping or browser-robot purchasing.

Migration: `202608130009_order_fulfilment`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS;
- backend tests: 61 PASS, including atomic grouping, contribution allocation and forward-only lifecycle behavior;
- frontend and backend production builds: PASS;
- Prisma validation, legacy migration audit and Docker Compose configuration: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

Environment variables:

- `FEATURE_ORDER_FULFILMENT`, `FEATURE_AUTOMATIC_ORDERS`;
- `ORDER_PREPARATION_MAX_ITEMS`.

External blockers:

- automatic orders remain `BLOCKED_EXTERNAL` until an official merchant API or contract, credentials, explicit consent, payment/address handling and returns policy are approved;
- no purchase automation through scraping or browser robots is implemented or permitted;
- contribution allocation remains a budget plan until the regulated third-party-funds architecture is approved and activated.

## Stage 16 — Second hand, messages, thank-yous, and memories

Status: DONE_WITH_MEDIA_OPERATIONS_CONFIGURATION_PENDING

Commit: `e4fdb6a`

Implemented:

- explicit new-only, second-hand-allowed and second-hand-preferred gift choices in parent gift creation;
- token-protected second-hand proposals with condition, comment, optional private photo, withdrawal and parent acceptance/rejection;
- serializable acceptance that claims available quantity and closes competing pending proposals;
- reservation-scoped private text, audio and video messages with MIME/signature, size, duration, owner-prefix and SHA-256 controls;
- fail-closed malware-scan metadata checks, short-lived signed downloads, soft deletion plus object removal, retention deadlines and optional transcode state;
- received and thanked tracking, unthanked filtering, editable drafts whose approval resets on change, parent-approved digital cards and CSV export;
- parent-only message authorization and selected-item memory books with themes, introduction, retention setting and authenticated print/PDF-ready export;
- a unified `/dashboard/memories` review center plus public proposal and reservation-message interfaces.

Migration: `202608130010_memories_and_second_hand`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS;
- backend tests: 64 PASS, including second-hand policy, controlled media and explicit memory-consent behavior;
- frontend and backend production builds: PASS;
- Prisma validation, legacy migration audit and Docker Compose configuration: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

Environment variables:

- `FEATURE_SECOND_HAND_OFFERS`, `FEATURE_MEDIA_MESSAGES`, `FEATURE_THANK_YOUS`, `FEATURE_MEMORY_BOOK`;
- `FEATURE_MEDIA_TRANSCODING`, `MEDIA_AUDIO_MAX_BYTES`, `MEDIA_VIDEO_MAX_BYTES`, `MEDIA_RETENTION_DAYS`.

External configuration:

- production media activation requires deployment and monitoring of an authorized malware scanner that writes clean/infected object metadata; until then downloads fail closed;
- optional production transcoding remains disabled until an approved transcoder, codecs, queue capacity and cost/retention policy are configured;
- physical book printing is export/print-ready only and requires a commercial printer contract, proofs, fulfilment and returns policy;
- retention duration, parental consent copy and child-media privacy handling require final legal/DPO approval before production activation.

## Stage 17 — Admin, moderation, legal, and privacy

Status: DONE_WITH_LEGAL_AND_PROVIDER_REVIEW_BLOCKED_EXTERNAL

Commits: `d8bb250`, `e2641c7`

Implemented:

- role-protected Fastify administration for real users, lists, gifts/reservations, contributions, payments, rewards, affiliation, merchants, reports, risk reviews and typed revenue;
- removal of the transitional Supabase administration functions and a typed frontend admin API;
- transactional list/gift/user/report moderation, user session revocation, mandatory reasons and immutable before/after/request-ID audit entries;
- scored phishing, malicious-link, spam, fraud, referral-abuse and bot signals with throttling, target validation, manual review and an optional HTTPS CAPTCHA verification hook;
- explicit consent-evidence, risk-review, incident and processor registers plus a documented minimization/rights/retention/child-data workflow;
- public reporting, expanded privacy/terms/legal pages and explicit draft/blocker notices for unapproved professional text;
- separate real revenue, confirmed commission and reward-cost reporting that never treats parent funds or order budgets as Mila revenue.

Migration: `202608130011_compliance_and_risk`.

Validation:

- `npm run check`: PASS;
- frontend tests: 14 PASS;
- backend tests: 66 PASS, including adaptive report-risk behavior;
- frontend and backend production builds: PASS;
- Prisma validation, legacy migration audit and Docker Compose configuration: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

Environment variables:

- `FEATURE_ADAPTIVE_CAPTCHA`, `CAPTCHA_VERIFY_URL`, `CAPTCHA_SECRET`.

External blockers:

- final legal notice, privacy policy, cookie policy and terms require verified entity/provider details and qualified Belgian legal/DPO review;
- Premium, rewards, referrals, affiliation, contributions, payment, tax/accounting and third-party-funds terms remain `BLOCKED_EXTERNAL` pending professional approval;
- production CAPTCHA activation requires an approved processor, credentials, privacy review and accessibility fallback;
- incident ownership, notification contacts, processor contracts and the final retention/child-media schedule require named operators and professional approval.

## Stage 18 — SEO, analytics, performance, accessibility, and PWA

Status: DONE_WITH_PRODUCTION_DOMAIN_AND_MONITORING_BLOCKED_EXTERNAL

Commits: `9385151`, `5783c22`

Implemented:

- environment-driven indexing, robots, canonical URLs and sitemap behavior;
- useful editorial guide routes with structured data and transparent affiliate language;
- consented, first-party, pseudonymous product analytics plus real-data admin KPIs;
- production bundle budgets, compressed responses, image optimization and Core Web Vitals capture;
- keyboard skip navigation, visible focus, accessible labels and responsive touch targets;
- installable manifest/icons, narrow safe offline caching and native sharing.

Validation: full `npm run check`, Prisma validation, migration audit, production builds and Docker Compose configuration passed; 18 frontend and 68 backend tests passed. Production DNS, certificates, final public origin, monitoring provider and alert destinations remain `BLOCKED_EXTERNAL`.

## Stage 19 — Partners and family lifecycle

Status: DONE_WITH_REAL_PARTNER_ACTIVATION_BLOCKED_EXTERNAL

Commit: `e9fe0c8`

Implemented:

- pending-by-default partners and inactive-by-default campaigns with contract-gated activation and automatic campaign shutdown on partner deactivation;
- read-only verified local landing pages, locally generated campaign QR codes, and explicit-click 30-day pseudonymous attribution;
- serializable, idempotent campaign cost/reward/revenue ledger entries with currency, attribution, and budget invariants;
- administrator creation, activation, attribution counts, budget/cost/revenue views, and immutable audit reasons;
- all six family-event types in the data contract, with environment allowlisting and only birth/birthday exposed for launch;
- idempotent close/archive actions, reservation blocking, memory/thank-you/reward handoff, lifecycle history, and separate future birthday drafts without copied guest data;
- explicit exclusion of unsupported regions, native/social expansion, and a full marketplace.

Migration: `202608130013_partners_and_family_lifecycle`.

Validation:

- format, frontend/backend typecheck, Prisma validation and migration audit: PASS;
- frontend tests: 18 PASS;
- backend tests: 72 PASS, including unpublished partners, exhausted budgets, hashed attribution, and disabled launch types;
- frontend production build and Docker Compose configuration: PASS;
- lint: PASS with 8 pre-existing Fast Refresh warnings.

External blockers:

- no production partner or campaign is activated without a real signed contract, approved public copy, exact budget, accounting treatment, and operational owner;
- partner-funded reward and revenue imports require approved reconciliation sources and finance policy;
- new event types and geographic/language expansion remain disabled until product, legal, and market validation.

## Stage 20 — Observability, security verification, and release

Status: IMPLEMENTATION_DONE_STABLE_RELEASE_BLOCKED_EXTERNAL

Commits: `b61669b`, `f389893`

Implemented:

- safe structured HTTP, application and worker telemetry with secret redaction and route-template labels;
- protected Prometheus metrics for availability, dependencies, latency, queues, worker lag and financial/risk consistency;
- Prometheus-compatible alert rules for service, integration, abuse, payment, chargeback and payout anomalies;
- expanded security, replay, concurrency, throttling and domain-portability tests;
- CI migration/schema/Compose checks and a reusable release smoke command;
- clean-database and full isolated Docker release rehearsal, including a Redis consumer-group prefix fix;
- final migration of the public list/reservation UI to Fastify, with JSON-safe projections, private SSR API routing and complete removal of the Supabase runtime;
- final release runbook and implementation report with an explicit stable-tag gate.

Validation: `npm run check` passed with 19 frontend and 83 backend tests; Prisma validation, migration audit, Compose configuration, 13 clean migrations, schema diff, container health, protected metrics, worker heartbeat and five HTTP smoke probes passed.

No stable tag was created. Production infrastructure, provider credentials, monitoring destinations, restore evidence, legal/accounting approvals, partner contracts and named operational ownership remain `BLOCKED_EXTERNAL`.
