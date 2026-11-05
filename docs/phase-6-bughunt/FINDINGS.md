# Phase 6 — Bug Hunt & Zero-Defect Execution: Findings Register

Repo: `aldaeny/Cloud-play` · branch `arena/8a2cda24-cloud-play` · base `main@bae742a`
Date: 2026-11-05 · Method: full-repo static audit + TypeScript/lint/build + runnable unit tests.

## Diagnostic baseline (before fixes)

| Check | Result |
|---|---|
| Web `tsc --noEmit` | PASS |
| Web `next build` | PASS (16 pages) |
| Web `eslint .` | **FAIL — 1 error**, 4 warnings |
| Admin `tsc --noEmit` | PASS |
| Admin `next build` | PASS (3 pages + 3 API routes) |
| API `tsc --noEmit` | BLOCKED — Prisma client types not generated (see Env limits) |
| API `jest` | 27 pass / 9 fail — all 9 failures are Prisma-engine/type environment issues |
| Security anti-pattern scan (web/admin) | clean (no `eval`/`innerHTML`/`dangerouslySetInnerHTML`/plaintext-http) |

## Confirmed defects

### P1 — Expired subscriptions still grant streaming access
- **File / fn:** `apps/api/src/modules/entitlement/entitlement.service.ts` → `check()`
- **Cause:** subscription query filters `status:'ACTIVE'` + `plan.active` but **not** `currentPeriodEnd > now`. A subscription whose paid period ended (but whose row was never flipped to EXPIRED) keeps `allowed:true`.
- **Proof of inconsistency:** `billing.service.ts#getCurrentSubscription` *does* filter `currentPeriodEnd:{gt:new Date()}`.
- **Impact:** revenue loss / unauthorized streaming after expiry.
- **Fix:** add `currentPeriodEnd: { gt: now }` to the entitlement subscription query. Add a regression test asserting the filter.

### P2 — Device limit counts revoked devices
- **File / fn:** `entitlement.service.ts` → `check()` device count.
- **Cause:** `device.count({ where:{ userId } })` includes devices with `revokedAt != null`.
- **Impact:** a user who revoked old devices is still blocked by `DEVICE_LIMIT` when adding a new one.
- **Fix:** add `revokedAt: null`. Add a regression test.

### P2 — Admin user-status update accepts arbitrary strings
- **File / fn:** `apps/api/src/modules/admin/admin.service.ts` → `updateUserStatus()`; controller `admin.controller.ts` `@Body('status')` has no DTO/validation.
- **Cause:** `AppUser.status` is a free `String`; login requires `status==='active'`. Any typo/invalid value silently locks the account out (or leaves it in an undefined state) with no 400.
- **Impact:** admin can accidentally/intentionally set an invalid status → broken login, no validation error.
- **Fix:** validate against the allowlist used in code/tests (`active`, `suspended`, `disabled`); throw `BadRequestException` otherwise.

### P2 — Web lint error: setState synchronously in effect
- **File / fn:** `apps/web/src/components/settings/SettingsCards.tsx:57` → `useEffect`.
- **Cause:** `setPrefs(readPrefs())` in the effect body trips `react-hooks/set-state-in-effect` (fails `npm run lint`).
- **Fix:** migrate to `useSyncExternalStore` with a cached snapshot in `lib/preferences.ts` (hydration-safe; `readPrefs()` returns a fresh object so a stable cached snapshot is required).

### P3 — Duplicate staff email returns 404 instead of 409
- **File / fn:** `admin.service.ts` → `createStaffUser()`.
- **Cause:** `throw new NotFoundException('Email already exists')` — wrong HTTP semantics.
- **Fix:** `ConflictException` (409).

### P3 — Unused eslint-disable directive
- **File / fn:** `apps/web/src/components/motion/PageTransition.tsx:137`.
- **Cause:** `// eslint-disable-next-line react-hooks/exhaustive-deps` reports as unused.
- **Fix:** remove the directive.

### P3 — `<title>` rendered with a children array (hydration warning on every section page)
- **File / fn:** `apps/web/src/components/layout/SectionLayout.tsx:59`.
- **Cause:** `<title>{title[language]} | Cloud Play Iraq</title>` produces a 2-element children array; React warns "title element received an array… hydration will likely fail" on every SSR section page.
- **Fix:** single template-literal child: `<title>{`${title[language]} | Cloud Play Iraq`}</title>`.
- **Note:** verified production emits **zero** raw console/page errors; the dev-only `_clientMiddlewareManifest` MIME + `/_next/hmr` WebSocket messages are Next.js dev artifacts, not app defects.

## Hardening observations (documented; not changed to avoid auth-contract breaks)
- **Login timing side-channel** (`identity.service.ts#login/loginWithPhone`): missing user returns before `argon2.verify`, enabling user-enumeration by timing. Recommend a constant-time dummy verify.
- **Refresh tokens are stateless & not rotated/revoked** (`identity.service.ts#refresh`, `logout` throws by design). Recommend a token-family/store-backed revocation before GA.
- **`updateIdentity` changes email/password without re-auth** (no current-password check). Recommend requiring current password for sensitive changes.

## Environment limitations (NOT code defects)
- **Prisma engine download blocked** (`binaries.prisma.sh` not allowlisted; no cached schema/query engine; `@prisma/internals` absent). Blocks `prisma generate`, hence API `tsc`/`build` and the 9 jest suites that import `@prisma/client` model types or instantiate a real client. Mocked suites run normally.
- **Real HLS playback unverifiable**: egress blocked + `permittedHls` rejects localhost/IP/non-https.
- `lodash@4.18.1` override verified **legitimate** (registry latest, repo `lodash/lodash`) — not a supply-chain issue.

## Warnings left as-is (intentional)
- 3× `@next/next/no-img-element` (external poster/logo URLs; `next/image` would require remote-pattern config). Cosmetic/perf only.
