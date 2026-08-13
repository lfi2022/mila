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
