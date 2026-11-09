# Service responsibility & data ownership — Hybrid architecture (D1 = Option C)

Status: **authoritative** as of 2026-11-08. Every claim below was checked against the
running Supabase project, the source tree, or the Vercel project — not inferred.

Decision D1 is **Option C — Hybrid**:

- **Supabase Auth** is the single source of truth for authentication and sessions.
- **Supabase PostgreSQL** is the primary source of truth for application data.
- **NestJS** is the centralized business-logic / API layer.
- **Next.js** calls NestJS for business operations.
- No duplicate auth system. No separate competing database.

---

## 1. Ownership matrix

| Service | Owns (write authority) | Reads | Must never own |
|---|---|---|---|
| **Supabase Auth** (`auth` schema) | Credentials, password hashes, sessions, refresh tokens, MFA factors, email verification, identities | — | Application/business data |
| **Supabase PostgreSQL** (`public` schema) | All persistent application rows | `auth.users` via FK only | Credential verification logic |
| **NestJS API** (`apps/api`) | Business rules: entitlements, playback authorization, catalog rules, server selection, billing state machine, audit logs | Supabase Auth (verify token), Supabase PG (via Prisma) | Password hashing for end users, session issuance |
| **Next.js web** (`apps/web`) | Presentation, client-side player state, localStorage preferences | NestJS for business ops; Supabase Auth for sign-in/session | Authorization decisions, provider credentials, business truth |
| **Next.js admin** (`apps/admin`) | Admin presentation only | NestJS `/admin/*` via same-origin proxy | Its own user store or role logic |
| **Xtream provider** (external) | The user's own IPTV catalog and streams | — | Anything in our database |

**Rule of thumb:** the browser may *ask*, NestJS *decides*, Supabase *remembers*,
Supabase Auth *authenticates*.

---

## 2. Verified current state (2026-11-08)

Checked directly against project `syscezbzxgnfxftfzaqa` (`cloud-play-iraq`,
eu-central-1, PostgreSQL 17.11.0.011, `ACTIVE_HEALTHY`):

| Fact | Verified value | How verified |
|---|---|---|
| Tables in `public` | **2** — `cloudplay_favorites`, `cloudplay_progress` | `information_schema.tables` |
| Prisma tables present (`AppUser`, `Tenant`, `Subscription`, `XtreamServer`, …) | **0** | `information_schema.tables` |
| Applied Supabase migrations | **1** — `20261105015202 cloudplay_free_account_sync` | `list_migrations` |
| `auth.users` rows | **1** | `select count(*)` |
| `cloudplay_favorites` / `cloudplay_progress` rows | **0 / 0** | `select count(*)` |
| Row-level security | Enabled on both tables; 8 owner-scoped policies (`auth.uid() = user_id`) | migration + policy probes |
| RLS behaviour | owner **1** row · other user **0** · anon **0** | `BEGIN … SET LOCAL ROLE … ROLLBACK` probes |

### 2.1 The most important consequence

**The 32-model Prisma schema has never been applied to Supabase, and there are
zero NestJS user accounts.** The four Prisma migrations in
`apps/api/prisma/migrations/` exist as files only.

This makes the auth consolidation far safer than the audit assumed:

- There is **no NestJS account, subscription, or permission data to migrate or lose**.
- The only real account is the single **Supabase Auth** user, which is already
  the designated source of truth and is not touched by this work.
- Consolidating therefore breaks **no existing account**.

It also means the NestJS API is **not yet connected to any database**. Applying
those migrations creates 32 new tables in the production project; that is a
production schema change and is **held for explicit approval** (see §5).

---

## 3. The auth duplication, precisely

Two independent end-user auth implementations exist in the tree:

| | Supabase Auth (in use) | NestJS identity (never deployed) |
|---|---|---|
| Entry points | `apps/web/src/lib/supabase.ts`, `AccountProvider.tsx` | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Credential store | `auth.users` | `AppUser.passwordHash` (argon2id) |
| Token issuer | Supabase Auth | `JwtService` HS256 with `JWT_ACCESS_SECRET` |
| Token TTL | `jwt_exp = 3600` | `JWT_ACCESS_TTL` 900 / refresh 604800 |
| Verification | `supabase.auth.getUser(token)` | `jwtService.verifyAsync` + `AppUser` lookup |
| Real accounts | **1** | **0** |

**Resolution (no account breakage):** Supabase Auth stays the only issuer and
verifier of end-user identity. NestJS stops being a *credential authority* for
end users and becomes a *resource server* that validates Supabase tokens and
maps the verified Supabase user id to its own business rows. Because NestJS has
zero users, nothing needs migrating and no password is re-hashed or discarded.

`POST /auth/admin/login` (staff/admin, argon2 + `StaffUser`) is a **separate
concern** from end-user auth and is retained for now: the admin app already
depends on it and it guards a different principal class. It is recorded here as
a known second credential path to consolidate in a later, approved step — it is
**not** silently left undocumented.

### 3.1 Existing verification pattern to reuse

`apps/web/src/server/xtream-access.ts` already does the right thing and is the
reference implementation for the NestJS side:

1. Fail closed if Supabase is unconfigured (`ACCOUNTS_OFF`) or the allow-list is
   empty (`OWNER_NOT_SET`).
2. Extract a bearer token; reject malformed/oversized tokens early.
3. **Ask Supabase Auth to verify it** (`auth.getUser(token)`) — never trust the
   decoded client payload.
4. Apply the allow-list; map failures to 401/403/503 without leaking which
   emails exist.

---

## 4. Data-flow contracts

### Sign-in (unchanged, Supabase-only)
```
Browser → Supabase Auth (password / session refresh)
        ← access_token (JWT, 3600s) + refresh_token
```
NestJS is not involved and never sees a password.

### Business operation (target)
```
Browser → Next.js (same-origin /api route)
        → NestJS  Authorization: Bearer <Supabase access token>
            → Supabase Auth: verify token          (identity)
            → Supabase PG via Prisma: read/write   (business data)
        ← decision + data, no provider secrets
```
The browser never calls NestJS directly, so the API origin stays server-side and
no CORS surface is exposed to arbitrary sites. `apps/admin/lib/backend.ts`
already implements exactly this shape (same-origin proxy, bearer required,
origin validation, `redirect: 'error'`, 10s timeout, `no-store`) and is the model
for the web bridge.

### Free-account library (unchanged)
`apps/web/src/lib/library-sync.ts` writes favorites/progress directly to Supabase
under RLS. This is **not** a competing database — it is the same Supabase
PostgreSQL, and every row is owner-scoped by `auth.uid() = user_id`. It remains
valid under Option C. Moving these writes behind NestJS is optional future work,
not a correctness requirement.

---

## 5. Held for explicit approval (not executed)

| Action | Why it needs approval | Reversible? |
|---|---|---|
| Apply the 4 Prisma migrations to Supabase (creates 32 tables) | Production schema change | Additive, but still production DDL |
| Point NestJS `DATABASE_URL` at Supabase and deploy the API | New production infrastructure | Yes, but user-facing |
| Disable/remove NestJS end-user `/auth/register` + `/auth/login` | Auth surface change | Yes; zero accounts affected |
| Consolidate admin/staff auth into Supabase | Auth infra change | Requires a migration plan |
| Supabase auth hardening that affects sign-in (SMTP, `mailer_autoconfirm`, min length, captcha) | Can break sign-in/recovery for the existing account | Config-reversible, user-visible |

Nothing in this list has been applied. No destructive migration, no data
deletion, and no auth replacement has been performed.

---

## 6. Credentials and secret ownership

| Secret | Owner | Location | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Vercel (public by design) | Safe in browser **only because** RLS is enabled and verified |
| `XTREAM_PASSWORD` | **Provider-issued** | Vercel, now `sensitive` | Cannot be rotated by us; requires provider access |
| `XTREAM_PROXY_SECRET` | Ours | Vercel, now `sensitive` | HMAC key for stream tokens |
| `XTREAM_OWNER_EMAILS` | Ours | Vercel | Allow-list; empty = deny everyone |
| `JWT_ACCESS_SECRET` | NestJS | API host (not yet deployed) | Staff/admin tokens only after consolidation |

Both `XTREAM_PASSWORD` and `XTREAM_PROXY_SECRET` were converted from
`readable-secret` to **`sensitive`** (write-only) on 2026-11-08. Values were never
decrypted, printed, or logged. See `docs/BACKUP_AND_ROLLBACK.md` for the rotation
and rollback procedure.

### Known finding — signing-key fallback
`apps/web/src/server/xtream-private.ts:71` uses
`process.env.XTREAM_PROXY_SECRET || password`, i.e. when the proxy secret is
unset it falls back to the **provider password** as the HMAC key.
`apps/web/src/server/playlist-token.ts:44` also falls back to
`XTREAM_PROXY_SECRET`. Both token TTLs are **6 hours**, which bounds the blast
radius of a rotation. Recommendation: make `XTREAM_PROXY_SECRET` mandatory and
fail closed rather than reusing a provider credential as a signing key.

---

## 7. Related documents

- `docs/BACKUP_AND_ROLLBACK.md` — backup, restore, rotation and rollback procedures.
- `FEATURE_STATUS.md` — per-feature status and evidence.
- `docs/architecture.md` — the original phase-1 design (historical; superseded by
  this document wherever the two disagree).
