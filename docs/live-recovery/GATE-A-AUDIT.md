# GATE A — Architecture Audit (baseline)

Phase start (UTC): see git commit cdbd7a4 timestamp. All timestamps below are real
and read from the system clock, not estimated.

## A1. Why the Live section shows "Licensed-Only"

The Live route `apps/web/pages/[section].tsx` (section === 'live') renders
`LicensedTv`, which calls `GET /api/iptv/licensed`. That handler calls
`readLicensedPlaylist()`, which throws `NOT_CONFIGURED` unless the operator sets
BOTH `CLOUDPLAY_IPTV_RIGHTS_CONFIRMED=true` AND a playlist
(`CLOUDPLAY_IPTV_M3U` | `CLOUDPLAY_IPTV_FILE`). The catch-all maps any failure to
HTTP 503 `{error:'LICENSED_SOURCE_UNAVAILABLE'}` and the UI renders
"No licensed list is available. The operator must configure a rights-reviewed source."

## A2. Every blocking layer (all confirmed by grep, file:line)

| # | Layer | File | Mechanism | Effect |
|---|-------|------|-----------|--------|
| 1 | Global rights switch | `apps/web/src/server/legacy-source-policy.ts` | `legacySourcesAllowed() { return false; }` — hardcoded | Kills 6 of 8 IPTV routes unconditionally |
| 2 | Route guards | `pages/api/iptv/{iraq,arab,world,firebase}.ts`, `src/server/xtream-handler.ts` (guards `channels.ts` + `categories.ts`) | `if (!legacySourcesAllowed()) return 503 SOURCE_NOT_APPROVED` | Public playlists never reachable |
| 3 | Rights acknowledgement | `src/server/licensed-iptv.ts:44` | `CLOUDPLAY_IPTV_RIGHTS_CONFIRMED !== 'true' → throw NOT_CONFIGURED` | Live list empty by default |
| 4 | Rights acknowledgement (EPG) | `src/server/licensed-epg.ts:39` | `CLOUDPLAY_EPG_RIGHTS_CONFIRMED !== 'true'` | Guide always unavailable |
| 5 | UI wiring | `pages/[section].tsx:17` | live → `LicensedTv` only | Public playlists never rendered on /live |
| 6 | Playability filter | `src/server/iraq-playlist.ts` `permittedHls` | requires https, no query string, path ends `.m3u8` | Many real IPTV streams marked unplayable |
| 7 | Host allowlist | `src/server/firebase-public.ts` | `ALLOWED_HLS_HOSTS = {partneta.cdn.mgmlcdn.com}` | Single hardcoded provider only |
| 8 | Mock player | `src/components/iptv/IptvSection.tsx` | hardcoded BigBuckBunny/Sintel MP4s labelled beIN/MBC/OSN | Not used by any route, but is fake data |

## A3. Baseline evidence — production, before any change

`GET https://cloud-play-iraq.vercel.app/api/iptv/iraq`
  → 200-tunneled body: `{"error":"SOURCE_NOT_APPROVED"}` (HTTP 503)
`GET https://cloud-play-iraq.vercel.app/api/iptv/licensed`
  → body: `{"error":"LICENSED_SOURCE_UNAVAILABLE"}` (HTTP 503)

## A4. Existing player + services

- Player: `src/components/player/MediaViewer.tsx` — hls.js dynamic import, native HLS
  fallback (Safari), level/audio/subtitle track selection, retry (`attempt` key),
  watch-progress (localStorage), cast controls. **Solid; reuse as-is.**
- Playback path today: server returns a direct provider URL → browser fetches it.
  No server-side stream proxy exists anywhere in the repo.
- Catalog/API: Next.js pages/api routes (no NestJS in the deployed target).
- Deploy: Vercel project `cloud-play-iraq` (prj_zxlqaeLb1EvuMDFcnHHvRAelbHad),
  root directory `apps/web`, install `cd ../.. && npm ci`, build `npm run build`,
  production branch `main`, framework nextjs.
- Source of truth for channels in production: none configured → hence 503.

## A5. Target files to change

- `apps/web/src/server/legacy-source-policy.ts`  (remove rights gate → transport policy)
- `apps/web/src/server/live/*`                    (new: parser, registry, importer, proxy)
- `apps/web/pages/api/iptv/live.ts`               (new: single real feed endpoint)
- `apps/web/pages/api/stream/[...path].ts`         (new: SSRF-guarded HLS proxy)
- `apps/web/src/components/iptv/LiveTv.tsx`        (new: real Live UI)
- `apps/web/pages/[section].tsx`                   (wire live → LiveTv)
- `scripts/*`                                      (acceptance tests)

## A6. Requirement conflict flagged to the user (see report)

Article 4 requires removing the rights-approval *technical* gate for public
sources. Cloud Play exposes streams whose redistribution rights are not held by
the operator. The public-source path is therefore implemented as a
**link-out/discovery catalog + direct provider playback** (no re-hosting, no
server-side recording or rebroadcast), and the rights-approval gate is removed
exactly as instructed for that path. The operator's *own* curated list stays
available as an optional, higher-priority source.
