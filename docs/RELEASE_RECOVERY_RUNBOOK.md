# Release recovery and isolated rehearsal runbook

This file is executable guidance, not permission to change production. No command here was executed against production in this task. Evidence uses only disposable synthetic databases. Never put backup archives, Auth rows, credentials, connection URLs, access tokens, recovery links or secret values in Git/CI artifacts/chat.

## 1. Rehearsals available now

```sh
# Real local disposable PG17: migrations, constraints, transactions, backend RLS,
# cold stopped-cluster copy to separate port, FK/role/RLS restoration,
# provider snapshot rollback/reapply and expiration-index rollback/reapply.
npm run test:postgres --workspace aether-api
# Trusted runner with actual query engine (no fallback):
npm run test:postgres:native --workspace aether-api
# Full isolated Auth/native DB/browser/load + logical restore in trusted CI:
gh workflow run native-prisma.yml --ref arena/d4593efb-cloud-play
```

Workflow `auth-recovery.yml` creates `postgres:17` container **auth-db** on loopback **5439**, disposable GoTrue and Mailpit. After the Auth test exits, `test-logical-restore.mjs` stops ONLY disposable GoTrue, archives the fixture PostgreSQL database with `pg_dump --format=custom`, checks `pg_restore --list`, restores with `--exit-on-error --single-transaction` into **cloudplay_restore_fixture**, compares public/auth row digests, indexes, FKs, RLS policies and grants, and tests an invalid FK write is rejected. It then removes the archive and separate database. No archive or row contents are uploaded; only sanitized JSON assertions. Invoke this script ONLY in that generated fixture workflow, not on an operator Docker host containing real workloads.

A clean physical copy is valid only after clean shutdown, with matching PostgreSQL major/platform. Never copy a live data directory. A same-cluster separate-database logical rehearsal is not independent-region disaster recovery or managed Supabase restoration. Database backup does not include storage objects, SMTP configuration, DNS, CDN or environment secrets.

## 2. Authorized managed database backup / restore

Prerequisites: named operator and incident owner, approved read scope, approved isolated empty restore project, supported PostgreSQL client version, encrypted external storage, verified access controls/retention, approved RPO/RTO and platform-specific Auth restore procedure. Do not create paid infrastructure without approval.

1. Record schema/migration versions and object inventory using approved read-only access. Historical production observations in `BACKUP_AND_ROLLBACK.md` are dated snapshots, NOT current certification.
2. Select approved managed backup/PITR point or consistent logical snapshot. Use the session/direct connection supported by the provider for backup, not transaction pooling. Keep credentials in a protected secret manager/`PGPASSFILE` and non-secret service configuration; do not pass a credential-bearing URI as a command-line argument. Disable shell tracing.
3. With approved service profiles already installed on a trusted operator host, use commands of this shape (profile names are operator-created prerequisites, not repository credentials):
   ```sh
   set -eu
   umask 077
   : "${PGSERVICEFILE:?protected operator service file required}"
   : "${PGPASSFILE:?protected operator password file required}"
   : "${BACKUP_DIR:?encrypted restricted destination required}"
   pg_dump --dbname='service=cloudplay_approved_backup' --format=custom --file="$BACKUP_DIR/platform.dump"
   pg_restore --list "$BACKUP_DIR/platform.dump" > "$BACKUP_DIR/archive.list"
   sha256sum "$BACKUP_DIR/platform.dump" > "$BACKUP_DIR/archive.sha256"
   ```
   This is NOT tested against managed Supabase. Provider-managed roles/extensions/Auth may need platform-specific handling. Do not blindly use `--clean`, `--create` or restore into production. Read/list/checksum alone is not proof of restoration.
4. Provision/approve the isolated target separately; explicitly verify project/host/database identity and network egress disabled. Restore under a role compatible with provider policies; use a reviewed restore list for managed schemas rather than overwriting platform internals. Stop if unsupported owner/role/extension/policy errors occur; never ignore restore errors.
5. Verify table/column/index/FK/migration versions, deterministic fixture counts/digests, RLS/grants under browser and service roles, Supabase identity linkage, subscription/rights integrity and object references. Use separate synthetic test identities; never authenticate as restored real users for tests.
6. Reconnect the isolated application with isolated encryption/signing settings and synthetic providers. Execute authorization, session, library, catalog and playback checks. Test storage restore separately. Record measured RPO/RTO and evidence without data.
7. No cutover until explicit human approval and a tested revert path. Retain encrypted archives off-repo and restore evidence independently; test corrupt/incomplete archive rejection before trusting retention.

## 3. Application rollback

1. Freeze release/source activation; identify incident scope and last independently verified immutable release SHA/artifact. Record active artifact SHA, schema level, configuration version and provider approvals without secrets.
2. In isolated staging, run previous application against a restored clone at the **current** schema version. An additive index normally does not require DB rollback. Verify both router families, Auth, sessions, API/RBAC and synthetic playback before any production rollback.
3. Use hosting's authorized rollback/promotion mechanism only with explicit production approval. Do not rewrite Git, switch this Arena branch, force push, merge or delete deployments. Existing automatic Git previews are not production promotion.
4. Revoke affected sessions through the authoritative provider where warranted; monitor error rates, auth denials, pool use and playback recovery. A browser buffer may still contain previously authorized media.
5. Schema rollback scripts are reviewed/rehearsed on disposable data only. Never execute them on populated production tables merely to match an older binary. Prefer forward-compatible application rollback or reviewed forward repair.

VERIFIED local scope: cold DB restore and migration rollback/reapply tests. BLOCKED target scope: actual hosted application rollback exercise, because protected staging access/isolated target and approved previous artifact pairing are absent.

## 4. Environment recovery and secret rotation

- Maintain a versioned **key-name/type/target/owner** inventory outside public logs; values belong only in the deployment secret manager. `.env.example` is documentation, not recoverable secret storage.
- Restore configuration into isolated staging first. Validate exact HTTPS origins, Supabase end-user authority, signed Geo trust boundary, encryption key format and explicit DB connection_limit/pool_timeout budget. Never copy production provider credentials into fixture jobs.
- Rotation requires approval and a map of consumers/ciphertext dependencies. In particular, replacing `XTREAM_ENCRYPTION_KEY` without a reviewed decrypt/re-encrypt or key-version migration can render stored provider ciphertext unreadable. Do not rotate it blindly.
- Rotate compromised Auth/admin/access keys using the authority's supported flow; account for session revocation and overlapping key windows only when explicitly supported. Do not create a second identity authority. Rotate Geo bridge keys on both trusted issuer/backend together and fail closed during mismatch.
- Re-run no-secret asset/log scans, Auth refresh/logout, CSRF/origin, Geo and encrypted-provider fixture tests. Keep previous key material only in approved encrypted escrow for approved rollback duration; never in Git.

## 5. Incident recovery acceptance

Require named owner, target identity, approved actions, backups tested, explicit rollback point, observability/alert routing, post-recovery account/rights/catalog validation, no unauthorized source activation and an incident record with sanitized evidence. Actual production restore/rotation/cutover remains BLOCKED until authorized prerequisites are supplied; unit tests cannot authorize it.
