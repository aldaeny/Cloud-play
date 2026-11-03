# Stage 5: Android & Android TV (Kotlin/Compose)

## Structure
mobile/android/
├── build.gradle.kts              ✅ (root)
├── settings.gradle.kts           ✅
├── app/
│   ├── build.gradle.kts          ✅ (dependencies: Compose, ExoPlayer, Retrofit, Leanback)
│   ├── src/main/
│   │   ├── AndroidManifest.xml   ✅ (phone + TV launcher)
│   │   ├── res/values/
│   │   │   ├── colors.xml        ✅ (brand colors)
│   │   │   ├── themes.xml        ✅ (dark theme)
│   │   │   └── strings.xml       ✅ (Arabic strings)
│   │   └── java/com/aether/android/
│   │       ├── MainActivity.kt          ✅ (navigation: home/search/profiles/player)
│   │       ├── network/AetherApi.kt     ✅ (Retrofit, matches OpenAPI spec)
│   │       ├── ui/AuthScreen.kt         ✅ (register/login)
│   │       ├── ui/PlayerScreen.kt       ✅ (ExoPlayer + signed HLS + heartbeat)
│   │       ├── ui/ProfileScreen.kt      ✅ (profiles + PIN)
│   │       └── tv/
│   │           ├── TvMainActivity.kt    ✅ (TV entry)
│   │           └── TvHomeScreen.kt      ✅ (D-Pad focus, leanback rows)
│   └── proguard-rules.pro
└── README.md

## Implementation (Stage 5)
- Kotlin, Compose Multiplatform (Phone/TV)
- ExoPlayer (HLS Signed Manifest URL) — media3
- D-Pad Focus Engine (TV)
- Retrofit API Integration (/v1/...)
- Dark mode default (#0a0a0c)
- RTL/LTR support

## Stage 5 Acceptance Criteria
- Journey: Registration -> Search -> Details -> Playback (HLS Signed) on Phone & TV
- D-Pad Navigation (TV)
- Progress Sync (WatchProgress)
- Limit Enforcement (Device Limit, Stream Limit)

## Note on External Links (Rejected)
- Firebase, Optic TV, KurdFilm, Beenar, MoviesKurdish, Aptabase, Cloudflare Speed Test are NOT integrated.
- Aether remains closed on licensed content uploaded via Admin Panel (Stage 3).

## Next Steps (Stage 6-8)
- Stage 6: iOS/iPadOS/tvOS (SwiftUI)
- Stage 7: webOS Bundle
- Stage 8: Production, CDN, Subscriptions, Monitoring, CI/CD
