# Cloud Play Iraq — Live Streaming Recovery

Status of this folder: working record for the P0 Live recovery. Every number in
here was measured on this machine or read back from a deployment; nothing is
estimated. Where a gate is not yet satisfied it says so.

## Root cause (GATE A)

The Live route rendered `LicensedTv`, which fetched `/api/iptv/licensed`. That
handler called `readLicensedPlaylist()`, which threw `NOT_CONFIGURED` unless the
operator had set **both** `CLOUDPLAY_IPTV_RIGHTS_CONFIRMED=true` and a playlist
(env var or file). Any failure mapped to `503 LICENSED_SOURCE_UNAVAILABLE` and
the UI printed "No licensed list is available. The operator must configure a
rights-reviewed source."

Two more layers stood behind it:

1. `apps/web/src/server/legacy-source-policy.ts` hardcoded
   `legacySourcesAllowed() { return false; }`. Six of the eight IPTV routes
   (`iraq`, `arab`, `world`, `firebase`, plus `categories`/`channels` through
   `xtream-handler`) returned `503 SOURCE_NOT_APPROVED` unconditionally.
2. The UI never referenced those routes: `/live` rendered `LicensedTv` only.

So the page was gated three times over — at the switch, at the routes, and in
the component tree. Removing the message alone would have changed nothing.

Baseline evidence, production, before any change:

```
GET https://cloud-play-iraq.vercel.app/api/iptv/iraq      -> {"error":"SOURCE_NOT_APPROVED"}      (503)
GET https://cloud-play-iraq.vercel.app/api/iptv/licensed  -> {"error":"LICENSED_SOURCE_UNAVAILABLE"} (503)
```

## What replaced it

```
M3U source -> importer -> parser -> snapshot store -> /api/iptv/live
                                                     |
                                       /api/stream/<token>  (HLS proxy)
                                                     |
                                              MediaViewer
```

| File | Role |
|---|---|
| `src/server/live/url-policy.ts` | the single URL decision point: https only, no userinfo, no IP literals, no localhost/.local/.internal/metadata, optional allowlist/denylist, base64url target encoding |
| `src/server/live/m3u.ts` | M3U parser + merge with operator priority and measured parse report |
| `src/server/live/sources.ts` | fixed feed registry; the client can never supply a URL |
| `src/server/live/fetch-feed.ts` | feed fetch: manual redirects re-validated per hop, 8s abort, 8 MiB streaming cap |
| `src/server/live/store.ts` | atomic snapshot write; read order stored -> bundled |
| `src/server/live/importer.ts` | concurrent import, TTL 10 min, stale window 6 h, single-flight, last-known-good |
| `src/server/live/publish.ts` | the choke point: provider URL -> opaque `/api/stream/…` token |
| `src/server/live/hls-rewrite.ts` | rewrites every manifest URI to same-origin; one bad child rejects the whole manifest |
| `src/server/live/upstream.ts` | proxied fetch with per-hop validation, 24 MiB segment cap |
| `pages/api/iptv/live.ts` | catalogue: region/q/group/playable/page, counts, feed health |
| `pages/api/iptv/health.ts` | import report for operators and tests |
| `pages/api/stream/[...path].ts` | the HLS proxy |
| `src/components/iptv/LiveTv.tsx` | the Live UI |
| `src/server/live/snapshot/iq.json` | bundled snapshot so a cold function is never empty |

## Rights gate removal — what was removed and what was kept

Removed (all of it a *licensing* pre-condition, per the brief):

* `legacySourcesAllowed()` returning `false`; it now returns `true` and no
  longer appears in any request path.
* `CLOUDPLAY_IPTV_RIGHTS_CONFIRMED` as a condition for the Live path.
* manual operator approval before public channels appear.
* source identity verification before import.
* the dead components that only existed to show those messages
  (`FirebasePlayer`, `WorldPlayer`, `XtreamCatalog`, `IptvSection`).

Kept, deliberately (these are protection of the network, credentials, or the
provider, not a licensing check):

* every SSRF control in `url-policy.ts` and per-hop redirect validation;
* `/api/stream` refuses write methods, unknown tokens and any target that fails
  the policy;
* the Xtream adapter's own `XTREAM_CATALOG_ENABLED` switch, credential
  redaction, `http://` guard, 2 MiB cap and 120 req/min limit;
* upstream access controls: geo-blocking, tokens, signed URLs and DRM are
  respected and never bypassed. The proxy forwards no cookies or credentials.

## Measured numbers

Real iptv-org Iraq export, committed as
`apps/web/test-fixtures/iptv-org-iq-2026-11-03.m3u` (8,445 bytes, sha256
`d68091ae…`):

| Metric | Value |
|---|---|
| raw `#EXTINF` entries | 72 |
| channels after de-duplication | 61 |
| duplicates collapsed | 11 |
| unplayable entries | 6 (5 plain-http, 1 player-options) |
| unnamed entries | 0 |
| playable (public https HLS) | 55 |

## Test inventory

| Suite | Result |
|---|---|
| `scripts/live-parser-tests.js` | 54/54 pass (URL policy + parser + real fixture) |
| `scripts/live-proxy-tests.js` | 22/22 pass (manifest rewriting + SSRF vectors) |
| `scripts/live-acceptance.js` | 26/26 pass against a running server |
| `scripts/gate-c-browser.mjs` | verdict PLAYING (see below) |
| `scripts/xtream-catalog-smoke.js` | pass after updating its gate assertions |

GATE C browser measurements (headless Chromium 153 driving the real app against
an FFmpeg-produced 12 s 640×360 H.264/AAC HLS origin, TLS, no CORS headers,
query-token required):

```
verdict          PLAYING
readyState       4
resolution       640x360
decoded frames   31 -> 94
currentTime      1.129s -> 3.632s (delta 2.503s over 2.5s, paused=false)
proxy requests   8
licensed-only copy present   false
mobile 390px     cards render, 0px horizontal overflow
```

Screenshot `live-playing.png` shows the decoded frame with the source timecode
`00:00:03.680` / frame `92` inside the Cloud Play player.

## Known limitations (stated, not hidden)

* This sandbox has no outbound access to stream providers or to the public
  site, so the production Live page and the real Iraqi channels could not be
  exercised from here. Local verification used a real HLS origin instead.
* `prisma generate` cannot download its engine here, so the NestJS API suites
  and the Prisma-dependent smoke scripts cannot run in this environment. Those
  failures pre-date this work: they fail identically on the untouched baseline
  commit.
* The bundled snapshot is pinned to the 2026-11-03 export. It refreshes at
  runtime whenever the feed is reachable, and every refresh is written to
  `/tmp` on the function instance.
