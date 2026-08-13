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

Public reads use `GET /api/v1/public/lists/:slug`. A `PROTECTED` list first requires the throttled `POST /api/v1/public/lists/:slug/unlock`; a successful Argon2id check issues a one-hour HttpOnly signed access cookie. Stored access-code hashes are never selected into public responses. Invitation acceptance is email-bound, expiring, one-use and transactional at `POST /api/v1/invitations/accept`.

## Gift and product routes

Gift CRUD is nested below `/api/v1/lists/:listId/gifts`; updates, deletion and ordering enforce list roles and CSRF. Money crosses HTTP as integer-minor-unit strings and is persisted as `BIGINT`. Linked gift creation records the original/canonical URL, merchant match, product identity and image provenance, then appends refresh work to a Redis Stream.

`POST /api/v1/products/preview` is authenticated and throttled. It pins DNS resolution to the prevalidated public addresses and revalidates every redirect, with protocol/credential/private-network blocks, timeout, byte limit and HTML-only responses. JSON-LD is preferred over Open Graph and generic metadata. Returned content is only a candidate: creating the gift is the explicit confirmation step.

## Reservation and notification routes

`POST /api/v1/public/reservations` creates an account-free reservation using the gift’s opaque public token. A conditional MySQL update and serializable transaction ensure `reserved_quantity + requested <= quantity`; losing concurrent requests return HTTP 409 and create no reservation. The response contains a one-time 256-bit management token whose keyed digest alone is stored.

Management uses body-carried tokens at `/api/v1/public/reservations/manage` and its `message`, `purchased`, and `cancel` actions, keeping tokens out of API path logs. Cancellation decrements inventory only after winning the reservation state transition. The public `/r/:token` page sends `no-referrer` and manages these actions through the API.

Authenticated `/api/v1/notifications` and `/api/v1/notification-preferences` endpoints expose in-app state and per-event in-app/email plus digest controls. Reservation events persist in-app notifications and append email work to Redis Streams. Surprise mode replaces guest/gift details with generic copy.

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
