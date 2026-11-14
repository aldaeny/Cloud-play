# Universal Liquid Glass — design system

Cloud Play ships one visual identity across web, iOS/iPadOS/tvOS and Android
(phone, tablet, TV). This document is the working reference: where the values
live, how a screen is composed, and how the cross-surface rules are enforced.

## 1. Sources of truth

| Layer | File | Notes |
| --- | --- | --- |
| Raw tokens | `packages/ui-tokens/tokens.json` | Colour, glass, radius, spacing, type, motion, control metrics, elevation. |
| Generator | `packages/ui-tokens/build.mjs` | Emits the three targets below. Run `node packages/ui-tokens/build.mjs`. |
| Web CSS | `apps/web/src/styles/tokens.generated.css` | `--cp-*` custom properties consumed by every stylesheet. |
| iOS | `mobile/ios/Aether/DesignSystem/CloudPlayTokens.swift` | `CloudPlayTokens.Color`, `.Radius`, `.Motion`, `.Control`. |
| Android | `mobile/android/.../designsystem/CloudPlayTokens.kt` | `CloudPlayTokens.Dark/Light/Radius/Motion/Control`. |

Never hard-code a colour, radius or duration in a screen. Add it to
`tokens.json`, regenerate, and consume the semantic layer:

- Web: `var(--cp-ink)`, `var(--cp-glass-fill)`, `var(--cp-accent)`,
  `var(--cp-radius-lg)`, `var(--cp-duration-base)`, `var(--cp-ease-spring)`.
- iOS: `CloudPlayTheme(colorScheme:)` + `.cpGlass()` / `.cpGlassPill()` / `.cpCanvas()`.
- Android: `CloudPlayTheme { }` + `Modifier.cpGlass()` + `CloudPlayMotion`.

## 2. Appearance

`cloudplay-theme` stores `system | dark | light`; it is resolved to the painted
appearance and written to `<html data-theme="dark|light" data-theme-mode>`.
The boot script applies it before first paint (no flash), and every provider
listens to the same preference store, so a change repaints the header, the page,
the dock, sheets and the player in one commit — with no reload.

- Dark Liquid Glass: near-black canvas, blue/violet/magenta ambient light,
  white-at-low-alpha glass fills, cool rims.
- Light Liquid Glass: translucent white glass over a soft blue-grey canvas,
  darker rims, deeper but softer shadows, and tinted segmented-control tracks so
  selected states stay legible on white.

Platform/device are exposed as `data-platform="ios|android|web"`
and `data-device="phone|tablet|desktop|tv"`. They change interaction details
(ripple only on Android, focus scaling on TV, hover affordances on desktop) —
never layout identity.

## 3. Language and direction

`cloudplay-language` stores `ar | en`. The switch updates `lang`, `dir`,
`data-lang` and `data-dir` on `<html>` in the same commit as the copy.

Rules enforced in `src/styles/rtl.css`:

- Lay out with logical properties (`margin-inline`, `inset-inline-start`) so RTL
  costs nothing. Physical offsets in legacy CSS are overridden here.
- Mirror only directional glyphs (`.cp-flip-rtl`, arrows, chevrons) with
  `scaleX(-1)`. Media, artwork and the Latin wordmark are isolated
  (`direction: ltr; unicode-bidi: isolate`).
- Mixed titles use `unicode-bidi: plaintext`, so an English film name inside an
  Arabic sentence keeps its own direction.
- Email, URL, password and numeric inputs are forced LTR.
- Arabic type: no letter-spacing, taller line height, IBM Plex Sans Arabic;
  Latin uses Plus Jakarta Sans. Numbers and dates go through `Intl`
  (`ar-IQ-u-nu-latn`, Asia/Baghdad) via `useI18n().n` / `.date`.

## 4. Composition

The page is a stack of glass surfaces over the ambient canvas:

1. `app-header` — brand (inline start), route links (desktop), glass search,
   appearance + language menus, account, menu sheet (phone).
2. Page hero or `.cp-page-head` — kicker, display title, lede, actions.
3. Content — rails (`Rail`/`FilmCard`), library grid, settings cards, lists.
4. `cp-nav-bar` — floating dock on phones/tablets (Home, Movies, Live,
   Favorites, Settings + search). Desktop keeps the header navigation.

Control primitives (`src/components/ui/controls.tsx`): `Button`, `IconButton`,
`Segmented`, `Switch`, `Slider`, `Field`, `Chip`; overlays
(`src/components/ui/overlays.tsx`): `MenuButton`/`usePopover`, `Sheet`,
`Select`, `Confirm`. Use them instead of restyling raw elements. Legacy classes
(`.media-play`, `.pp-*`, `.pli-*`, `.film-*`, `.ptv-*`, `.live-*`) are mapped
onto the same materials by `buttons.css` and `screens.css` so unmigrated
surfaces still belong to the system.

## 5. Motion

`src/styles/motion.css` defines the vocabulary: page enter 460 ms spring, exit
190 ms, `data-cp-dir="back"` reverses the direction, scroll reveal, viewer
entrance, sheet/popover springs. `prefers-reduced-motion: reduce`, the
`cloudplay-reduce-motion` preference and `:root.motion-off` all collapse
durations to ~0 ms and stop decorative loops. Native sides use
`CloudPlayMotion.spring(reduceMotion:)` and `CloudPlayMotion.spring()`.

## 6. Player

`VideoPlayer` (streams, Xtream) and `MediaViewer` (public films) share the same
chrome: floating top bar with title/LIVE/close, centred play target, seek row
with a liquid-glass slider, control bar (play, ±10 s, mute, volume, settings,
fullscreen), glass settings sheet. On touch, double-tap the left/right third of
the picture to jump ±10 s. The control surface is always LTR — Arabic labels,
but scrubbing never mirrors.

## 7. Verification

```bash
cd apps/web
npm run test:design   # direction/theme matrix, runtime switching, a11y, player
npm run test:layout   # dock + Live TV layout regression
npm run test:browser  # route smoke
```

`tests/design-system.mjs` is the guard for this work: 3 viewports × 2 languages ×
2 appearances × 8 routes, plus runtime switching (asserts no reload), OS colour
scheme following, Arabic typography/bidi isolation, focus rings, reduced motion,
minimum control sizes and the player surface.

All suites run against the production build (`npx next build && npx next start -p 3001`,
`BASE_URL=http://127.0.0.1:3001`). Current results: design 21/21, Live layout
120/120, route smoke 16/16, search + CSP 20/20, channel UI 23/23; `tsc --noEmit`
and `eslint .` are clean, so `next build` type-checks.
