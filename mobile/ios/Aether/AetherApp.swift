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
    let api = AetherAPI.shared

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
    }
}

// Shared app theme colors
enum AetherColors {
    static let brandDark = Color(hex: "#0a0a0c")
    static let brandCard = Color(hex: "#121217")
    static let cyanGlow = Color(hex: "#00e5ff")
    static let magentaGlow = Color(hex: "#ff2085")
    static let violetGlow = Color(hex: "#7b30ff")
    static let amberGlow = Color(hex: "#ffb000")
    static let gray = Color(hex: "#888888")
}
