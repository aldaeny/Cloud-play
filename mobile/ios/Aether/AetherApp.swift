// AetherApp.swift — iOS/iPadOS/tvOS Entry Point
// Aether — VOD/IPTV Streaming Platform

import SwiftUI

@main
struct AetherApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var isLoggedIn = false
    @State private var authToken: String?
    /// Same preference key as the web app (`cloudplay-theme`).
    @AppStorage("cloudplay-theme") private var appearanceRaw = CloudPlayAppearance.system.rawValue
    @Environment(\.colorScheme) private var systemScheme
    let api = AetherAPI.shared

    private var appearance: CloudPlayAppearance {
        CloudPlayAppearance(rawValue: appearanceRaw) ?? .system
    }

    var body: some View {
        Group {
            if let token = authToken {
                MainTabView(api: api, authToken: token, onLogout: {
                    authToken = nil
                    isLoggedIn = false
                })
            } else {
                AuthView(api: api, onLoginSuccess: { token in
                    authToken = token
                    isLoggedIn = true
                })
            }
        }
        .cpCanvas()
        .preferredColorScheme(appearance == .system ? nil : appearance.colorScheme(system: systemScheme))
        .tint(CloudPlayTheme(colorScheme: appearance.colorScheme(system: systemScheme)).accent)
        // The interface mirrors automatically; Arabic is the reference locale.
        .environment(\.layoutDirection, Locale.current.language.languageCode?.identifier == "ar" ? .rightToLeft : .leftToRight)
    }
}

// Legacy palette name still referenced by the hand-written screens. It now
// resolves through the shared tokens, so light mode and Arabic stay consistent.
enum AetherColors {
    static let brandDark = CloudPlayTokens.Color.canvas
    static let brandCard = CloudPlayTokens.Color.glassSolid
    static let cyanGlow = CloudPlayTokens.Color.accent
    static let magentaGlow = CloudPlayTokens.Color.accentMagenta
    static let violetGlow = CloudPlayTokens.Color.accentStrong
    static let amberGlow = CloudPlayTokens.Color.warning
    static let gray = CloudPlayTokens.Color.textTertiary
}
