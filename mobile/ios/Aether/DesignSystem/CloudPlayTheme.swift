// CloudPlayTheme.swift — Liquid Glass appearance layer for iOS / iPadOS / tvOS.
//
// `CloudPlayTokens` is generated from packages/ui-tokens/tokens.json and holds
// the raw values shared with the web app and Android. This file turns those
// values into something SwiftUI can consume: a resolved theme per colour
// scheme, the glass materials, and the motion vocabulary. Nothing here invents
// a colour — dark, light, RTL and LTR all read from the same tokens.

import SwiftUI

// MARK: - Hex helper

extension Color {
    /// `Color(hex: "#7AA2FF")` — used by the hand-written screens that predate
    /// the design system, so both notations resolve to the same values.
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let a, r, g, b: UInt64
        switch cleaned.count {
        case 3:
            (a, r, g, b) = (255, (value >> 8) * 17, (value >> 4 & 0xF) * 17, (value & 0xF) * 17)
        case 8:
            (a, r, g, b) = (value >> 24, value >> 16 & 0xFF, value >> 8 & 0xFF, value & 0xFF)
        default:
            (a, r, g, b) = (255, value >> 16 & 0xFF, value >> 8 & 0xFF, value & 0xFF)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Appearance preference

/// Mirrors the web `cloudplay-theme` preference: `system` follows the device.
public enum CloudPlayAppearance: String, CaseIterable, Identifiable {
    case system, dark, black, light

    public var id: String { rawValue }

    public var localizedName: (ar: String, en: String) {
        switch self {
        case .system: return ("تلقائي", "Automatic")
        case .dark: return ("داكن", "Dark")
        case .black: return ("أسود", "Black")
        case .light: return ("فاتح", "Light")
        }
    }

    /// Resolve against the environment colour scheme.
    public func colorScheme(system: ColorScheme) -> ColorScheme {
        switch self {
        case .system: return system
        case .dark, .black: return .dark
        case .light: return .light
        }
    }
}

// MARK: - Semantic theme

/// Resolved colour + material set for one appearance.
public struct CloudPlayTheme {
    public let isDark: Bool

    public init(colorScheme: ColorScheme) {
        self.isDark = colorScheme == .dark
    }

    // Canvas
    public var canvas: Color { isDark ? CloudPlayTokens.Color.canvas : CloudPlayTokens.Color.Light.canvas }
    public var canvasRaised: Color { isDark ? CloudPlayTokens.Color.canvasRaised : CloudPlayTokens.Color.Light.canvasRaised }

    // Ink
    public var ink: Color { isDark ? CloudPlayTokens.Color.textPrimary : CloudPlayTokens.Color.Light.textPrimary }
    public var inkSecondary: Color { isDark ? CloudPlayTokens.Color.textSecondary : CloudPlayTokens.Color.Light.textSecondary }
    public var inkTertiary: Color { isDark ? CloudPlayTokens.Color.textTertiary : CloudPlayTokens.Color.Light.textTertiary }

    // Glass
    public var glassFill: Color { isDark ? CloudPlayTokens.Color.glass1 : CloudPlayTokens.Color.Light.glass1 }
    public var glassFillStrong: Color { isDark ? CloudPlayTokens.Color.glass2 : CloudPlayTokens.Color.Light.glass2 }
    public var glassSolid: Color { isDark ? CloudPlayTokens.Color.glassSolid : CloudPlayTokens.Color.Light.glassSolid }
    public var glassRim: Color { isDark ? CloudPlayTokens.Color.glassRim : CloudPlayTokens.Color.Light.glassRim }
    public var glassRimStrong: Color { isDark ? CloudPlayTokens.Color.glassRimStrong : CloudPlayTokens.Color.Light.glassRimStrong }
    public var glassHighlight: Color { isDark ? CloudPlayTokens.Color.glassHighlight : CloudPlayTokens.Color.Light.glassHighlight }

    // Accents
    public var accent: Color { isDark ? CloudPlayTokens.Color.accent : CloudPlayTokens.Color.Light.accent }
    public var accentStrong: Color { isDark ? CloudPlayTokens.Color.accentStrong : CloudPlayTokens.Color.Light.accentStrong }
    public var accentMagenta: Color { isDark ? CloudPlayTokens.Color.accentMagenta : CloudPlayTokens.Color.Light.accentMagenta }
    public var danger: Color { isDark ? CloudPlayTokens.Color.danger : CloudPlayTokens.Color.Light.danger }
    public var success: Color { isDark ? CloudPlayTokens.Color.success : CloudPlayTokens.Color.Light.success }

    /// The ambient light behind the interface: blue, violet, magenta.
    public var ambient: [Color] {
        if isDark {
            return [CloudPlayTokens.Color.ambientBlue, CloudPlayTokens.Color.ambientViolet, CloudPlayTokens.Color.ambientMagenta]
        }
        return [CloudPlayTokens.Color.Light.ambientBlue, CloudPlayTokens.Color.Light.ambientViolet, CloudPlayTokens.Color.Light.ambientMagenta]
    }

    /// Material strength for `.ultraThin` style glass surfaces.
    public var material: Material { isDark ? .ultraThinMaterial : .thinMaterial }

    public var corner: CGFloat { CloudPlayTokens.Radius.lg }
    public var cornerLarge: CGFloat { CloudPlayTokens.Radius.xl }
}

// MARK: - Ambient canvas

/// The Liquid Glass canvas: a deep base with three soft light sources. Used by
/// every screen so switching appearance changes the whole app at once.
public struct CloudPlayCanvas: View {
    @Environment(\.colorScheme) private var colorScheme
    public init() {}

    public var body: some View {
        let theme = CloudPlayTheme(colorScheme: colorScheme)
        ZStack {
            theme.canvas
            GeometryReader { proxy in
                let w = proxy.size.width
                let h = proxy.size.height
                ZStack {
                    Circle()
                        .fill(theme.ambient[0])
                        .frame(width: w * 0.9, height: w * 0.9)
                        .blur(radius: 90)
                        .opacity(theme.isDark ? 0.55 : 0.7)
                        .offset(x: -w * 0.25, y: -h * 0.28)
                    Circle()
                        .fill(theme.ambient[1])
                        .frame(width: w * 0.8, height: w * 0.8)
                        .blur(radius: 80)
                        .opacity(theme.isDark ? 0.45 : 0.55)
                        .offset(x: w * 0.3, y: -h * 0.1)
                    Circle()
                        .fill(theme.ambient[2])
                        .frame(width: w * 0.7, height: w * 0.7)
                        .blur(radius: 80)
                        .opacity(theme.isDark ? 0.35 : 0.3)
                        .offset(x: w * 0.1, y: h * 0.42)
                }
            }
        }
        .ignoresSafeArea()
    }
}

// MARK: - Glass surface modifier

public struct CloudPlayGlass: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme
    var corner: CGFloat?
    var padding: CGFloat
    var strong: Bool

    public func body(content: Content) -> some View {
        let theme = CloudPlayTheme(colorScheme: colorScheme)
        content
            .padding(padding)
            .background {
                RoundedRectangle(cornerRadius: corner ?? theme.cornerLarge, style: .continuous)
                    .fill(theme.material)
                    .overlay {
                        RoundedRectangle(cornerRadius: corner ?? theme.cornerLarge, style: .continuous)
                            .fill(strong ? theme.glassFillStrong : theme.glassFill)
                    }
            }
            .overlay {
                RoundedRectangle(cornerRadius: corner ?? theme.cornerLarge, style: .continuous)
                    .strokeBorder(theme.glassRim, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: corner ?? theme.cornerLarge, style: .continuous))
            .shadow(color: .black.opacity(theme.isDark ? 0.5 : 0.12), radius: 26, x: 0, y: 16)
    }
}

public extension View {
    /// Framed glass card used for every panel on Home, Settings and Profile.
    func cpGlass(corner: CGFloat? = nil, padding: CGFloat = 16, strong: Bool = false) -> some View {
        modifier(CloudPlayGlass(corner: corner, padding: padding, strong: strong))
    }

    /// Capsule glass control (buttons, chips, segmented items).
    func cpGlassPill(padding: CGFloat = 12) -> some View {
        modifier(CloudPlayGlass(corner: CloudPlayTokens.Radius.pill, padding: padding, strong: false))
    }

    /// Full-screen canvas behind a route.
    func cpCanvas() -> some View {
        background(CloudPlayCanvas())
    }
}

// MARK: - Motion

public enum CloudPlayMotion {
    /// iOS spring used for presses and sheet presentation.
    public static let spring = Animation.spring(response: 0.36, dampingFraction: 0.82)
    public static let page = Animation.spring(response: 0.52, dampingFraction: 0.9)
    public static let quick = Animation.easeOut(duration: CloudPlayTokens.Motion.fast)

    /// Returns no animation when Reduce Motion is on, so the system setting wins.
    public static func spring(reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : spring
    }
}

// MARK: - Environment

private struct CloudPlayThemeKey: EnvironmentKey {
    static let defaultValue: CloudPlayTheme? = nil
}

public extension EnvironmentValues {
    /// Explicit theme when a screen must not follow the system appearance.
    var cpTheme: CloudPlayTheme? {
        get { self[CloudPlayThemeKey.self] }
        set { self[CloudPlayThemeKey.self] = newValue }
    }
}
