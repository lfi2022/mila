# Partners and family lifecycle

## Publication rules

Mila has no partner seed or fictional campaign fallback. A public partner page exists only when the database partner is `ACTIVE`, has a non-empty contract reference, and the requested campaign is active, within its date window, and below its cost budget. Public partner pages are always `noindex,follow`; they are distributed through a verified link or locally generated QR code rather than added to the sitemap.

Creating a partner leaves it `PENDING`, and creating a campaign leaves it inactive. An administrator must explicitly activate the contracted partner and then the campaign. Deactivating a partner also deactivates all its campaigns. Every creation, activation, deactivation, and ledger write records actor, reason, request ID, and relevant before/after data in the immutable admin audit log.

## Attribution and finance

Loading a landing page is read-only. Attribution starts only after the visitor clicks the disclosed Mila creation action. The API then stores a random-token HMAC, partner/campaign IDs, channel, and 30-day expiry in an HttpOnly SameSite cookie; it stores no visitor name, email, raw IP, or URL query. The first eligible list creation consumes the cookie once and links the attribution to the authenticated user and list.

Campaign money uses positive `BIGINT` minor units and a fixed ISO currency. The append-only ledger distinguishes `BENEFIT_COST`, `REWARD_COST`, and `REVENUE`; an idempotency key prevents duplicate imports. Cost insertion is serializable and cannot exceed the campaign budget. A supplied attribution must belong to the same campaign. Ledger entries record observed business facts only: configuring a campaign benefit does not fabricate a reward or revenue entry.

Real partner names, contract references, campaign terms, budgets, rewards, and revenue remain operational data supplied after authorization. Production activation is `BLOCKED_EXTERNAL` until those contracts and accounting rules exist.

## Family lifecycle

The data model supports `BIRTH`, `BIRTHDAY`, `CHRISTENING`, `CHRISTMAS`, `WEDDING`, and `OTHER`. `ENABLED_LIST_TYPES` is the deployment allowlist and defaults to `BIRTH,BIRTHDAY`; the browser exposes only those launch choices, while the backend rejects disabled types on create, edit, and future-event creation.

Closing a list sets `closed_at` and immediately blocks new reservations while keeping authenticated thank-yous, memory-book data, and reward history accessible. Archiving also hides the public list. Both actions are idempotent and append lifecycle audit events; generic list editing cannot bypass the archive action.

A future event creates a separate unlisted draft linked through `source_list_id`. It copies presentation settings only. Gifts, reservations, contributions, messages, media, attribution, access code, and guest data are never copied. The launch interface currently offers a birthday follow-up; other modeled event types remain hidden until validated.

## Deferred scope

Dutch localization, Luxembourg, France, native applications, a social network, and a full marketplace are deliberately absent from launch. The existing controlled second-hand proposal flow is not a marketplace and does not provide discovery, seller accounts, payments, or public inventory.
