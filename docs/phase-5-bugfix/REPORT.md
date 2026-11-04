# Phase 5 — UI/UX Bug-Fix Pass (7 reported issues)

Branch: `arena/868a61fe-cloud-play` · Base: `main` @ `743cbe0` (Phases 1–4 merged)
Scope: the web app (`apps/web`), which the Expo WebView mobile shell inherits.

This pass addresses the seven issues reported against the live site
(`cloud-play-iraq.vercel.app`). **Note:** several of the reported symptoms describe
the *pre-Phase-4* design that is still deployed on Vercel; the current `main` already
fixed them. This pass re-verifies those and completes the genuinely new work
(notched dock, Series slot, always-visible home search, stacked-card clearance,
"Clear favorites **& watch progress**", app-wide thin-button borders, and a deeper
light-contrast fix). A redeploy of `main` is required for the live site to catch up.

All routes, playback, RTL/LTR, and both themes are preserved. No route was disabled
and no functionality removed.

---

## The seven fixes

### 1. Unified floating header — re-verified
The shared `AppHeader` (boxless, sticky, 36px circular theme button + slim language
pill, no gear) is unchanged from Phase 4 and confirmed on every route. The header
search button is now a plain focus/navigation action (the disclosure `aria-expanded`
was removed because the home search is always visible — see #2).

### 2. Home search — real, always-visible, full-width
Replaced the collapsed "morph" trigger with a permanent full-width glass field
directly below the header (`.home-search` + reusable `SearchField`): 48px tall,
16px radius, bare inline-start icon, full shell width. Live results drop down beneath
it as you type; submitting goes to `/search`. The header search icon scrolls to top
and focuses this field.
- EN placeholder: `Search movies, series, exclusives...`
- AR placeholder: `ابحث عن فيلم، مسلسل، أو عرض حصري...`

### 3. Bottom dock — notched, 5 core items, 10px labels
Redesigned to match the attached reference GIF: a single floating glass pill where
the **active** item rises into a smooth notch inside a filled brand-gradient
(purple→pink) circle. The bar's silhouette curves up around the circle, so the active
indicator never breaks out of a rectangular border. Inactive icons sit freely (no
per-icon boxes); every item has a 10px label.
- Items are exactly **Home · Movies · Series · Favorites · Settings**. Per the prompt,
  **Series** replaces the earlier Live-TV slot. Live TV, Search and Continue remain
  reachable via the header search, home cards and footer — no route disabled.
- The notch slides to the active item. It is positioned from live screen measurements
  (correct in RTL and LTR) and animated with a timer-driven tween. This was necessary
  because a CSS transition / rAF / WAAPI slide can lock or be throttled during the
  page fold/unfold and the destination's RTL→LTR boot; the timer tween always lands on
  the measured spot. The notch mirrors correctly in Arabic (Home on the right).

### 4. Stacked cards — no clipped text + dock clearance
Increased the reel stage and card heights (desktop/tablet/phone) so the bottom note
and action link of every card are fully visible, and reserved page bottom space so
the floating dock never covers content: `body.cp-has-global-nav` padding-bottom is
now **130px** (120px on phones). Verified the center card's bottom text sits inside
the card and no card clips its content in EN desktop and AR mobile.

### 5. Light-mode heading contrast — app-wide
Section headings are `#0f172a` in light mode (dark `#ffffff`). This pass found and
fixed a deeper home-page bug: `.site.theme-light` animates `color`, and that
transition could lock at the dark-theme value during the home's dark→light boot,
leaving the home headings near-white on a light background. Removed the `color`
transition (the background fade remains) and added explicit `#0f172a` for the home
section headings (reel, highlights, about, live). The hero `h1` stays white over its
dark image, as intended. Verified `#0f172a` across all 11 routes.

### 6. Settings — "Clear favorites & watch progress"
The storage card's clear action now removes saved films, channels **and** locally
stored watch progress (`cloudplay-progress-v1-*`), with updated AR/EN labels and
confirm dialog. Preferences (theme, language, etc.) are preserved — it is not a full
wipe; the separate "Clear all local data" action remains. Verified the favorites and
progress keys are removed while the theme key survives.

### 7. All buttons — thin borders, no heavy inner shadows
Replaced the shared button design tokens app-wide: borders are now
`rgba(255,255,255,0.08)` (dark) / `rgba(0,0,0,0.08)` (light), and the heavy inset
"inner-shadow" highlights were removed in favour of soft ambient shadows. The glass
fill and animated edge are retained. Applies to every button that uses the shared
`buttons.css` system (web), in both themes.

---

## Modified files

| File | Change |
| --- | --- |
| `apps/web/pages/index.tsx` | Always-visible home search + live results; removed morph state |
| `apps/web/src/components/layout/AppHeader.tsx` | Search button is focus/nav (dropped disclosure aria) |
| `apps/web/src/components/nav/GlobalNav.tsx` | Notch indicator: DOM-observed measurement + timer tween |
| `apps/web/src/lib/nav-routes.ts` | Dock slot 3 = Series (was Live TV) |
| `apps/web/src/lib/preferences.ts` | `clearFavorites` also clears watch-progress keys |
| `apps/web/src/components/settings/SettingsCards.tsx` | "Clear favorites & watch progress" labels/confirm |
| `apps/web/src/styles/global-nav.css` | Notched dock, raised gradient active circle, 10px labels, 130px clearance |
| `apps/web/src/styles/app-shell.css` | Home-search styles; light home-heading contrast |
| `apps/web/src/styles/globals.css` | Taller reel cards/stage; removed locking color transition |
| `apps/web/src/styles/buttons.css` | Thin 1px borders + soft ambient shadows (no insets) |

---

## Verification

Automated browser suite (`visual-check/phase5-verify.mjs`, headless Chromium):
**58 / 58 passed.**

- **A · Dock (12):** 5 items in order, 10px labels, Series slot, raised gradient active
  circle, no inactive boxes, notch aligned in LTR + RTL, RTL mirroring, notch tracks
  client-side navigation to all four other tabs.
- **B · Home search (6):** visible without interaction, full-width, exact EN/AR
  placeholders, bare inline icon, live results on typing.
- **C · Stacked cards (6):** no card clips text (EN desktop + AR mobile), center card
  bottom fully inside, body padding-bottom ≥ 130/120px.
- **D · Light contrast (11):** `#0f172a` heading on every route (home section h2; others h1).
- **E · Clear favorites + progress (4):** correct label, favorites removed, progress
  removed, theme preserved.
- **F · Button tokens (4):** dark/light borders at .08 alpha, no inner inset shadows.
- **G · Regression (15):** all 11 routes return 200, theme toggle syncs dock + page,
  active-item popover opens and Escape dismisses it.

Production build: **PASS** — TypeScript clean, compiled successfully, **16 pages**
generated, all routes intact.

Screenshots (this folder): `01` home dark search · `02` home dark reel · `03` home
light reel (heading contrast) · `04` dock notch detail · `05` Arabic mobile (RTL) ·
`06` settings dark · `07` settings light.

### Known limitations
- Real authorized-source playback is not testable in this sandbox (egress + HTTPS
  restrictions); the playback system was not modified.
- The notch slide and theme fade are verified for correct *positioning/contrast*; the
  decorative animation timing is driven by a timer tween specifically so it remains
  reliable under the page transition.
