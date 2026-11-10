# Backup and restore

## VERIFIED — disposable same-version cold backup

`npm run test:postgres --workspace aether-api` now cleanly stops a disposable PostgreSQL17cluster, recursively copies its data directory under an ephemeral test directory, restarts source, starts restored clone on a different loopback port and compares both provider catalogs/revisions, user existence, foreign keys, roles and35backend RLS flags. It verifies authenticated cannot SELECT provider credentials after restore. Clone and all copied data are deleted at test end. Native Node22/24 execute the same test in trusted CI. No production URL or data used.

This is a physical same-PG-major/architecture, clean-shutdown test, not an online logical dump or PITR rehearsal. Never copy a running database data directory this way. Test roles/data are fixtures, not managed platform identities.

## IMPLEMENTED BUT UNVERIFIED

Existing approved recovery guidance remains in BACKUP_AND_ROLLBACK.md. For production: request an authorized managed backup/PITR point, restore only to an isolated project, verify schema/migrations/row counts/RLS/grants/Auth linkage/storage objects, validate application and obtain cutover approval. No production restore/deletion/schema operation may be inferred from these tests. Database backup does not include object storage, CDN or SMTP config.

## BLOCKED

Actual managed production backup/PITR/storage recovery requires explicit authorization and isolated restore capacity. No paid project or integration was provisioned.
