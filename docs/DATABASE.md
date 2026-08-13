# Mila database operations

MySQL 8 is the only application database target. It is remote in staging and production; Docker Compose must not silently create a production database. Prisma owns the versioned schema in `backend/prisma/schema.prisma` and migrations in `backend/prisma/migrations`.

## Accounts and network access

Create distinct accounts from an administrative MySQL session and replace every `A_REMPLIR` value outside Git:

```sql
CREATE USER 'mila_migration'@'A_REMPLIR_CIDR_OR_HOST' IDENTIFIED BY 'A_REMPLIR';
CREATE USER 'mila_app'@'A_REMPLIR_CIDR_OR_HOST' IDENTIFIED BY 'A_REMPLIR';
GRANT ALL PRIVILEGES ON mila.* TO 'mila_migration'@'A_REMPLIR_CIDR_OR_HOST';
GRANT SELECT, INSERT, UPDATE, DELETE ON mila.* TO 'mila_app'@'A_REMPLIR_CIDR_OR_HOST';
```

Restrict inbound TCP/3306 to the application and deployment networks. Require TLS in production, use a trusted server certificate, rotate passwords, and do not give the runtime account DDL or grant privileges. `DATABASE_URL` is for Prisma migration tooling; runtime connections use the individually validated `DATABASE_*` values so pool and TLS behavior remain explicit.

## Commands

From a trusted deployment runner with the migration account in `DATABASE_URL`:

```sh
npm run prisma:validate --workspace @mila/backend
npm run db:migrate:deploy --workspace @mila/backend
npm run db:seed --workspace @mila/backend
```

Migration deployment must run once before replacing application containers. Application replicas use `mila_app`; they never run `migrate dev` or generate migrations. The readiness endpoint performs `SELECT 1` and returns HTTP 503 when MySQL is unavailable.

## Reward ledger invariants

`reward_wallets.list_id` is unique, so a list has at most one wallet. `reward_transactions.idempotency_key` is globally unique and every monetary value is a signed `BIGINT` minor-unit amount. Available and pending balances are always recomputed from ledger status and amount; cached wallet columns are optional projections only. Corrections, cancelled commissions and rejected redemptions append idempotent compensating entries instead of updating or deleting settled entries. Referral ownership codes are normalized in `202608130005_referral_codes` and are unique per user and globally.

`202608130006_entitlement_payment` links an event entitlement to the exact internal payment that funded it. A list's unique entitlement row also reserves an in-progress Premium checkout, preventing concurrent purchases. Provider payment/refund/chargeback rows remain distinct from append-only `financial_ledger_entries`; browser redirects never write settlement or entitlement state.

## Contribution funds invariants

`202608130007_contribution_funds` keeps contribution intent, bank receipt, transfer instruction and third-party-funds accounting in separate tables. Contribution idempotency keys and transfer references are globally unique. Only masked IBAN data is persisted in `transfer_instructions`; the configured full IBAN remains an application secret and is returned only with a freshly requested instruction.

`funds_ledger_entries` is distinct from Mila's `financial_ledger_entries`: confirmed parent funds are derived from signed, settled entries, never from `holding_balances.cached_minor`. Pending reservations do not count as held funds. Confirmation expires the pending marker and appends a confirmed entry; a refund appends a negative compensating entry. `payouts` is modeled for the regulated-provider target architecture but remains disabled and has no creation route.

## Price history and product matching

`202608130008_price_tracking` makes price snapshots nullable so failed/dead-link checks remain part of history, with explicit link health and error code. Gift refresh state is operational scheduling data; added price remains immutable while current values come from the latest reliable snapshot. Differences are reported only for matching currencies and healthy checks.

Product identity keys normalize GTIN/EAN first, then brand+MPN or brand+model, and prevent new duplicate controlled identities. Merchant offers retain source, match method/confidence, delivery, availability and check time. Weak, stale or cross-currency offers are excluded. `gift_offer_switches` is an append-only decision history containing both destinations, prices, savings, confidence and policy reason for every guarded automatic change.

## Order fulfilment invariants

`202608130009_order_fulfilment` extends order groups with a hashed destination key, deterministic merchant/destination/window grouping key, private destination payload, window, delivery cost and real external/tracking references. Items snapshot the chosen title, URL, unit price, quantity and variant. `order_group_status_history` records every lifecycle and allocation decision with its actor; terminal states cannot move backward.

An item contribution amount is a reversible budget plan, not a payment or ledger settlement. Available planning capacity is derived from confirmed `funds_ledger_entries` minus allocations in active groups under serializable isolation. Cancelling a group clears its plans. Only a later authorized provider/merchant payment stage may append an `ORDER_PAYMENT` movement; Stage 15 does not mislabel a parent checklist as a financial settlement.

## Private media and memory invariants

`202608130010_memories_and_second_hand` separates proposals, messages/media, thank-you workflow and selected memory-book items. Second-hand management tokens are stored only as keyed hashes, expire, and cannot bypass the gift's `NEW_ONLY` policy. Accepting an offer conditionally claims inventory under serializable isolation.

Media assets retain exact MIME, size, SHA-256 checksum, scan/transcode state, retention deadline and private storage key. Database approval never makes an unscanned object public: signed download also checks clean object metadata. Deletion is soft in MySQL before best-effort object deletion so an unavailable storage provider cannot leave a visible association.

`approved_for_memory`, approver and timestamp make message consent explicit. A memory item additionally records the approving parent and has a unique `(book, source type, source ID)` constraint. Source membership and approval are revalidated when adding it. Thank-you draft approval and card creation timestamps are separate from `thanked_at`; saving a changed draft clears approval, and no database state represents an automatic send.

## Compliance and risk invariants

`202608130011_compliance_and_risk` adds purpose/version-specific consent evidence, scored manual risk reviews, an incident register and a processor register. Risk rows contain structured bounded signals rather than raw request bodies or banking data. Sensitive moderation and risk decisions append `admin_audit_logs` in the same transaction as the state change, with actor, request ID, mandatory reason and before/after state. Audit rows are never updated or deleted by application workflows.

Suspension sets `users.suspended_at` and revokes active sessions. Reports remain separate from risk reviews: a user report is evidence to triage, while a risk row records why manual review was requested and its resolution. `security_incidents` and `data_processors` are operational registers, not claims that an external incident process or processor contract has been approved.

## Product analytics invariants

`202608130012_product_analytics` stores consented allowlisted events separately from operational and financial truth. `subject_hash` and `session_hash` are keyed SHA-256 pseudonyms; raw visitor/session UUIDs are never columns. Event/time and subject/time indexes support bounded staff aggregation. Properties are short primitive JSON values only. Business KPIs continue to come from their authoritative tables, so analytics deletion cannot change payments, reservations, rewards or entitlements.

## Partner and family-lifecycle invariants

`202608130013_partners_and_family_lifecycle` adds stable unique partner slugs and campaign codes, pseudonymous expiring attributions, an append-only campaign ledger, list closure, source/future-list links, and lifecycle events. Existing partner/campaign rows receive deterministic backfill identifiers but remain unpublished unless an administrator supplies a contract and activates them.

An attribution token is stored only as a keyed SHA-256 HMAC. `list_id` is unique, so a list can have at most one partner attribution. Campaign ledger idempotency keys are globally unique, values are positive `BIGINT` minor units at the API boundary, and cost/reward writes execute serializably against the campaign budget. Revenue, benefit cost, and reward cost are distinct kinds and are never inferred from a landing-page visit.

`lists.closed_at` blocks new reservations independently of archival status. `source_list_id` links a future family event without ownership of copied domain data, and `list_lifecycle_events` preserves actor/action/time history. Future-list creation copies presentation columns only; relational gift, reservation, contribution, message, memory, and visitor records remain attached to the source.

## Backups and restore test

- Enable provider-managed encrypted daily full backups and point-in-time recovery/binlog retention for at least 14 days.
- Before every destructive or high-risk migration, take and label an on-demand snapshot.
- Export a portable encrypted backup periodically with `mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF mila > A_REMPLIR.sql` from a protected runner.
- Quarterly, restore the latest backup into an isolated database, run `prisma migrate status`, compare critical table counts, exercise login/list/reservation flows, then destroy the isolated copy.
- Record restore duration, recovery point, checksums, operator, and anomalies in the operations log.

Actual provisioning, allowlisting, credentials, backup policy activation, and restore evidence are `BLOCKED_EXTERNAL` until the database operator supplies access.

## Supabase migration

The legacy PostgreSQL migrations remain under `supabase/migrations` as migration evidence. Export auth users and public tables from a frozen source into encrypted, access-controlled files; do not use production personal data for local tests. The migration runbook is:

1. restore a recent Supabase backup into an isolated source;
2. normalize auth identities, profiles, registries/lists, items/gifts and dependent rows into the new IDs and enums;
3. import parent tables before children in a single maintenance window;
4. hash new opaque session and guest-management tokens instead of copying active Supabase sessions;
5. compare per-table counts, sampled monetary totals and foreign-key orphans;
6. rehearse twice with anonymized data, record timings, then perform a final delta while writes are disabled.

The exact source data shape and a sanitized export are `BLOCKED_EXTERNAL`; therefore no code guesses transformations for unknown production columns. `scripts/supabase-migration-audit.mjs` produces the deterministic source/target inventory and verification checklist used to implement and approve the final mapping once that export is supplied.
