# Local self-hosted package (zero cloud spending)

Use customer-owned/local hardware and Docker Compose v2, Node22+, Git and OpenSSL.
No production deployment is authorized. Docker Desktop licensing is the operator's
responsibility; Linux Docker Engine/Compose are free alternatives. Downloads,
disk, electricity and existing CI allowance are not a promise of unlimited free service.

## Configuration and first installation

In a clean checkout, **without an existing `.env`**, run:

```
node scripts/selfhost/init.mjs
```

This creates unique database/JWT/storage/Auth secrets, a tenant UUID and a local
TLS certificate under `.selfhost/tls/`. No password is printed. It never overwrites
an existing environment or certificate directory. Review `.env` locally; never
publish it or `docker compose config` output. Import **only cert.pem** into your
browser's trusted certificates manually. No TLS verification bypass is installed.
The local certificate lasts 365 days; renew it deliberately with a backup first.

Set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` >=16 characters
in your local shell, preferably through a hidden prompt/secret manager. Do not put
values in Git, command-line arguments, CI logs or chat. Then:

```
RELEASE=$(git rev-parse HEAD)
node scripts/selfhost/cli.mjs install cloudplay-local-demo "$RELEASE"
node scripts/selfhost/cli.mjs health cloudplay-local-demo "$RELEASE"
```

Services: viewer http://localhost:3001, administration http://localhost:3002,
API http://localhost:3000/health, local GoTrue identity authority
https://localhost:8443/auth/v1/health, SMTP capture http://localhost:8025.
All published ports bind loopback only. No public tunnel, DNS or cloud resource is
needed or authorized. GoTrue uses the same local PostgreSQL17 database and TLS
verification from API trusts only the generated certificate, not arbitrary hosts.
Mailpit captures email locally; it is **not internet email delivery**. Viewer Supabase
favorite/progress REST sync needs PostgREST and the corresponding RLS migration;
this package currently includes Auth, not the full Supabase platform/Studio/REST.
Do not claim cloud-library sync is verified for this package.

Migrations run in a dedicated tools image with real native Prisma CLI, not in the
pruned API runtime (which intentionally has no CLI/schema/dev dependencies).
Bootstrap is a separate single-use transaction: no demo titles, no fixed password,
no overwrite of existing accounts, and no elevation/reset of a populated install.
If installation fails after creating resources, **do not delete volumes to retry**.
Inspect local diagnostics, correct the configuration, use `migrate` if needed and
start the existing Compose services deliberately. Repeated install/bootstrap refuse
existing containers/volumes/data. Tools are local-DB-only and cannot take a cloud URL.

## Organization licenses

Local tools support manual non-financial Starter/Professional/Business licenses.
Set ORGANIZATION_TENANT_ID, ORGANIZATION_TIER, ORGANIZATION_STATUS (`active`,
`suspended`, `revoked`) and ORGANIZATION_EXPIRES_AT (future ISO date <=366 days for
activation) in your shell. Then:

```
node scripts/selfhost/cli.mjs organization-license cloudplay-local-demo "$RELEASE"
```

Only the local operator tools, not a tenant-admin request, can activate/renew or
change tier. Changes are audited in the same transaction. Expiry is checked on
reads and creates even if the stored status remains active. Existing installations
retain `licenseEnforced=false` until deliberately enrolled. This preserves existing
behavior but means unenrolled tenants are **not commercially license-enforced**.

| Organization tier | Users | Staff | Combined servers | VOD titles |
|---|---:|---:|---:|---:|
| Starter |20|2|1|100|
| Professional |100|5|5|1000|
| Business |1000|20|20|10000|

These are policy limits, **not tested hardware capacity**. PostgreSQL insert triggers
serialize quota allocation across replicas, including direct backend create paths;
quota failures roll back the write. Server quota covers Xtream + nondeleted external
servers. User/staff quotas count retained accounts, not just active ones. Titles mean
business `Title` rows, not every provider-snapshot item. Storage byte/egress quotas,
atomic device limits and billing automation are not implemented. License fields
are never accepted from browser/admin branding payloads. DB owner/admin access is
operator authority and must not be issued to tenants.

## Health and maintenance

```
node scripts/selfhost/cli.mjs migrate cloudplay-local-demo "$RELEASE"
node scripts/selfhost/cli.mjs health cloudplay-local-demo "$RELEASE"
```

Health checks include application/database, containers and TLS GoTrue health.
They do **not** prove Redis durability, real customer SMTP, trusted public Geo,
viewer decoding, capacity or business acceptance. Inspect logs locally without
sharing tokens/connection strings. No secrets are baked into API runtime images;
release image labels and tags identify the exact source SHA.

## Complete local DB + object snapshot

Stop all other operator writes/clients first. Do not run against production data.
Choose a **new** private directory outside Git (for example `.selfhost-backups/one`):

```
node scripts/selfhost/cli.mjs backup cloudplay-local-demo "$RELEASE" .selfhost-backups/one
```

The tool stops API, worker, viewer/admin and Auth ingress/writers, stops MinIO,
then creates a consistent PostgreSQL custom dump (including local GoTrue Auth), a
cold MinIO data archive, `.env`, TLS certificate/private key and SHA256 manifest.
Redis is deliberately not archived: durable media jobs are in PostgreSQL and can
be re-dispatched. Do not back up Redis as if it were the authoritative database.
The tool restarts services only after a complete snapshot. On failure writers stay
stopped for operator inspection. The archive is **secret, unencrypted at rest**;
permissions are restricted but disk encryption/offline protected copies remain
operator duties. SHA256 detects accidental corruption, not a maliciously rewritten
archive and manifest. Restore only trusted operator-generated archives.

## Restore and safe rollback

Retain the exact release images. Restore to a **different, empty project**; never
restore over a running installation or delete an existing database. Stop the old
local stack to free loopback ports (preserving all volumes). Recover `.env` and TLS
files securely from the archive if needed; the tool never overwrites them itself.
It verifies they match before restoring. Then:

```
node scripts/selfhost/cli.mjs restore cloudplay-local-recovered "$RELEASE" .selfhost-backups/one
node scripts/selfhost/cli.mjs health cloudplay-local-recovered "$RELEASE"
```

Checksums, distinct project, absent containers/volumes, secret match and retained
image revision are required before writes. PostgreSQL restore fails on errors;
MinIO is restored while stopped. Existing targets and corrupt archives are refused.
Keep source resources intact until you validate restored accounts, tenant scope,
licenses, objects and playback. No automated cutover/DNS action is performed.
The `rollback` command intentionally rejects an in-place schema downgrade; safe
rollback is the same isolated restore procedure at the **old archive release**.
No schema down-migration or customer-data deletion is part of this package.

## Upgrade

Take and verify a fresh backup first. Obtain the new reviewed source on the working
branch through your normal protected process; do not change branch protections.
Set NEW_RELEASE to that exact checked-out HEAD, retain old images, review migrations:

```
node scripts/selfhost/cli.mjs upgrade cloudplay-local-demo "$NEW_RELEASE" .selfhost-backups/pre-upgrade
node scripts/selfhost/cli.mjs health cloudplay-local-demo "$NEW_RELEASE"
```

Builds must match source HEAD. Writers stop before migration. On failure do not
continue serving an ambiguous schema; use the pre-upgrade isolated restore. A
successful same-release migration is not proof every future upgrade is reversible.

## Evidence and exclusions

`node scripts/selfhost/runtime-test.mjs` is a disposable CI drill of the **shipped
CLI**: build/install/migrate/bootstrap/health, duplicate refusal, object write,
quiesced backup, separate-project restore, exact tenant/staff/branding/object
comparison, populated-target refusal, corrupt archive refusal and rollback safety.
It creates and deletes only its explicitly named synthetic fixture projects. Its
result must be read at the final tested HEAD; mere presence of this test is not a
PASS. Local Docker is unavailable in the agent sandbox; CI supplies runtime proof.

Public ingress, trustworthy Geo provenance, automated PostgREST/RLS installation,
production bootstrap/privilege hardening, full upgrade-to-a-different-release drill,
physical devices and customer-operated hardware remain separate acceptance gates.

## White label site binding

`PUBLIC_BRANDING_TENANT_ID` binds the public login/viewer brand to an operator-selected
site, never a browser-provided Host/query tenant. The initializer selects its generated
tenant. Administration uses its authenticated tenant settings. Both App Router and
Pages Router viewer shells load the safe public brand; home, login, settings and
movie headers/titles/colors use it. Local raster logo files must be installed under
`public/brand-assets/` in **both** viewer/admin releases. Approved custom-domain TLS
routing, opening artwork and every editorial/legal marketing phrase still require
operator-specific review; this is not an automated domain ownership service.

## Public storage distribution fallback

The legacy `minio/mc` Docker Hub repository denied anonymous pulls in CI. The
self-hosted overlay therefore builds **the same pinned community MinIO/MC releases**
from official GitHub binary assets, checking hardcoded SHA256 for amd64/arm64.
No registry credential or commercial plan is used. Source and license obligations
are upstream AGPLv3: https://github.com/minio/minio and https://github.com/minio/mc .
A source/license/legal review and Docker OS-image vulnerability scan remain release
gates; an npm audit does not cover these binaries. Only amd64 is exercised in CI;
arm64 checksum configuration is not physical-device/runtime proof. Other platforms
fail closed. Web/Admin/worker images use supported Node22, matching the tested matrix.
