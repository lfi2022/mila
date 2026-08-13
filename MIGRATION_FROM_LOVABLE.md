# Migration from Lovable

## Audit baseline

Audit date: 2026-08-13. Repository: existing `origin` (`lfi2022/mila`), initial branch `main`, initial commit `60d4d92`. Migration work uses `migration/self-hosted-roadmap`; published history must not be rewritten because pushes synchronize to Lovable.

The export contains 146 tracked project files and starts from a clean worktree. A real `.env` is tracked in the initial commit despite `.gitignore` not ignoring environment files. Its six keys configure Supabase; values are deliberately omitted here. Those values must be treated as exposed and rotated where applicable. History will not be rewritten due to the explicit Lovable constraint.

## Architecture found

- Frontend/SSR: TanStack Start, TanStack Router file routes, React 19, TypeScript, Vite, Tailwind CSS 4.
- UI: Radix primitives/shadcn-style local components, Lucide, Sonner, Recharts, React Hook Form/Zod.
- State/data: React context, TanStack Query, direct Supabase client calls, TanStack server functions.
- Backend: no independent backend service. Server functions and file routes execute inside TanStack Start and delegate persistence/auth/storage/business RPCs to Supabase.
- Database: Supabase PostgreSQL with 12 migrations, 24 application tables, RLS policies, triggers, and 20 application RPC/functions.
- Auth: Supabase Auth plus Lovable Cloud OAuth bridge; browser session tokens are forwarded as bearer tokens to server functions.
- Storage: Supabase Storage `list-covers` bucket.
- Realtime: Supabase channel used for notifications.
- Email: direct Resend HTTP call when configured, otherwise console development behavior.
- Analytics: local application tracking helper; production provider is not established.
- Tests: one Vitest source file, but Vitest is absent from dependencies and no test script exists.

## Routes found

Public pages: `/`, `/demo`, `/l/:slug`, `/liste/:slug` redirect, `/r/:token`, `/go/:token`, `/auth`, `/invitation/:token`, `/faq`, `/contact`, `/a-propos`, `/recompenses`, `/mentions-legales`, `/confidentialite`, `/cookies`, `/conditions`.

Authenticated UI: `/dashboard`, `/dashboard/:registryId`, `/profil`, `/onboarding`, `/recompenses/:registryId`.

Administrative UI: `/admin` (authorization is requested from server functions, but the route component is a 752-line mixed-responsibility file).

HTTP handler found: `/api/public/affiliate-webhook`. The application has no consistently versioned `/api/v1` surface; most mutations use framework-generated server-function endpoints.

Server functions found cover admin statistics/moderation/merchants, list access/invitations/export/deletion, cover uploads, product preview/matching, public list/reservations/reports, rewards/referrals/redemptions, and rewards administration.

## Lovable dependency inventory

| Location | Usage | Severity | Replacement |
| --- | --- | --- | --- |
| `vite.config.ts`, `package.json`, lockfiles, `bunfig.toml` | Proprietary build preset/plugins | Critical | Explicit upstream Vite/TanStack/React/Tailwind config |
| `src/integrations/lovable/index.ts`, `src/routes/auth.tsx` | Lovable Cloud OAuth | Critical | Mila backend auth; optional provider adapters |
| `src/lib/lovable-error-reporting.ts`, `src/routes/__root.tsx` | Lovable error reporting | High | Provider-neutral structured logging/monitoring |
| `.lovable/` | Project/plan metadata | Medium | Remove from production repository after migration record |
| `README.md`, `AGENTS.md` | Lovable workflow documentation | Low/constraint | Replace README; retain the no-history-rewrite warning while connected |
| SEO route metadata | Hard-coded `parent-gift-hub.lovable.app` | High | Environment-derived public URL/canonical helpers |

## Supabase dependency inventory

| Area | Files/usage | Severity | Replacement |
| --- | --- | --- | --- |
| Auth | `useAuth`, auth routes, middleware/attacher, client | Critical | Fastify auth module, Argon2id, MySQL sessions, secure cookies |
| Data access | dashboard/routes and all `*.functions.ts` | Critical | Versioned API client and backend repositories/services |
| Admin bypass | `client.server.ts` service-role client | Critical | Backend-only Prisma repositories plus explicit authorization |
| Database logic | 12 PostgreSQL migrations/RPCs/triggers/RLS | Critical | Prisma MySQL schema and transactional services/migrations |
| Storage | cover upload and storage policies | High | MinIO/S3-compatible media service |
| Realtime | `NotificationsBell.tsx` | Medium | polling initially; SSE/Redis pub-sub only where justified |
| Generated types | `src/integrations/supabase/types.ts` (1,678 lines) | Medium | API contracts/domain types generated from maintained schemas |

## Frontend Architecture Debt

| File | Problem | Priority | Refactor | Target stage |
| --- | --- | --- | --- | --- |
| `src/routes/admin.tsx` (752 lines) | UI, queries, mutations, forms, permissions, merchant configuration, moderation | Critical | `features/admin` screens/hooks/API/validation | 09/17 |
| `src/routes/dashboard.$registryId.tsx` (694 lines) | List settings, gifts, extraction, invitations, Supabase calls, UI | Critical | `features/lists`, `features/gifts`, `features/members` | 05/06/09 |
| `src/components/admin/RewardsAdmin.tsx` (500 lines) | Rewards business administration and complex UI | High | `features/rewards/admin` | 09/11 |
| `src/routes/l.$slug.tsx` (402 lines) | SEO loader, public rendering, reservation form/workflow | High | `features/public-list`, `features/reservations` | 07/09 |
| `src/lib/rewards-admin.functions.ts` (466 lines) | Many unrelated financial/admin operations | Critical | backend rewards services/controllers | 02/11 |
| `src/lib/rewards.server.ts` (395 lines) | Financial rules, persistence, emails | Critical | backend domain services + worker | 11 |
| `src/lib/public.functions.ts` (393 lines) | list access, reservation, email, moderation | Critical | backend list/reservation/report modules | 05/07/17 |
| `src/routes/index.tsx` (348 lines) | large marketing page | Medium | reusable marketing sections | 09/18 |
| `src/lib/admin.functions.ts` (333 lines) | broad privileged service-role operations | Critical | typed admin modules and policies | 02/17 |
| `src/components/ListAppearanceEditor.tsx` (321 lines) | upload, business preferences, form UI | Medium | list appearance feature | 05/09 |
| `src/routes/dashboard.index.tsx` (306 lines) | list creation, client-side slug generation, direct DB | High | list creation feature backed by API | 05/09 |

## Security findings

1. Critical: a real `.env` is committed. Remove it from the index, ignore all real env variants, rotate exposed values, and add secret scanning. Do not rewrite already-published history.
2. Critical: the browser directly accesses Supabase and contains the entire data access surface; production independence requirements are unmet.
3. High: Supabase service-role clients bypass RLS in broad server functions. Some handlers perform correct explicit checks, but the design is fragile and must be replaced with mandatory backend policies.
4. High: product URL validation blocks literal private addresses but does not resolve DNS and pin/revalidate the resolved address, leaving DNS rebinding/hostname-to-private-IP SSRF risk. The User-Agent also hard-codes an unknown domain.
5. High: rate limiting is in-process and therefore ineffective across replicas/restarts; move it to Redis.
6. High: public URL/canonical metadata hard-codes the Lovable domain and a `mila.be` fallback; staging SEO isolation is absent and `robots.txt` is static.
7. High: there is no standalone API versioning, centralized API authorization, or independent security boundary.
8. Medium: email is awaited inline in reservation paths rather than queued; provider failure can add latency and partial side effects.
9. Medium: frontend uses `Math.random()` for slug suffixes. Slugs are not secrets but should be created server-side with collision handling.
10. Medium: the notification realtime subscription and direct mutations widen the client-side attack/data surface.
11. Medium: build reproducibility is broken (`npm ci` reports an out-of-sync lockfile); Bun is unavailable; Vitest is referenced but undeclared.
12. Medium: legal pages exist but are prototype content and require qualified review before launch/financial activation.

No application use of `eval` or arbitrary HTML injection was found outside a local chart style helper. React escaping remains the default, but XSS tests and URL/output validation are still required.

## Baseline validation

- `git status`: clean on `main` before branch creation.
- `npm ci`: failed because `package.json` and `package-lock.json` are not synchronized (including missing QRCode and transitive packages).
- `bun`: unavailable on the audit machine.
- lint/typecheck/build/tests: could not be run reproducibly until dependency metadata is repaired; there are no `typecheck` or `test` scripts in the initial package.

## Target architecture

```text
Browser
  -> reverse proxy
       -> TanStack/React frontend
       -> /api/v1 Fastify backend
            -> remote MySQL (Prisma)
            -> Redis/queues
            -> MinIO/S3-compatible storage
            -> worker processes
            -> email/Mollie/affiliate adapters behind flags
```

The frontend never connects to MySQL or object storage internals. API controllers validate transport input; domain services enforce permissions and transactions; repositories alone access Prisma; slow/external work goes through queues. Financial truth is an auditable ledger.

## Migration sequence

1. Protect secrets and restore reproducible tooling.
2. Remove Lovable build/runtime dependencies and centralize portable URLs.
3. Bootstrap Fastify `/api/v1`, environment validation, logging, security, health, and OpenAPI.
4. Add remote-MySQL Prisma schema/migrations and migration tooling.
5. Migrate auth/session/account lifecycle.
6. Migrate lists/members/gifts/reservations and replace all direct Supabase calls.
7. Migrate storage/notifications/rewards/admin and remove Supabase packages/migrations from runtime.
8. Add Redis/workers/MinIO/Docker/reverse proxy and environment profiles.
9. Refactor frontend by feature as each backend domain is connected.
10. Continue product/business stages in `docs/IMPLEMENTATION_PLAN.md`, flagging unavailable external integrations without blocking independent work.

## Environment categories

Application/domain, database, Redis/queue, auth/cookies, CORS/proxy, email, storage, Mollie, affiliates, security/rate limits, analytics/observability, workers, SEO, and feature flags. Every used variable must be validated and documented in `.env.example`; real values are never committed.

## Data migration

The existing PostgreSQL schema cannot be applied to MySQL as-is because it relies on PostgreSQL enums, RLS, `auth.users`, storage tables, PL/pgSQL RPCs, JSONB, and triggers. The target migration will export data explicitly, normalize identifiers/statuses/money, import in dependency order, verify counts and foreign keys, and treat prototype demo data separately. Production export credentials and a decision on whether any current data must be retained are `BLOCKED_EXTERNAL`.

## External blockers

See the register in `docs/IMPLEMENTATION_PLAN.md`. Missing external secrets/contracts must result in disabled feature flags and `A_REMPLIR` examples, never invented credentials.
