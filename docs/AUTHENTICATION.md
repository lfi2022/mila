# Self-hosted authentication

Mila authenticates against its own MySQL user/session records. Lovable OAuth and Supabase Auth are not used by the login, signup, profile, export, or deletion interface.

## Security model

- Passwords are limited before hashing and stored with Argon2id (`m=19456`, `t=2`, `p=1`).
- Session tokens contain 256 random bits. The database stores only an HMAC-SHA-256 digest; rotation revokes the previous record in the same transaction that creates its replacement.
- Verification and password-reset tokens are one-use, expiring values stored only as digests.
- Unknown-email login performs a dummy Argon2id verification, and forgot-password always returns the same accepted response.
- HttpOnly session cookies use configured `Secure`, `SameSite`, domain, path and TTL controls. A readable independent random cookie is compared in constant time to `X-CSRF-Token` for authenticated writes.
- Redis backs global and tighter authentication rate limits in deployed environments. MySQL and Redis are both included in readiness.
- `USER`, `MODERATOR`, `ADMIN`, and `SUPER_ADMIN` are loaded from MySQL on every authenticated request. Backend authorization uses `assertAnyRole`; frontend role checks are presentation only.
- Account deletion revokes sessions and anonymizes direct profile identifiers while retaining referentially necessary records. The export endpoint returns the account-owned domain records currently modeled.

## Email delivery

The API creates verification/reset tokens and the UI provides consumption routes. A local development response can expose a one-time token. Staging/production delivery is intentionally `BLOCKED_EXTERNAL` until SMTP/transactional-email credentials and sender-domain DNS are supplied; token delivery moves through the queued email worker in the infrastructure/notification stages.

Optional OAuth remains disabled. Enabling a future provider requires its own feature flag, redirect allowlist, account-linking rules and credentials; it cannot reintroduce the Lovable bridge.
