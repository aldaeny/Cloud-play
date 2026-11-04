# UI/UX Refactor — Header · Search · Bottom Dock · Settings
## Cloud Play — Apple TV+ / visionOS glass aesthetic

**Branch:** `arena/74b94855-cloud-play` · **Date:** 2026-11-04
**Status:** Implemented and verified in a real browser (Chromium). Live preview on port 3001. Production build passing.

All existing functionality, routing, RTL/LTR (Arabic/English), Dark/Light state, and the Hero & Stacked Cards sections are preserved. No route was disabled and no video/IPTV/data logic was touched.

---

## 1. Header refactor — clutter & boxy borders removed
- New **single shared `AppHeader` component** (`src/components/layout/AppHeader.tsx`) rendered on **every** page — home and all section pages, including Settings.
- **No outer bordered container box.** The header is a clean, floating, **sticky** bar (`position: sticky; top: 0`) with a subtle `backdrop-blur` (24px) and only a 1px hairline. `.site` now uses `overflow: clip` (with `hidden` fallback) so the sticky header works without breaking the decorative overflow.
- **Logo kept on the start side** — "Cloud Play · ENTERTAINMENT ANYWHERE".
- The oversized cartoon sun/moon/cloud switch is **replaced by a minimal circular icon button** (36×36, `rounded-full`) showing a clean Sun/Moon SVG.
- **Language switcher is a slim pill** (36px tall, 14px horizontal padding, `rounded-full`, 12px text) matching the theme button height.
- **Settings gear removed** from the header (Settings lives in the bottom dock). A minimal circular search + account button remain for quick access.

## 2. Search bar refactor — a real glassmorphic input
- New **`SearchField` component** (`src/components/search/SearchField.tsx`): `h-48px · w-full · rounded-16px · px-16px · flex · gap-12px`.
- Clean **search SVG at the inline-start with no box around it**, followed by the input, plus a clear (×) button when there is text.
- Placeholders — Arabic: **"ابحث عن فيلم، مسلسل، أو عرض حصري..."** · English: **"Search movies, series, or exclusives..."**.
- Dark: `bg white/4% · border white/8% · focus-within border purple-500/50`. Light: `bg white · border black/8% · soft shadow`.
- Used on the **Search page** (live filtering preserved) and the home expandable search row was restyled to the same glass look (its live-results behaviour is intact).

## 3. Bottom navigation dock — the critical UX fix
- **Reduced from 8 to 5 core items:** Home · Movies · Live TV · Favorites · Settings. (Live TV was chosen over the empty Series placeholder as the more essential "TV" slot; **Series, Search and Continue remain fully reachable** via the header search button, home browse cards and the footer — no route disabled.)
- **All per-icon boxes, borders and heavy inner shadows removed.** Icons sit freely inside a **single floating glass pill**: `max-w 384px · mx-auto · h-64px · rounded-full · px-12px · backdrop-blur-40px · 1px border`.
- **Active state fixed — no scaling or popping outside the dock:**
  - Soft ambient **gradient glow behind the icon** (purple, rounded-full).
  - **Brand accent** on the active icon + label — `purple-400` in dark, `purple-600` in light.
  - A tiny **4px glowing gradient dot** beneath the active icon.
  - Inactive items rest at **50% opacity → 80% on hover**, with a smooth 300ms transition.
- The dock stays persistent across navigation, hides while a player is open, and the per-page detail popover still works (restyled to match).

## 4. Light-mode contrast & Settings page
- **Fixed the invisible "Settings" title in light mode** — section headings now use `slate-900` in light and white in dark (`.section-main h1`, settings card headings).
- The static "Return to home" text box is **replaced by clean, interactive setting cards** (`src/components/settings/SettingsCards.tsx`): **Language**, **Appearance** (Dark/Light + text size + contrast + transparency), **Motion & effects**, **Playback comfort**, **Account**, and **Storage & data** with **Clear favorites / Clear all local data** (both with confirmation).
- Every card reads/writes the **same localStorage keys** the app always used and broadcasts a lightweight event, so changes apply **live** and stay in sync across the header, dock and pages. This preserves **100% of the previous home settings panel** (now relocated to the Settings page) and adds the requested clear-data option.

## 5. Visual polish — Apple glassmorphism
- Thick 2012-style inner shadows and heavy gray borders replaced with **ultra-thin 1px borders** (`rgba(255,255,255,0.08)` dark / `rgba(0,0,0,0.08)` light) and **soft ambient shadows** across the header, search field, dock and settings cards.
- Purple brand accent used consistently for active/selected/focus states.

---

## Preservation guarantees (verified)
- **Hero & Stacked Cards** sections unchanged and present on home.
- **Routing** intact — all 16 pages build; every route returns 200.
- **RTL/LTR + Dark/Light** toggles work and persist (header, dock and pages stay in sync).
- **Video playback, IPTV sources and data** untouched.
- Home settings panel functionality fully relocated to the Settings page (no feature removed).

## Test results (real browser, Chromium via Puppeteer)
| Suite | Result |
|---|---|
| UI refactor verification | **34/34 PASS** |
| Regression (transitions, persistence, popover, active accuracy, theme sync) | **10/10 PASS** |
| Production build (web) | **PASS — 16 pages, TypeScript clean** |

The 34 checks cover: header present/sticky/no-gear on all 10 routes; circular theme button + pill language; theme & language toggles persist; dock = 5 items in one blurred pill with no per-item boxes; active has glow + dot + purple accent and **does not pop out**; inactive at 50%; search field 48px/rounded-16 with boxed-free icon + correct placeholder + live filter; Settings has 6 interactive cards (not a static box), appearance applies live, light-mode title is dark, motion toggle persists, clear-favorites confirmation; Hero preserved; mobile has no overflow and header/dock fit; no console errors.

## Files
**New:** `AppHeader.tsx`, `SearchField.tsx`, `SettingsCards.tsx`, `lib/preferences.ts`, `styles/app-shell.css`, `docs/ui-refactor/` (report + 7 screenshots).
**Modified:** `_app.tsx` (import), `index.tsx` (shared header, settings panel relocated), `SectionLayout.tsx` (shared header + live pref sync), `[section].tsx` (Settings cards + SearchField), `Icon.tsx` (+trash), `GlobalNav.tsx` + `global-nav.css` (5-item clean dock), `nav-routes.ts` (5 core routes).

## Notes / limits
- The native iOS/Android shells render this same web UI in a WebView, so they inherit the refactor automatically; they have no build tooling in this sandbox to screenshot separately.
- A pre-existing Next.js `<title>` warning (multiple text nodes) remains on some pages — it predates this work and is not a regression.

## Reproduce
```bash
# from /home/user/visual-check (Chromium via @sparticuz/chromium, LD_LIBRARY_PATH=/tmp/al2023/lib)
node ui-refactor-verify.mjs     # 34 checks
node refactor-regression.mjs    # 10 checks
cd apps/web && npm run build    # production build
```
