# Design Review & Refinement — Cloud Play web

**Date:** 2026-11-10 · **Branch:** `arena/65cc5d3b-cloud-play`
**Scope:** visual/copy refinement only — no routing, playback, data or API changes.
**Verification:** real Chromium (desktop 1440px + mobile 390px), light & dark, Arabic & English, hover and keyboard focus. `eslint` clean; `test:films` (17) and `test:public` (13) pass; browser smoke matches the clean-tree baseline exactly (the 4 pre-existing failures require a running API server and occur without these changes).

---

## What was wrong and what changed

### 1. Animated red edge glow on every content card (removed)
`.browse-card`, `.open-movie-card` and `.cp-reel-card` carried an infinitely
rotating red conic border plus a pulsing red inner shadow. It was off-brand
(red exists nowhere else in the palette), read as generic decoration, and was
especially loud on the light theme. The whole block was deleted; cards keep
their hairline borders, hover lift, and focus ring.

### 2. Legacy purple→pink gradient fills (replaced with one brand token)
Selected tabs, primary buttons, active filter chips and the dock's active
button still used the pre-refactor `linear-gradient(--purple, --pink)` fills
that `docs/button-redesign` had already removed from the shared button system.
All of them now use a single token pair defined in `globals.css`:

- `--cp-accent: #d01b7f` — deepened from the logo's magenta so white labels
  clear WCAG AA (5.07:1)
- `--cp-accent-hover: #b0155c` — hover darkens, so contrast improves instead
  of fading

Applied in: `live.css`, `public-tv.css`, `films.css`, `private-player.css`,
`player.css`, `account.css`, `app-shell.css`, `global-nav.css`, and the
scoped Tailwind channel UI (`accent` token + the two gradient buttons in
`ViewModeToggle` / `ChannelRowCompact`). Violet stays only as a quiet accent
for borders, focus rings and small text — it is no longer a fill.

### 3. Vague marketing copy (rewritten with verified facts)
- Hero headline: “A world of entertainment, all in one place.” →
  **“Free films and live TV. / No sign-in, no subscription.”**
  (AR: «أفلام مجانية وبث مباشر. / بدون تسجيل دخول ولا اشتراك.»)
- Hero sub-line now states live counts from the real data:
  **“36 public-domain films · 33 live channels · no account needed”**
- Hero CTA pointed at the empty `/latest` page → now **“Browse the film
  library” → `/movies`**, where the 36 films actually are
- Footer “A little more to discover.” → a factual line about what the
  platform is; page `<title>` updated to match
- Hero eyebrow “IN THE SPOTLIGHT” → the brand line “CLOUD PLAY IRAQ”

### 4. Em-dash overuse in visible copy (moderated)
Home band copy, section footer, live-TV heading, film-library intro and the
About page now use sentence breaks or `·` separators instead of stacking
em dashes. Functional helper strings elsewhere were left alone.

### 5. Contrast bumps on the dark theme
Footer, hero footline, card meta rows, brand tagline and section subtitles
were 9–11px text at ~#747581–#787984 (≈4:1 on black). Raised to #8f909b–
#9a9ba6 (≈6–7:1). Verified focus ring on the hero CTA: `2px solid` visible.

### 6. Light-theme poster placeholders (themed)
Film cards without artwork used a hardcoded dark-purple poster background,
which looked like a hole in the light theme. Placeholders are now neutral
graphite on dark and light slate on light, the bottom shade only renders over
real artwork, and the letter initial adapts.

### 7. Decorative gradient surfaces retuned to the brand ramp
The 3D reel’s side cards were generic purple/blue washes; they now use the
logo’s coral → magenta → cyan ramp (warm centre card unchanged). Same for the
reel aura, header hairline, browse-icon tiles and the film-band ambient blob.

### 8. Scroll-reveal scope
The footer no longer fades in on scroll (a footer is not an entrance).
Section reveals were kept: they are below-fold only, subtle, and disabled by
`prefers-reduced-motion` / the reduce-motion setting.

## Kept on purpose (pattern audit)
- **Glassmorphism** — the documented Apple-TV-style system, with its
  `solid-panels` and `@supports` fallbacks intact.
- **Eyebrow labels** — one consistent editorial device (not a badge above
  every heading).
- **Distinct lucide icons per channel category** — no repeated icon.
- **Red “LIVE” badges** — status colour with a clear purpose.
- **Letter placeholder grid** — honest fallback; most posters come from
  Internet Archive at runtime.
- **Star glyphs for favourites** — functional state, not decoration.

## Regenerating screenshots
```bash
cd apps/web && node scripts/shot.mjs   # BASE_URL=http://127.0.0.1:3001
```
Requires a Chromium binary (`PLAYWRIGHT_CHROMIUM_EXECUTABLE` or
`@sparticuz/chromium`, same convention as `tests/browser-smoke.mjs`).
Screenshots are written to `apps/web/docs/design-review/` and are not
committed.
