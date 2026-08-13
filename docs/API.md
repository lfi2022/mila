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
