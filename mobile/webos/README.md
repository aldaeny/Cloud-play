# Stage 7: LG webOS Bundle (HTML/JS)

## Structure
mobile/webos/
├── app/
│   ├── manifest.json        # webOS app manifest
│   ├── index.html           # Main entry
│   ├── app.js               # App logic (JS)
│   ├── styles.css           # Styles (brand colors)
│   ├── assets/
│   │   └── icons/           # App icons
│   └── services/
│       └── aether-api.js    # API client (fetch-based)
└── tools/
    └── build.sh             # Build script for webOS package

## Implementation (Stage 7)
- HTML/CSS/JS (webOS native)
- Video.js or native `<video>` (HLS Signed)
- D-Pad Navigation (webOS Focus Engine)
- API Integration (/v1/...)
- Dark mode default (#0a0a0c)
- RTL/LTR support (Arabic/English)

## Stage 7 Acceptance Criteria
- Journey: Registration -> Search -> Details -> Playback (HLS Signed) on webOS TV
- D-Pad Navigation
- Progress Sync (WatchProgress)
- Limit Enforcement (Device Limit, Stream Limit)

## Note on External Links (Rejected)
- Firebase, Optic TV, KurdFilm, Beenar, MoviesKurdish, Aptabase, Cloudflare Speed Test are NOT integrated.
- Aether remains closed on licensed content uploaded via Admin Panel (Stage 3).
