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
