# Infrastructure and operations

Stage 08 supplies a production-shaped local stack while keeping MySQL external by default. The application containers never create a production database implicitly.

## Services

`compose.yaml` runs the TanStack frontend, Fastify API, Redis, private MinIO buckets, the Redis Streams worker and Caddy. Caddy is the sole published application port and routes `/` to the frontend, `/api/` to Fastify and `/assets/` to the controlled asset endpoint. Vite emits its own immutable files below `/_app`, so application bundles do not collide with stored assets.

Copy one environment template and replace every `A_REMPLIR` value:

```sh
cp .env.local.example .env
docker compose config --quiet
docker compose --profile migrate run --rm migrate
docker compose up --build -d
docker compose ps
```

The migration command is an explicit deployment step. Run it once against the intended database before replacing API/worker containers. `docker compose --profile local-db --profile local-storage up` enables the isolated MySQL and MinIO development services; set `DATABASE_HOST=mysql`, use `mysql` in `DATABASE_URL`, and keep `STORAGE_ENDPOINT=http://minio:9000`. Staging and production must point to their remote MySQL and S3-compatible storage services.

## Storage

All five MinIO/S3 buckets are created with anonymous access disabled. Authenticated clients request short-lived signed uploads from `/api/v1/storage/uploads/presign`, upload with the declared content type, then call `/api/v1/storage/uploads/verify`. Keys are generated server-side below the user ID; MIME, byte quota, object metadata and leading file signature are checked. A verified list cover is associated only after list-role authorization. Downloads and deletion require ownership. `STORAGE_ENDPOINT` is the private service address; `STORAGE_PUBLIC_ENDPOINT` is the browser-reachable signed-transfer origin (`storage.localhost` in local Compose, normally a dedicated TLS hostname in production).

Stable `/assets/list-cover/<key>` and `/assets/product-image/<key>` reads additionally require an active public/unlisted database association and `scan=clean` object metadata. New uploads remain `PENDING` and inaccessible publicly while `stream:media-scan` retries and then dead-letters. A malware scanner service/credentials are `BLOCKED_EXTERNAL`; deployment must connect that hook and mark only clean objects before enabling uploaded media publicly.

## Workers and Redis

`backend/src/worker.ts` is an independently deployable process. `WORKER_QUEUES` selects streams per deployment and `WORKER_CONCURRENCY` creates separate blocking Redis connections. The available entry-point names are `product-refresh`, `prices`, `email`, `notifications`, `webhooks`, `affiliation`, `rewards`, `media-scan`, `token-cleanup`, `expiration`, `retry`, `analytics`, and the combined `cleanup` stream.

Transactional email is consumed from `stream:notifications`; `WORKER_QUEUES` must therefore contain `notifications`. Port 587 normally uses `SMTP_SECURE=false` (STARTTLS), while port 465 uses `true`. Keep `SMTP_TLS_REJECT_UNAUTHORIZED=true` with a trusted certificate. An internal server using a private/self-signed certificate may temporarily require `false`, but its CA should preferably be installed in the container trust store. Delivery results are logged as `email_sent` or `email_send_failed` without logging recipients or credentials; failed jobs retry five times and then move to `stream:notifications:dead-letter`.

Stage 08 processors deliver notification email, refresh product metadata/prices, expire reservations safely and clean expired auth tokens. Domain processors belonging to later roadmap stages remain disabled and dead-letter if a producer emits work prematurely. Every failed job is retried at most five times and then copied to `<stream>:dead-letter`; raw token values and email addresses are not written to worker logs.

Redis also provides distributed API rate limiting plus namespaced cache, ownership-token locks and idempotency-result primitives. MySQL remains the only source of financial and reservation truth.

## Health, TLS and shutdown

`/api/v1/health/live` checks the process. `/api/v1/health/ready` checks MySQL, Redis and object storage and gates Caddy startup. API and worker processes handle `SIGTERM`/`SIGINT`, stop accepting work and close dependencies.

The checked-in Caddyfile serves plain HTTP for local/container operation and proxies `storage.localhost` to otherwise-unpublished MinIO. At the public edge, terminate HTTPS in the platform load balancer or replace the local hosts with the real application/storage hostnames and enable Caddy automatic HTTPS. Preserve forwarded headers, set `TRUST_PROXY=true`, `COOKIE_SECURE=true`, an exact `CORS_ALLOWED_ORIGINS`, and keep MinIO/Redis ports private.

The frontend image receives the public origin and SEO switch as Vite build arguments and again as runtime variables. Local/staging builds keep both switches false; a production rebuild may enable them only for the approved canonical domain. The frontend server produces `robots.txt` and `sitemap.xml` dynamically, gives hashed `/_app/` files immutable caching, and forces the PWA manifest/service worker to revalidate. Caddy compresses responses with zstd/gzip.

## Observability and release operations

Structured request logs contain route templates and request IDs, not URL tokens, query values or bodies. Enable the protected Prometheus endpoint with `OBSERVABILITY_ENABLED=true` and a random `OBSERVABILITY_TOKEN` of at least 32 characters. `infra/prometheus-alerts.yml` supplies the baseline alert rules; provider wiring, destinations and on-call ownership remain external deployment work.

Run `npm run release:smoke` with `SMOKE_APP_URL` and `SMOKE_API_URL` after migrations and every deployment. The complete metric catalogue, alert expectations, release commands and stable-tag criteria are in `docs/OBSERVABILITY_AND_RELEASE.md`.
