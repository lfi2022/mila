# Mila API

The self-hosted HTTP API is versioned from its first release. The current base path is `/api/v1`; frontend code must consume it through the centralized API configuration rather than duplicating the version string.

## Bootstrap routes

| Method | Path                   | Authentication        | Purpose                                                              |
| ------ | ---------------------- | --------------------- | -------------------------------------------------------------------- |
| GET    | `/api/v1/`             | Public                | API identity, version, and registered domain-module names            |
| GET    | `/api/v1/health/live`  | Public/infrastructure | Process liveness only                                                |
| GET    | `/api/v1/health/ready` | Public/infrastructure | Dependency readiness; returns 503 when a required dependency is down |
| GET    | `/api/docs`            | Deployment-controlled | Interactive OpenAPI documentation                                    |
| GET    | `/api/docs/json`       | Deployment-controlled | OpenAPI document                                                     |

Authentication, users, lists, gifts, reservations, products, merchants, orders, payments, rewards, notifications, media, reports, admin, and webhooks are registered as explicit module boundaries. Their routes are added in their roadmap stages; no placeholder endpoint pretends that an unimplemented product capability exists.

## Authentication routes

| Method | Path                           | Authentication | Purpose                                  |
| ------ | ------------------------------ | -------------- | ---------------------------------------- |
| POST   | `/api/v1/auth/signup`          | Public         | Create an unverified account             |
| POST   | `/api/v1/auth/login`           | Public         | Create cookie session after verification |
| GET    | `/api/v1/auth/me`              | Session cookie | Return the current user and roles        |
| POST   | `/api/v1/auth/refresh`         | Session + CSRF | Atomically rotate the opaque session     |
| POST   | `/api/v1/auth/logout`          | Session + CSRF | Revoke and clear the current session     |
| POST   | `/api/v1/auth/verify-email`    | Public token   | Consume a one-use verification token     |
| POST   | `/api/v1/auth/forgot-password` | Public         | Request reset without account disclosure |
| POST   | `/api/v1/auth/reset-password`  | Public token   | Change password and revoke all sessions  |
| PATCH  | `/api/v1/auth/profile`         | Session + CSRF | Update the profile                       |
| GET    | `/api/v1/auth/export`          | Session cookie | Export account data                      |
| DELETE | `/api/v1/auth/account`         | Session + CSRF | Anonymize account and revoke sessions    |

Passwords use Argon2id. Session, verification and reset values are random opaque tokens; only keyed SHA-256 hashes are persisted. Session cookies are HttpOnly and environment-secure. State-changing authenticated requests use a separate double-submit CSRF cookie/header. Login, signup and password-reset requests have Redis-backed limits when the production Redis service is connected. Development may return one-time verification/reset tokens to support local testing; staging and production never do.

## List routes

Authenticated list management uses `GET/POST /api/v1/lists`, `GET/PATCH/DELETE /api/v1/lists/:listId`, and invitation endpoints below each list. Writes require the session plus CSRF header. Membership authorization is resolved in MySQL for every operation; frontend ownership claims are ignored.

List detail includes owner/member identities and active invitations for authorized editors. `DELETE /api/v1/lists/:listId/members/:memberId` is owner/co-owner protected and refuses owner or self removal. Appearance fields are persisted with the list; non-null cover association is possible only through verified storage upload.

Public reads use `GET /api/v1/public/lists/:slug`. A `PROTECTED` list first requires the throttled `POST /api/v1/public/lists/:slug/unlock`; a successful Argon2id check issues a one-hour HttpOnly signed access cookie. Stored access-code hashes are never selected into public responses. Invitation acceptance is email-bound, expiring, one-use and transactional at `POST /api/v1/invitations/accept`.

## Gift and product routes

Gift CRUD is nested below `/api/v1/lists/:listId/gifts`; updates, deletion and ordering enforce list roles and CSRF. Money crosses HTTP as integer-minor-unit strings and is persisted as `BIGINT`. Linked gift creation records the original/canonical URL, merchant match, product identity and image provenance, then appends refresh work to a Redis Stream.

`POST /api/v1/products/preview` is authenticated and throttled. It pins DNS resolution to the prevalidated public addresses and revalidates every redirect, with protocol/credential/private-network blocks, timeout, byte limit and HTML-only responses. JSON-LD is preferred over Open Graph and generic metadata. Returned content is only a candidate: creating the gift is the explicit confirmation step.

## Reservation and notification routes

`POST /api/v1/public/reservations` creates an account-free reservation using the gift’s opaque public token. A conditional MySQL update and serializable transaction ensure `reserved_quantity + requested <= quantity`; losing concurrent requests return HTTP 409 and create no reservation. The response contains a one-time 256-bit management token whose keyed digest alone is stored.

Management uses body-carried tokens at `/api/v1/public/reservations/manage` and its `message`, `purchased`, and `cancel` actions, keeping tokens out of API path logs. Cancellation decrements inventory only after winning the reservation state transition. The public `/r/:token` page sends `no-referrer` and manages these actions through the API.

Authorized parents use `GET /api/v1/lists/:listId/reservations`; owner/co-owner cancellation uses `DELETE /api/v1/lists/:listId/reservations/:reservationId` with CSRF and the same conditional inventory release.

Authenticated `/api/v1/notifications` and `/api/v1/notification-preferences` endpoints expose in-app state and per-event in-app/email plus digest controls. Reservation events persist in-app notifications and append email work to Redis Streams. Surprise mode replaces guest/gift details with generic copy.

## Storage routes

Authenticated, CSRF-protected `POST /api/v1/storage/uploads/presign` and `POST /api/v1/storage/uploads/verify` implement direct private-bucket upload with server-generated keys and declared MIME/size enforcement. List covers include `listId` at verification so membership is checked before association. `POST /api/v1/storage/download` returns a short-lived URL only for an owner-prefixed object; `DELETE /api/v1/storage/uploads` verifies both key prefix and stored owner metadata.

Stable public reads use `/assets/list-cover/<key>` or `/assets/product-image/<key>`. They return data only for a public/unlisted, active database association whose object has clean malware-scan metadata; all other cases are indistinguishable from a missing asset.

## Merchant and affiliation routes

`GET /api/v1/merchants` returns only active public merchant identity/domain data. Staff can inspect and atomically upsert merchant status, logo key, domains, connector trust, network/identifier/link template, allowlisted tracking hosts and reward rate through `/api/v1/admin/merchants`; writes require staff role plus CSRF.

`GET /api/v1/public/go/:giftToken` resolves an active gift’s opaque token. The original merchant destination must match a stored merchant domain. Affiliate templates interpolate only the URL, opaque click token and configured publisher ID, then the resulting tracking host must match `affiliateRules.trackingHosts`; otherwise the request fails instead of redirecting. Click rows retain the original destination and a daily keyed IP pseudonym, never the raw address. Responses are no-store/no-referrer redirects.

`POST /api/v1/webhooks/affiliation` requires `FEATURE_AFFILIATION`, a timestamp no older than five minutes and `HMAC-SHA256(AFFILIATE_WEBHOOK_SECRET, timestamp + "." + canonical JSON body)`. `(network, externalId)` is unique, older events are ignored and pending events cannot regress confirmed/cancelled commission state.

## Reward routes

Authenticated list members read their ledger-derived balance and history at `GET /api/v1/rewards/lists/:listId`. The response exposes available, pending, lifetime-earned and lifetime-used minor units; cached wallet columns are never authoritative. `GET /api/v1/rewards/offers` and CSRF-protected `POST /api/v1/rewards/lists/:listId/redemptions` expose only conversion types enabled by feature flags.

Referral code/status uses `GET /api/v1/rewards/referral`; registration and qualification refresh are CSRF-protected writes below that path. Registration is capped, self-referral is rejected, same-domain/new-account signals are retained, and suspicious cases wait for staff review. Qualification requires a verified referred account with a non-empty list before an idempotent credit is appended.

Staff reward routes expose analytics, the review queue, audited adjustments, typed Premium/partner/promotion grants, and referral/redemption decisions below `/api/v1/admin/rewards`. Rejecting a redemption appends a compensating credit; it never edits or deletes the reservation debit. Commission cancellation follows the same append-only rule. Bank payout and the reward marketplace remain disabled unless their dedicated flags are enabled.

Reward policy is read from the `rewards` feature-flag JSON config. `networkRates` and `campaignRates` map identifiers to basis points; merchant rates override network rates, campaign rates override all other rates, and `maxShareRateBps` plus `maxRewardMinor` are profitability guardrails. Environment defaults remain the final fallback.

## Payment and Premium routes

`GET /api/v1/payments/methods` queries the active Mollie profile dynamically when test/live payments are enabled. `GET /api/v1/payments/premium/:listId` reports the configured one-time event price and entitlement. The CSRF- and idempotency-protected `POST` on that path first reserves the list entitlement, then creates the provider payment; a second checkout for the same event is rejected. Full reward payment is an optional atomic wallet redemption and never enters cash revenue.

The browser checkout redirect is UX only. `GET /api/v1/payments/:paymentId?reconcile=true` and the classic `POST /api/v1/webhooks/mollie` fetch the authenticated Mollie payment, refund and chargeback resources, verify mode/internal ID/amount/currency, and only then update state or activate Premium. Final paid state cannot regress because an older notification arrived later. This implements Mollie's documented [webhook fetch-back model](https://docs.mollie.com/reference/webhooks) and [payment status contract](https://docs.mollie.com/docs/handling-payment-status).

Administrators list and reconcile payments and request partial/full refunds below `/api/v1/admin/payments`. Every provider POST uses Mollie's [Idempotency-Key mechanism](https://docs.mollie.com/reference/api-idempotency); ambiguous payment creation stops before that provider window expires rather than risking a double charge. Confirmed refunds and chargebacks append negative financial-ledger entries. A full refund or chargeback revokes the linked Premium entitlement, while a partial refund remains visible without silently changing access.

## Contribution and bank-transfer routes

`GET /api/v1/public/contributions/:giftToken` returns the target, committed and remaining amounts for an active contribution gift. The throttled `POST /api/v1/public/contributions/:giftToken/bank-transfer` accepts an integer-minor-unit amount, optional name/e-mail/message and anonymous display choice. It requires `X-Idempotency-Key`, reserves the amount in a serializable transaction, refuses target oversubscription, and returns the exact beneficiary, IBAN, unique reference, amount and expiry. Reusing a key with different contribution data returns a conflict.

Authorized list editors read contribution history and the ledger-derived held balance at `GET /api/v1/lists/:listId/contributions`. The response separates gross amount, costs, Mila share and net parent funds; anonymous contributor identity is not exposed.

Staff can reconcile one transfer at `POST /api/v1/admin/bank-transfers/reconcile` or import up to 500 normalized bank rows at `/api/v1/admin/bank-transfers/import`. Exact reference and amount matches confirm the contribution; discrepancies enter manual review, and every decision is audited. `POST /api/v1/admin/contributions/:contributionId/refund` records an already-executed bank refund and appends the compensating funds entry. Expired unpaid instructions are cancelled by cleanup work and release their reserved target amount.

All public contribution creation stays disabled unless both `FEATURE_CONTRIBUTIONS` and `FEATURE_BANK_TRANSFERS` are enabled with beneficiary/IBAN configuration. Parent payouts require Mollie Connect and have no executable route until the external regulated-funds model is approved.

## Price tracking and comparison routes

Authorized list editors use `GET /api/v1/lists/:listId/price-tracking` for added/current price, reliable same-currency difference, availability, link health, next refresh, alert choices, ranked alternatives and automatic-switch history. `PATCH /api/v1/lists/:listId/gifts/:giftId/price-tracking` updates per-gift opt-ins and fixed/suggested/automatic offer mode. List-wide refresh, displayed-price, suggestion and guarded-switch choices are updated at `/api/v1/lists/:listId/price-settings`.

`GET /api/v1/public/prices/:giftToken` exposes only a fresh, strongly matched, available and genuinely cheaper suggestion when comparison is enabled. Staff can ingest a controlled offer through `POST /api/v1/admin/product-offers`; the merchant URL must match a configured domain, the gift must have a product identity, and match method/confidence are mandatory.

Scheduled refresh runs outside user requests. It leases due gifts atomically, caps each scheduler batch and each merchant share, respects merchant minimum intervals, backs off repeated failures and slows fulfilled gifts. Successful and failed checks both append snapshots. Alerts require both global `FEATURE_PRICE_ALERTS` and the gift's explicit opt-in. Automatic switching additionally requires global comparison, list and gift opt-ins, an available 90%+ identity match, merchant trust, configured minimum savings and an unreserved gift; every switch is recorded before the gift changes. Affiliate eligibility is returned for attribution but never contributes to ranking score.

## Order preparation and fulfilment routes

`GET /api/v1/orders` builds the authenticated parent's cross-list command center: ungrouped candidates, confirmed held funds versus planned allocations, and ready, awaiting-funding, ordered, received and problem sections. `POST /api/v1/lists/:listId/orders/prepare` atomically claims eligible gifts and creates one group per merchant for the same private destination and order window. Item title, URL, price, quantity and selected variant are snapshotted so later gift edits do not rewrite an order checklist.

Before submission, parents can update quantity/variant/inclusion at `PATCH /api/v1/orders/:groupId/items/:itemId`. `PUT .../contribution-allocation` plans confirmed third-party funds without pretending to spend or transfer them; a serializable transaction prevents overlapping plans. Full coverage moves a waiting group to ready. `POST /api/v1/orders/:groupId/status` enforces a forward-only lifecycle, requires a real parent-supplied order reference before `ORDERED`, updates gift fulfilment state and appends actor/reason history.

Manual mode provides merchant links and a checklist. Assisted mode prepares the same structured handoff for a future authorized connector. `AUTOMATIC_PLATFORM` requires its global feature flag plus a trusted merchant connector explicitly marked contract-authorized, and submission still returns `AUTOMATIC_ORDER_BLOCKED_EXTERNAL` because no production ordering connector exists. No endpoint runs browser automation or scraping to purchase products.

## Second-hand, messages, thank-yous, and memory routes

The public `POST /api/v1/public/second-hand-offers` accepts only gifts whose explicit policy allows or prefers second hand. The response contains an expiring management token; its keyed hash alone is stored. Token-protected photo presign/verify and withdrawal routes coordinate a private JPEG/PNG/WebP upload. Parents list and review proposals below `/api/v1/lists/:listId/second-hand-offers`; acceptance serializably claims one available gift quantity and rejects competing pending proposals. Photo download requires list membership, a short-lived signed URL, and clean scan metadata.

Reservation-token holders create private text messages and attach controlled audio/video at `/api/v1/public/reservations/manage/messages`. MIME signatures, exact size, duration, SHA-256 checksum, owner prefix, retention date and scan/transcode state are persisted. Parent media download fails closed until the object scanner marks it clean. Deletion immediately hides the database association and attempts private-object removal. Transcoding state is optional and remains pending only when its dedicated flag is enabled.

Authorized list members use `/api/v1/lists/:listId/thank-yous` to filter purchased gifts and track receipt/thanks. Draft edits clear prior approval; a digital card is exposed only after an explicit parent approval action. CSV export is authenticated. No generated draft is sent automatically.

`/api/v1/lists/:listId/memory-book` persists theme, introduction and retention choice. Only parent-approved visible messages and gifts belonging to the same list can become items. Print export produces authenticated A4-ready HTML for browser PDF/printing; clean private media receives short-lived signed links, unscanned media stays unavailable, and gift images must have an allowed usage policy.

## Administration, moderation, and reporting routes

All `/api/v1/admin/*` reads authenticate the session and require moderator/admin/super-admin role in Fastify; browser visibility is never the boundary. Overview, users, lists, reports, risk reviews and immutable audit entries are paginated. Existing protected payment, contribution, reward, affiliation and merchant endpoints complete the operational views. Financial overview derives confirmed commission, reward cost and typed ledger revenue separately; it never labels held parent funds or planned order allocations as Mila revenue.

`POST /api/v1/admin/moderation` requires CSRF, an allowed action, target UUID and a non-empty reason. List/gift/user/report state is read and changed transactionally, user suspension revokes sessions, and the same transaction appends actor, request ID, reason and before/after audit data. Risk decisions have a dedicated reviewed-by/time/resolution workflow and audit event.

The throttled public `POST /api/v1/public/reports` validates a real list/gift/user/message target and controlled reason. Honeypot, implausibly fast submission, link density and high-risk categories feed a bounded score. Medium-risk submissions create a manual risk review; high-risk submissions use the optional HTTPS adaptive-CAPTCHA hook when configured. Shared-IP use alone is never a ban signal.

## Product analytics routes

`POST /api/v1/analytics/events` accepts only an explicit consent flag, allowlisted event, UUID visitor/session identifiers, a path without query data, a recent timestamp and bounded primitive properties. It persists keyed pseudonyms rather than those UUIDs and always returns a non-identifying acceptance result. `GET /api/v1/admin/analytics?days=30` is staff-protected and combines consented funnel counts with authoritative user, list, gift, reservation, purchase, commission, Premium, referral and activated-family aggregates. Metrics that cannot yet be supported by real records stay null with a reason.

## Partner and family-lifecycle routes

`GET /api/v1/public/partners/:slug?campaign=<code>` is a read-only, throttled landing response. It returns only an active contracted partner and an optional active, current, non-exhausted campaign. `POST /api/v1/public/partners/:slug/attributions` requires explicit `accepted: true`, creates a random 30-day pseudonymous attribution, and sets its raw token only in an HttpOnly SameSite cookie. The first authenticated `POST /api/v1/lists` consumes and clears that cookie.

Staff create pending partners and inactive campaigns, change partner status, activate/deactivate campaigns, and append benefit-cost, reward-cost, or revenue facts below `/api/v1/admin/partners` and `/api/v1/admin/partner-campaigns`. All writes require CSRF, administrator role, and an audit reason. Positive minor units, matching currency, idempotency, campaign/attribution ownership, and serializable budget enforcement are server-side invariants.

Authenticated members read the post-event handoff at `GET /api/v1/lists/:listId/lifecycle`. `POST .../close` blocks future reservations; owner-only `POST .../archive` hides the public list; `POST .../future` creates a separate unlisted draft linked to the source without copying gifts or guest data. Environment allowlisting applies to normal edits and future events as well as creation.

## Error contract

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  },
  "requestId": "uuid"
}
```

Unexpected errors are logged server-side with the request ID and return a generic message. Authorization headers, cookies, passwords, and tokens are redacted from structured logs.

## Compatibility policy

Additive endpoints and optional response fields remain in `v1`. A future `v2` is reserved for breaking semantics or response/authentication changes. Shared business services must stay outside versioned controllers so versions can coexist during a documented migration window.
