# Channels page: pop-up player + easier M3U import

Date: 2026-11-08

## 1. «وين أشاهد» removed

The rights guide is gone from `/tv-sources`. Deleted outright rather than left
unrendered, so no dead code or orphaned CSS remains:

- `src/components/iptv/RightsGuide.tsx`
- `src/server/competition-rights.ts`
- `tests/competition-rights.test.mjs` and the `test:rights` script
- the `.rg-*` block in `styles/public-tv.css`
- the import and render in `LiveTv.tsx`

The free-to-air satellite reference (`FtaReference`) is untouched.

## 2. Channels open in a pop-up player

`PublicTv` previously rendered an inline `MediaViewer` block beneath the grid.
It now opens the shared **`VideoPlayerModal`**:

- portalled to `document.body`, dimmed backdrop, `role="dialog"` + `aria-modal`
- focus moves into the dialog and Tab is trapped while expanded
- page scroll locked while expanded, restored on close
- dismiss via Escape, backdrop click, or the close button
- favorite star synced with the card through the existing TV library key
- **minimize** keeps the very same video element mounted in a floating card and
  uses native Picture-in-Picture when available, so browsing does not restart
  the stream
- closing **unmounts** the video, destroying the MSE engine, so no bandwidth is
  used after dismissal

This reuses the real `VideoPlayer` (hls.js / dash.js / native MP4, quality, audio,
retry, keyboard) instead of adding a second playback stack. A small
`toPlayerChannel()` adapter bridges a curated row into the `Channel` shape;
quality is only labelled when the source declares it, and no EPG id is invented.

## 3. M3U import is easier to use

The importer already existed but was buried in `/my-tv` with no guidance. It now
has:

**A "where do I get the URL?" panel** explaining that the link comes from the
user's own subscription provider and usually ends in `.m3u` / `.m3u8`.

**A collapsible Xtream URL builder.** Most providers hand out a server address,
username and password rather than a ready link. The builder assembles the
standard `get.php?username=…&password=…&type=m3u_plus&output=ts` URL into the form
field. It is a pure helper (`src/lib/xtream-playlist-url.ts`) that:

- assumes `http` when the scheme is omitted, keeps `https` when offered
- **discards** any pasted path, query, fragment and embedded userinfo
- percent-encodes credentials into query parameters, never into URL userinfo
- refuses non-http schemes (`ftp:`, `file:`, `javascript:`, `data:`) and
  hostless/malformed input
- performs **no network access** — it only fills a field

The password input is masked, the panel starts collapsed with `aria-expanded`,
and the copy states the credentials stay in the browser until the user presses
Import. An explicit notice says to use one's own subscription only and that
sharing or restreaming it breaks the provider's terms.

**The importer also uses the pop-up player now.** One correctness detail: the
imported stream URL is an opaque same-origin proxy (`/api/playlist/stream?t=…`)
with no file extension, so `streamType` comes from the server-parsed container
(`row.kind`), **not** from sniffing the path — sniffing would mislabel MP4 as HLS.

## What did not change

The import endpoint remains **owner-only and POST-only** (POST so playlist
credentials never reach browser history or access logs), responses stay
`no-store`, and origin URLs remain sealed behind encrypted tokens. The `/live`
licensing gate, `legacySourcesAllowed() === false` (`/api/iptv/iraq` → 503) and
the `/my-tv` owner gate are all untouched.

## Tests

| Suite | Checks |
| --- | --- |
| `test:popup` (new, real Chromium) | 18 |
| `test:xtream-url` (new) | 18 |
| `test:playlists` | 44 |
| `test:private` | 23 |
| `test:fta` | 18 |
| `test:public` | 13 |
| `test:live` | 12 |
| `test:channels` | 13 |
| `test:films` | 17 |
| `test:community` | 19 |

The browser suite covers guide removal, dialog semantics, portalling, scroll
lock, focus, minimize/restore keeping the same element mounted, all three
dismissal paths, favorite sync, and a 390 px viewport. Stream **decode** is
deliberately not asserted: the sandbox cannot reach broadcaster CDNs, so the
`.m3u8` requests are failed fast and the player renders its honest error state.

`tsc` clean · `eslint` clean (one pre-existing `<img>` warning) · build 53 pages.

Screenshots: `docs/images/channels-popup-player.png`,
`docs/images/channels-no-rights-guide.png`.
