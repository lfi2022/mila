# Frontend architecture

The browser application is organized around a small composition layer and explicit domain boundaries:

- `src/app`: query-client policy and stable query keys;
- `src/routes`: routing metadata and responsive page composition;
- `src/features/<domain>`: typed API adapters, domain types and feature entry points;
- `src/components/ui`: shared presentation primitives;
- `src/config`: public runtime URL and feature configuration;
- `src/services/api`: the only general JSON transport;
- `src/hooks`: application-facing state hooks, backed by feature APIs.

## HTTP contract

`apiRequest` owns the `/api/v1` base, cookie credentials, JSON error normalization, a 15-second default timeout, CSRF header propagation and the global session-expired event. TanStack Query owns server-state caching and retries only transient/server failures. Domain code supplies relative paths and typed request/response shapes; components do not call `fetch`, Supabase or database clients.

Auth, lists, gifts, reservations, notifications, product preview and cover upload now use the self-hosted API. Dashboard compatibility mapping is isolated at its route boundary while the existing visual layout is preserved. The former browser Supabase client and obsolete list/product/cover server functions were removed.

Rewards, payments and contributions now use typed feature API clients backed by Fastify, including Premium checkout/return, public bank-transfer instructions, parent contribution history and staff reconciliation/refund views. The contribution form displays gross amount, fees, Mila share and net parent amount before creating an instruction; the full IBAN is never stored in browser configuration. General administration remains behind its transitional server adapter until Stage 19, and orders expose only domain types until Stage 17; no placeholder network call pretends those features exist. Public-list/reporting remains a server-only transitional Supabase consumer; affiliate redirects moved to Fastify in Stage 10.

Price tracking uses the typed `features/prices` boundary. The parent panel distinguishes reliable variation from unavailable comparison, exposes explicit alert/automation controls and shows switch history. Public gift cards request an opaque-token suggestion and display it only when the API has already enforced freshness, identity confidence, availability and user-value ranking; the browser never decides which merchant wins.

Orders use the typed `features/orders` boundary and the static `/dashboard/orders` route. The page consumes backend-protected sections, opens snapshotted merchant links, plans contribution budgets and records only parent-confirmed transitions. It does not infer payment from reservation state and contains no cart robot, purchase automation or merchant credentials.

## Media

Cover upload requests a signed private-bucket URL, sends the file directly to the configured public storage origin, and verifies/associates it through the API. UI code never receives storage credentials. The stable display URL is constructed centrally by `buildAssetUrl`; pending malware scans fail closed.

`features/memories` owns second-hand proposals, reservation messages/media, thank-you tracking and memory-book calls. Public gift and reservation pages expose the token-scoped contribution flows without putting management tokens in URLs sent to the API. `/dashboard/memories` is the parent-controlled review surface: accepting an offer, authorizing a message for the book, approving a draft/card and selecting every memory are separate explicit actions. CSV and print/PDF preparation are authenticated downloads; private media is opened only through short-lived URLs returned after backend authorization and scan checks.

Administration now uses `features/admin` and role-protected Fastify endpoints; the transitional Supabase admin server functions were removed. The UI still checks role for navigation, but every query and action is independently authorized by the backend. Moderation and risk actions carry explicit reasons and refresh their audit-backed views. Public reporting is a throttled API call with a honeypot/timing hook; the browser does not decide whether a report is abusive or actionable.

SEO metadata uses the configured public origin and indexing switch. The editorial routes are normal route-split pages with canonical/Open Graph and JSON-LD metadata. `lib/analytics` is the single consent-gated first-party event transport; it strips queries and non-primitive properties. `ConsentBanner` never buffers events before a decision, and `/cookies` lets the visitor change that decision.

The root registers the production-only service worker, exposes a keyboard skip link and reports consented LCP/CLS observations. The PWA cache is deliberately narrower than the router: only immutable bundles and an explicit generic public-page allowlist can be used offline. `lib/pwa` owns native sharing and its feature detection.
