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

Rewards and administration have feature-level adapters around their legacy server functions until Stages 11 and 19 provide their Fastify endpoints. Payments and orders currently expose only domain types because their real behavior is introduced in Stages 12–13 and 17; no placeholder network call pretends these features exist. Public-list/reporting remains a server-only transitional Supabase consumer; affiliate redirects moved to Fastify in Stage 10.

## Media

Cover upload requests a signed private-bucket URL, sends the file directly to the configured public storage origin, and verifies/associates it through the API. UI code never receives storage credentials. The stable display URL is constructed centrally by `buildAssetUrl`; pending malware scans fail closed.
