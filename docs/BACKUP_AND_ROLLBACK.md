# Backup, restore, credential rotation & rollback

Written 2026-11-08. Every "current state" claim below was verified against the
live Supabase project, the Vercel project, or the source tree.

> **Approval gate.** No destructive migration, no production data deletion, and
> no production deployment may be performed without explicit approval. This
> document is a procedure, not an authorization to run it.

---

## 1. What actually needs protecting today

Verified state of Supabase project `syscezbzxgnfxftfzaqa` (`cloud-play-iraq`,
eu-central-1, PostgreSQL 17.11.0.011, `ACTIVE_HEALTHY`):

| Asset | Rows | Criticality |
|---|---|---|
| `auth.users` | **1** | **Highest** — the only real account; losing it loses access |
| `public.cloudplay_favorites` | 0 | Low today, grows with use |
| `public.cloudplay_progress` | 0 | Low today, grows with use |
| Prisma business tables (`AppUser`, `Subscription`, …) | **do not exist** | Not yet applied — nothing to back up |

**Backup availability — honest status:** the Supabase connector exposes **no
backup, snapshot, or point-in-time-recovery tool**. Automated backups/PITR are a
paid-plan feature and this project is on a zero-budget footing, so **no managed
backup has been verified to exist**. Treat backups as **NOT VERIFIED / operator
action required** until the steps below are actually run and the output file is
confirmed. Do not assume Supabase is silently protecting this data.

The schema itself is fully reproducible from version control:
`supabase/migrations/20261105000000_cloudplay_free_account_sync.sql` (applied) and
`apps/api/prisma/migrations/*` (not applied).

---

## 2. Logical backup (operator runs this)

Run from a trusted machine with PostgreSQL 17 client tools. Never paste the
connection string into chat, a ticket, or a commit. Read it from the Supabase
dashboard → **Project Settings → Database → Connection string**, and prefer the
**session** connection (port 5432) for dumps.

```bash
# Put the URI in your shell only; do not echo it.
read -rs SUPABASE_DB_URL && export SUPABASE_DB_URL

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="cloudplay-backup-$STAMP"
mkdir -p "$OUT"

# 1) Application data + schema (custom format, compressible, selective restore)
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --file="$OUT/public.dump"

# 2) Auth schema — contains the account. Handle as a SECRET.
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=auth --file="$OUT/auth.dump"

# 3) Human-readable safety copy of the two app tables
pg_dump "$SUPABASE_DB_URL" --format=plain --data-only --inserts \
  --table=public.cloudplay_favorites --table=public.cloudplay_progress \
  --file="$OUT/library-data.sql"

# 4) Verify the archives are readable BEFORE trusting them
pg_restore --list "$OUT/public.dump" > "$OUT/public.list"
pg_restore --list "$OUT/auth.dump"   > "$OUT/auth.list"

# 5) Encrypt at rest, then remove plaintext
tar -czf "$OUT.tar.gz" "$OUT"
age -r <your-age-public-key> -o "$OUT.tar.gz.age" "$OUT.tar.gz"   # or gpg -c
shred -u "$OUT"/auth.dump "$OUT"/public.dump "$OUT"/library-data.sql 2>/dev/null
rm -rf "$OUT" "$OUT.tar.gz"

unset SUPABASE_DB_URL
```

**Acceptance check:** `pg_restore --list` must succeed on both dumps and list the
expected tables. A dump you have not listed is not a backup.

**Handling rules**
- `auth.dump` contains password hashes and session tokens → treat as a secret.
  Encrypt, store off-platform (not in Git, not in the repo, not in Vercel).
- Keep at least two generations. Never store the only copy on the same host as
  the database.
- Record the SHA-256 of the encrypted archive so corruption is detectable:
  `sha256sum "$OUT.tar.gz.age"`.

### Quick row-count snapshot (safe, read-only)
Useful immediately before/after any change:

```sql
select
  (select count(*) from auth.users)                as auth_users,
  (select count(*) from public.cloudplay_favorites) as favorites,
  (select count(*) from public.cloudplay_progress)  as progress;
```
Baseline on 2026-11-08: **1 / 0 / 0**.

---

## 3. Restore procedure

**Restore into a scratch database first. Never restore over production as a
first step.**

```bash
# Verify the archive decrypts and is intact
sha256sum -c backup.sha256
age -d -i key.txt "$OUT.tar.gz.age" | tar -xz

# Inspect what would be restored
pg_restore --list "$OUT/public.dump"

# Restore app data into a SCRATCH database
pg_restore --no-owner --no-privileges --dbname="$SCRATCH_DB_URL" "$OUT/public.dump"
```

Then compare row counts and a sample of rows against expectations. Only after
the scratch restore is verified should a production restore be proposed — and
that requires explicit approval, because it overwrites data.

**Auth restore caution:** restoring `auth` into a live project can invalidate
existing sessions and conflict with `auth.users` primary keys. Prefer
Supabase's own user-export/import or dashboard support path for account
recovery. Treat a full `auth` restore as a last resort requiring approval.

---

## 4. Migration safety procedure

Before **any** schema change:

1. **Backup** — complete §2 and verify with `pg_restore --list`.
2. **Inspect** — read the exact SQL. For Prisma:
   `cd apps/api && node_modules/.bin/prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
   (use the local binary; bare `npx prisma` resolves to a bogus 8.0.0-rc).
3. **Identify blast radius** — list affected tables, foreign keys, and indexes.
   Note that `cloudplay_favorites.user_id` and `cloudplay_progress.user_id` both
   reference `auth.users(id) ON DELETE CASCADE`: deleting a user deletes their
   library rows.
4. **Prepare rollback** — write the inverse SQL *before* applying, and test it on
   a scratch copy.
5. **Get approval** for anything destructive or production-affecting.
6. **Apply inside a transaction** where possible, then re-run the §2 row-count
   snapshot and compare to baseline.

### Pending, NOT applied
The four Prisma migrations (`202611010001_initial`, `202611010002_media_owner`,
`202611010003_unique_movie_progress`, `20261103010000_add_xtream_servers`) would
create **32 tables** in the production project. They are additive, but this is
still production DDL and is **held for approval**. Rollback for a fresh apply is
`drop table` of exactly the created tables in reverse FK order — safe **only**
because they are currently empty and nonexistent. Once real data lands in them,
that is no longer a safe rollback and a dump-based rollback is required.

---

## 5. Application rollback (Vercel)

| Item | Value |
|---|---|
| Project | `prj_zxlqaeLb1EvuMDFcnHHvRAelbHad` |
| Team | `team_nmqPC9TkSiA2rxnHqz6cVADh` |
| Current production | `dpl_HZ3mhmteSdK2BX5QtgdD6R5zTNcA` — READY / PROMOTED, sha `76df97e` |
| Known-good rollback target | `dpl_9iVRzDSPtJBpyTYF6rJLM5PmefTa` |
| Public alias | `cloud-play-iraq.vercel.app` |

Rollback is a **promotion of an existing deployment**, not a rebuild, so it is
fast and does not depend on the build network:

1. Confirm the target deployment is `READY` and note its commit.
2. Promote it (dashboard → Deployments → ⋯ → *Promote to Production*, or the
   Vercel connector's promote tool). **Requires approval.**
3. Verify after promoting: load `/`, `/live`, `/movies`, `/tv-sources`, and
   confirm `/api/xtream/session` still fails closed
   (`{"owner":false,...,"reason":"SIGN_IN_REQUIRED"}`).
4. Append `?v=<timestamp>` when verifying to bypass the edge cache.

**Do not** roll back the database and the application independently unless the
schema change was purely additive; a newer app against an older schema (or vice
versa) can fail at runtime.

---

## 6. Credential rotation

### 6.1 Already done — type hardening (2026-11-08)
Both Vercel env vars were converted from `readable-secret` to **`sensitive`**
(write-only):

| Variable | Env id | Result |
|---|---|---|
| `XTREAM_PROXY_SECRET` | `gl4w0jHjai3ZztQp` | `type: sensitive`, `visibility: secret` |
| `XTREAM_PASSWORD` | `PkjUw4XrS0uUvDg6` | `type: sensitive`, `visibility: secret` |

Values were **never decrypted, printed, or logged**. This removes the read-back
exposure but **does not rotate the values** — a secret that was already readable
must still be considered potentially compromised.

> **Operator action:** because sensitive values cannot be read back, re-enter
> both values in the Vercel dashboard to be certain the type-only change
> preserved them. Worst case if a value was lost is **fail-closed** (private
> player refuses to serve), not an exposure.

### 6.2 `XTREAM_PROXY_SECRET` — ours, rotate freely
1. Generate a new value **locally**, never in chat:
   `openssl rand -base64 48`
2. Paste it into Vercel → Settings → Environment Variables (keep type
   `sensitive`). Do not send it through any tool that logs arguments.
3. Redeploy so the new value takes effect.
4. **Blast radius:** existing stream/playlist tokens are HMAC-signed and have a
   **6-hour TTL** (`xtream-token.ts:24`, `playlist-token.ts:23`). After rotation,
   old tokens fail verification (`403 BAD_TOKEN`) until clients re-request.
   Expect brief playback interruption; no data loss.
5. Verify: an old token returns `403`, a freshly issued token plays.

### 6.3 `XTREAM_PASSWORD` — provider-issued, **BLOCKED**
We cannot rotate this: it is issued by the IPTV provider. Rotation requires the
provider's panel/support. Additionally the origin `redchicks.xyz` is currently
**unreachable** (521 on 2053/443, 500 on 2052), so even a legitimate rotation
could not be verified end-to-end.

Status: **BLOCKED — provider access required.** Recorded as a security finding,
not silently deferred. Do not probe the provider with real credentials.

### 6.4 Related code finding
`apps/web/src/server/xtream-private.ts:71` signs with
`XTREAM_PROXY_SECRET || password` — if the proxy secret is unset it reuses the
**provider password** as the HMAC key. Make the proxy secret mandatory and fail
closed instead. Until then, rotating `XTREAM_PROXY_SECRET` also changes which
key is in use, so set it explicitly.

---

## 7. Pre-change checklist

- [ ] Logical backup taken **and** `pg_restore --list` verified
- [ ] Encrypted copy stored off-platform; SHA-256 recorded
- [ ] Row-count baseline captured (currently 1 / 0 / 0)
- [ ] Exact SQL inspected; affected tables/FKs/indexes listed
- [ ] Inverse/rollback SQL written and tested on scratch
- [ ] Explicit approval obtained for destructive/production steps
- [ ] Known-good Vercel deployment id noted for app rollback
- [ ] Post-change verification plan written (which URLs, which API responses)

## Phase 2 catalog staging migration

`20261108010000_xtream_catalog_snapshot` adds a backend-only staging table with RLS and no browser policy. It does not alter existing content/user tables. The isolated PG17 runner applies and rolls back/reapplies it and verifies provider rows survive. Rollback intentionally loses imported staging snapshots/history: export/backup that table and obtain approval before running `rollback.sql` anywhere non-disposable. Production default grants, role bypass rights and backups still need review. No production migration or rollback was run.
