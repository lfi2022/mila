# SEO, product analytics, accessibility, and PWA

## Indexing contract

Indexing is deny-by-default. Local and staging set both `SEO_INDEXING_ENABLED=false` and
`VITE_SEO_INDEXING_ENABLED=false`; every page emits `noindex, nofollow`, `/robots.txt` returns
`Disallow: /`, and `/sitemap.xml` returns 404. Production may set both values to `true` only after
`PUBLIC_APP_URL` and `VITE_PUBLIC_APP_URL` contain the approved canonical HTTPS origin. The server
then creates `robots.txt` and a conservative sitemap containing useful public pages only. Private,
token, dashboard, payment, admin, demo, and user-list URLs are never listed.

The two maintained editorial pages form a deliberately small launch cluster:

- `/guides/liste-naissance`: timing, categories, example composition and multi-shop choice;
- `/guides/budget-cadeaux`: useful price bands, grouped gifts and total-cost guidance.

They have canonical/Open Graph metadata, Article structured data, internal links, safety caveats and
an affiliation disclosure. Do not generate city/product/keyword variants without distinct reviewed
content. Merchant links in editorial content must use `rel="sponsored"` and visibly disclose when
Mila can receive a commission.

The public acquisition pages reuse the same factual product vocabulary: multi-shop list, guest
reservation without an account, purchase completed with the third-party merchant, and explicit
affiliate disclosure. The homepage includes WebSite and FAQ structured data, a visual comparison,
the real five-step purchase path and links into the editorial cluster. Placeholder testimonials
must retain a visible fictional/demo label until replaced by reviewed, attributable customer
feedback; no rating, customer count or adoption claim may be inferred from placeholders.

## Analytics truth and privacy

The browser sends nothing until the visitor affirmatively enables internal measurement. Refusal is
equally prominent, remains editable on `/cookies`, and no pre-consent queue is replayed. Visitor and
session UUIDs are generated only after consent; Fastify replaces them with keyed HMAC-SHA-256
pseudonyms before persistence. The endpoint accepts only the event allowlist, a path, timestamp and
at most 12 short primitive properties. It rejects raw nested objects and timestamps more than one day
away. No email, name, list title, gift title, token, URL query, payment data or free text belongs in an
analytics property.

The consented browser funnel covers homepage, signup, list creation, first gift, sharing and first
reservation. Premium checkout/activation and Web Vitals are also measured. Eligible purchases,
confirmed rewards, commissions, Premium entitlements and referrals are counted from authoritative
business tables in `GET /api/v1/admin/analytics`; they must not depend on a browser event. This is why
the admin response exposes both event counts and business counts.

Unknown KPIs remain `null` with an explanation. In particular, the service does not invent GMV,
revenue per list or retention until purchase capture, accounting policy and cohort history support
them. Analytics retention/deletion and any external analytics processor remain `BLOCKED_EXTERNAL`
pending the approved retention schedule and processor register.

## Performance and accessibility gates

`npm run performance:budget` inspects the built client and fails when an individual JavaScript chunk
exceeds 600 KiB, a stylesheet exceeds 150 KiB, or all emitted JavaScript exceeds 2.5 MiB. The check
runs after the production build. Hashed `/_app/` assets receive a one-year immutable cache policy;
the manifest and service worker revalidate. Caddy supplies gzip/zstd compression. Images declare
dimensions and defer below-the-fold loading; route splitting keeps editorial pages small. Product
analytics stores indexed event/time and pseudonym/time columns, and all administrative collection
reads stay paginated.

Shared controls expose visible keyboard focus. The application provides a skip link, French document
language, semantic headings/landmarks, labelled icon buttons, explicit form labels/errors and
descriptive or intentionally empty image alternatives. New UI must preserve a minimum 44 CSS-pixel
touch target where controls are isolated. A release audit must cover keyboard-only use at 320 px and
200% zoom, screen-reader names, contrast, reduced motion and automated WCAG checks; real-device and
assistive-technology evidence is `BLOCKED_EXTERNAL` until a release candidate is deployed.
Public marketing layouts use single-column mobile defaults and add columns only at `sm`, `md` or
`lg` breakpoints. Global reduced-motion rules collapse non-essential animation and transition
durations when the user requests it.

## PWA safety boundary

The manifest has honest 192/512 icons, standalone display, language, theme and two shortcuts. The
service worker runs only in a production build on a secure origin. It cache-firsts immutable bundles
and network-firsts an explicit allowlist of generic editorial pages. It never intercepts API, assets,
dashboard, admin, token, invitation, list, payment or other private routes. Offline fallback explicitly
states that private data is unavailable. Native sharing has a clipboard fallback.

Push is intentionally absent: it is optional and must not be enabled before granular notification
preferences, anti-spam rules, an approved provider and production usage justify it.
