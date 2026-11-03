# Stage 6: iOS / iPadOS / tvOS (SwiftUI)

## Structure
mobile/ios/
├── Aether/
│   ├── AetherApp.swift                ✅ (entry point + theme)
│   ├── Views/
│   │   ├── MainTabView.swift          ✅ (tab nav: home/search/profiles)
│   │   ├── AuthView.swift             ✅ (register/login)
│   │   ├── PlayerView.swift           ✅ (AVPlayer + signed HLS + heartbeat)
│   │   └── ProfileView.swift          ✅ (profiles + PIN)
│   ├── Network/
│   │   └── AetherAPI.swift            ✅ (URLSession + Codable, matches OpenAPI)
│   ├── TV/
│   │   └── TvHomeScreen.swift         ✅ (Focus Engine, D-Pad)
│   └── Resources/
│       └── Assets.xcassets            (Colors: #0a0a0c, #121217, #00e5ff, #ff2085, #7b30ff, #ffb000)
├── Aether.xcodeproj
└── Podfile (Alamofire, SwiftUI, AVFoundation)

## Implementation (Stage 6)
- SwiftUI (Shared for iOS/iPadOS/tvOS)
- AVPlayer (HLS Signed Manifest URL)
- Focus Engine (tvOS)
- URLSession API Integration (/v1/...)
- Dark mode default (#0a0a0c)
- RTL/LTR support (Arabic/English)
- VoiceOver support

## Stage 6 Acceptance Criteria
- Journey: Registration -> Search -> Details -> Playback (HLS Signed) on iPhone/iPad/Apple TV
- Focus Engine (tvOS)
- Progress Sync (WatchProgress)
- Limit Enforcement (Device Limit, Stream Limit)

## Note on External Links (Rejected)
- Firebase, Optic TV, KurdFilm, Beenar, MoviesKurdish, Aptabase, Cloudflare Speed Test are NOT integrated.
- Aether remains closed on licensed content uploaded via Admin Panel (Stage 3).

## Next Steps (Stage 7-8)
- Stage 7: webOS Bundle
- Stage 8: Production, CDN, Subscriptions, Monitoring, CI/CD
