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

## Media

Cover upload requests a signed private-bucket URL, sends the file directly to the configured public storage origin, and verifies/associates it through the API. UI code never receives storage credentials. The stable display URL is constructed centrally by `buildAssetUrl`; pending malware scans fail closed.
