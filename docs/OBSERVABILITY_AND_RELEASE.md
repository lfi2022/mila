# Observability and release runbook

## Safe telemetry contract

Fastify emits one structured `http_request_completed` event per response with only the request ID, method, route template, status code and duration. Route templates prevent tokens, UUIDs and query values from becoming metric labels. Authorization, cookies, CSRF tokens, passwords, payment/provider secrets, storage secrets, bank details and generic token fields are redacted. Unexpected failures log a request ID and error type, never the raw exception message, request body or job payload.

Workers publish expiring Redis hashes below `<QUEUE_PREFIX>:ops:worker:<queue>` containing heartbeat time, success/failure counters, last duration and error class. They do not publish job bodies, addresses, tokens or error messages.

## Metrics endpoint

Set `OBSERVABILITY_ENABLED=true` and provide a random `OBSERVABILITY_TOKEN` of at least 32 characters. Scrape `GET /api/v1/health/metrics` with `Authorization: Bearer <token>`. Disabled or unauthorized access returns 404, and successful responses use the Prometheus text format with `Cache-Control: no-store`.

The endpoint reports process uptime, HTTP request counts and cumulative latency by route template, dependency readiness, Redis queues and worker lag, payment/risk consistency signals and configured integration state. Import `infra/prometheus-alerts.yml` into the selected Prometheus-compatible alert manager. Its rules cover availability, dependencies, 5xx, latency, queues, worker lag, email/extraction/webhook/Mollie failures, authentication spikes, payment inconsistencies, chargebacks, high-risk reviews and payout anomalies. Alert destinations, production thresholds and on-call ownership remain `BLOCKED_EXTERNAL`.

## Release verification

Run from a clean checkout with the intended environment file:

```sh
npm ci
npm run check
npm run migration:audit
npm --prefix backend run prisma:validate
docker compose --env-file .env.production.example config --quiet
docker compose --profile migrate run --rm migrate
SMOKE_APP_URL=https://example.org SMOKE_API_URL=https://example.org/api/v1/ npm run release:smoke
```

The smoke command verifies frontend, robots, API root, liveness and readiness and rejects cross-origin redirects. Before promotion, also verify the protected metrics endpoint, worker heartbeats, queue consumption, a backup restore, TLS/DNS, SMTP delivery, storage scanning, Mollie settlement/reconciliation and rollback ownership.

Local clean-database rehearsal on 2026-08-13 applied all 13 migrations, reported no Prisma schema difference, built all images, kept every service healthy, observed worker heartbeats and passed all five HTTP smoke probes. The isolated containers and volumes were destroyed afterward.

## Stable release gate

Do not create a stable tag until CI passes for the exact commit; staging validates the intended domain and infrastructure; backup restore, migration and rollback have evidence; required providers are configured and tested; alert routing and incident ownership operate; security/legal/accounting/partner approvals are signed; and production smoke plus reconciliation pass.

No stable tag was created at Stage 20 because those external production criteria are not yet satisfied.
