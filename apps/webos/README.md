# Stage 7: webOS Bundle (LG Smart TV)

## Structure
apps/webos/
├── appinfo.json
├── index.html (Shell hosting Web Viewer)
├── js/
│   ├── app.js (webOSTV.js integration)
│   └── player.js (HLS Player)
├── css/
│   └── style.css (brandDark, brandCard, cyanGlow, magentaGlow, violetGlow, amberGlow)
└── images/

## Implementation (Stage 7)
- HTML/CSS/JS (Next.js Viewer bundled or Shell)
- webOSTV.js (Remote keys, Exit handling)
- HLS Player (HLS Signed Manifest URL)
- Dark mode default (#0a0a0c)
- RTL/LTR support (Arabic/English)
- Focus Engine (LG webOS)

## Stage 7 Acceptance Criteria
- Journey: Registration -> Search -> Details -> Playback (HLS Signed) on LG TV
- Remote Key Handling (Up, Down, Left, Right, Enter, Back, Exit)
- Progress Sync (WatchProgress)
- Limit Enforcement (Device Limit, Stream Limit)

## Note on External Links (Rejected)
- Firebase, Optic TV, KurdFilm, Beenar, MoviesKurdish, Aptabase, Cloudflare Speed Test are NOT integrated.
- Aether remains closed on licensed content uploaded via Admin Panel (Stage 3).

## Next Steps (Stage 8)
- Stage 8: Production, CDN, Subscriptions, Monitoring, CI/CD
