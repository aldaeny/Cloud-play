# Cloud Play Iraq — Live / Router / Playback repair

Branch: `arena/e5192798-cloud-play` (Arena session branch; the requested `fix/live-app-router-build` name cannot be created in this environment).

## What was broken

- Next.js build failed: App Router pages `/live` and `/live/[id]` had no `app/layout.tsx`.
- `lucide-react` and `dashjs` were imported but absent from the web manifest/lockfile.
- Pages Router `[section]` still generated `/live`, colliding with the App Router route and causing `Invariant: page wasn't built`.
- Shared shell components used `next/router`, which is incompatible with App Router rendering.
- Live pages consumed 245 generated demo channels and hardcoded EPG/related data.
- The new `VideoPlayer` had no real HLS/DASH attachment, fake controls, global keyboard interception and page-reload retry.
- Favorites used a different storage key from the existing free-account sync.
- Root `packageManager` declared pnpm while the repository/Vercel actually use npm workspaces.

## What changed

### Build & hybrid routers
- Added `app/layout.tsx` with metadata/viewport and a client `AppShell` using `next/navigation`.
- Added router-neutral `NavigationProvider`; `PagesShell` adapts `next/router`, `AppShell` adapts `next/navigation`.
- `GlobalNav`, `PageTransition`, `AppHeader`, `OwnerPlayerLink` now consume the adapter; `AccountProvider` is a client component.
- Cross-router main navigation uses a document navigation and preserves the fold/unfold transition on both sides.
- Removed `/live` from Pages static paths; legacy curated/world source UI remains available at `/tv-sources`.
- Shared CSS entry imported once by each router shell.
- Aligned root `packageManager`/scripts with npm workspaces.

### Live data & UX
- `/live` now reads only `/api/iptv/licensed` (operator rights-reviewed playlist). Unconfigured source returns an honest empty catalog; parse/network failures show retryable errors.
- Removed generated demo channels, hardcoded EPG and fake related channels.
- Real search (name/country/language/group/category), category/country/declared-quality filters, sorting, favorites-only, pagination, lazy logos with fallback, loading/error/not-found/unavailable states.
- Detail page: real player, favorites, share, source metadata, real EPG now/next with independent retry, related channels from the same source.
- Quality/country are unknown unless explicitly declared; no inferred HD badges.
- Favorites migrated once to canonical `cloudplay-tv-favorites-v1`; watch history stores metadata only.

### Playback
- `VideoPlayer`: dynamic hls.js/dashjs, native HLS fallback, MP4; real play/pause/volume/mute/fullscreen/seek; actual quality/audio/subtitle tracks when the manifest exposes them; bounded network/media recovery; autoplay-blocked state; scoped keyboard/remote keys; touch controls; offline handling.
- `MediaViewer`: added DASH support, buffering state, bounded retry/timeout, pause button; existing Cast/progress preserved.
- DRM-protected sources fail explicitly; no client keys or fake iframe controls.

## Verification

- `npm ci` (root workspace install) — pass.
- `tsc --noEmit` — pass.
- `npm run lint --workspace aether-web` — 0 errors, 5 pre-existing `<img>` warnings.
- `npm run build --workspace aether-web` — pass (Next 16.4.3 Turbopack; React 18 deprecation warning only).
- Offline suites: live-router 12, private-player 23, public-tv 13, public-films 17, community-tv 19, playlist-import 44 — all pass.
- Real Chromium smoke (`tests/browser-smoke.mjs`): routes, hybrid navigation, theme/language persistence, mobile/tablet/TV overflow, honest empty/error states, and local HLS/DASH/MP4 fixtures decoding with real track selection/retry/keyboard — pass when `MEDIA_FIXTURES` is supplied.

## Remaining operator work

- Connect a rights-reviewed playlist via `CLOUDPLAY_IPTV_RIGHTS_CONFIRMED=true` and `CLOUDPLAY_IPTV_M3U`/`CLOUDPLAY_IPTV_FILE`; optional EPG via `CLOUDPLAY_EPG_*`. Without it, Live intentionally shows the setup state.
- React 18 is deprecated in Next 16; plan a separate React 19 upgrade.
- Legacy `<img>` lint warnings remain in older components.
