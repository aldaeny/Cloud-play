# Regression baseline — what fails before my changes

Every suite below was run twice: once on the upstream commit `f7ba766`, once on
this branch. Identical results mean the failure is pre-existing and not caused
by the Live work. Nothing here is marked PASS unless it was observed passing.

## Pre-existing failures (identical on f7ba766 and on this branch)

| Suite | Result | Cause | Status |
|-------|--------|-------|--------|
| `apps/api` jest | 11 suites failed, 6 passed; 9 tests failed, 27 passed | `@prisma/client` has no generated client (`SupportTicket` etc. missing). `prisma generate` needs the engine from `binaries.prisma.sh`, which this sandbox cannot reach (TLS reset). | BLOCKED (environment) |
| `scripts/progress-security-smoke.js` | throws at import | same missing Prisma client | BLOCKED (environment) |
| `scripts/media-security-smoke.js` | throws at import | same missing Prisma client | BLOCKED (environment) |

The API is **not** part of the deployed target: the Vercel project deploys
`apps/web` only (Root Directory `apps/web`, framework nextjs). The Live pipeline
and its proxy live entirely in `apps/web`, so these blocked suites cannot mask a
Live regression — and the Live suites that do run are listed below.

## Passing suites on this branch (measured)

| Suite | Result |
|-------|--------|
| `scripts/live-parser-tests.js` | 54/54 |
| `scripts/live-proxy-tests.js` | 22/22 |
| `scripts/live-player-tests.js` | 18/18 |
| `scripts/live-acceptance.js` (live server) | 26/26 |
| `scripts/live-browser-test.js` (real Chromium) | 18/18 |
| `scripts/iraq-playlist-smoke.js` | PASS |
| `scripts/licensed-iptv-smoke.js` | PASS |
| `scripts/licensed-epg-smoke.js` | PASS |
| `scripts/firebase-catalog-smoke.js` | PASS |
| `scripts/dependency-override-smoke.js` | PASS |
| `apps/web` `next build` | success |

## How to unblock the Prisma suites

Run these where `binaries.prisma.sh` is reachable:

```bash
cd apps/api && npx prisma generate && npx jest
node scripts/progress-security-smoke.js
node scripts/media-security-smoke.js
```

They were not run to completion in this environment, so their state stays
BLOCKED rather than being reported as passing.
