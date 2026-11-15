// AUTO-GENERATED from packages/ui-tokens/tokens.json — do not edit by hand.
import SwiftUI

/// Cloud Play — universal Liquid Glass tokens shared with Web and Android.
public enum CloudPlayTokens {
  public enum Color {
    /// Dark Liquid Glass
    public static let canvas = Color(hex: 0x05060A)
    public static let canvasRaised = Color(hex: 0x0A0C12)
    public static let canvasSunken = Color(hex: 0x030409)
    public static let ambientBlue = Color(hex: 0x1F3A7A)
    public static let ambientViolet = Color(hex: 0x40206F)
    public static let ambientMagenta = Color(hex: 0x5A1236)
    public static let glass1 = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.055)
    public static let glass2 = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.085)
    public static let glass3 = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.125)
    public static let glassSolid = Color(hex: 0x14161E)
    public static let glassRim = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.13)
    public static let glassRimStrong = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.26)
    public static let glassHighlight = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.42)
    public static let glassShadow = Color(red: 0.000, green: 0.000, blue: 0.000, opacity: 0.55)
    public static let textPrimary = Color(hex: 0xF5F7FC)
    public static let textSecondary = Color(red: 0.914, green: 0.933, blue: 0.976, opacity: 0.72)
    public static let textTertiary = Color(red: 0.914, green: 0.933, blue: 0.976, opacity: 0.48)
    public static let textOnAccent = Color(hex: 0xFFFFFF)
    public static let accent = Color(hex: 0x7AA2FF)
    public static let accentStrong = Color(hex: 0x9B7BFF)
    public static let accentSoft = Color(red: 0.478, green: 0.635, blue: 1.000, opacity: 0.16)
    public static let accentMagenta = Color(hex: 0xFF5FA2)
    public static let success = Color(hex: 0x4ADE80)
    public static let warning = Color(hex: 0xFBBF24)
    public static let danger = Color(hex: 0xFB7185)
    public static let focus = Color(hex: 0xB9D2FF)

    /// Light Liquid Glass
    public enum Light {
      public static let canvas = Color(hex: 0xEEF1F7)
      public static let canvasRaised = Color(hex: 0xF7F9FD)
      public static let canvasSunken = Color(hex: 0xE3E8F1)
      public static let ambientBlue = Color(hex: 0xC9DBFF)
      public static let ambientViolet = Color(hex: 0xDCCBFF)
      public static let ambientMagenta = Color(hex: 0xFFD3E6)
      public static let glass1 = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.52)
      public static let glass2 = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.70)
      public static let glass3 = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.88)
      public static let glassSolid = Color(hex: 0xFFFFFF)
      public static let glassRim = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.92)
      public static let glassRimStrong = Color(red: 0.075, green: 0.129, blue: 0.243, opacity: 0.14)
      public static let glassHighlight = Color(red: 1.000, green: 1.000, blue: 1.000, opacity: 0.96)
      public static let glassShadow = Color(red: 0.118, green: 0.188, blue: 0.337, opacity: 0.16)
      public static let textPrimary = Color(hex: 0x0C1526)
      public static let textSecondary = Color(red: 0.078, green: 0.129, blue: 0.216, opacity: 0.70)
      public static let textTertiary = Color(red: 0.078, green: 0.129, blue: 0.216, opacity: 0.48)
      public static let textOnAccent = Color(hex: 0xFFFFFF)
      public static let accent = Color(hex: 0x2F5FD0)
      public static let accentStrong = Color(hex: 0x7A3CF0)
      public static let accentSoft = Color(red: 0.184, green: 0.373, blue: 0.816, opacity: 0.10)
      public static let accentMagenta = Color(hex: 0xC2185B)
      public static let success = Color(hex: 0x15803D)
      public static let warning = Color(hex: 0xB45309)
      public static let danger = Color(hex: 0xBE123C)
      public static let focus = Color(hex: 0x2F5FD0)
    }
  }

  public enum Radius {
    public static let xs: CGFloat = 8
    public static let sm: CGFloat = 12
    public static let md: CGFloat = 16
    public static let lg: CGFloat = 22
    public static let xl: CGFloat = 28
    public static let r2xl: CGFloat = 36
    public static let pill: CGFloat = 999
  }

  public enum Type {
    public static let arabic = "IBM Plex Sans Arabic"
    public static let latin = "Plus Jakarta Sans"
  }

  public enum Motion {
    public static let instant = 0.09
    public static let fast = 0.18
    public static let base = 0.28
    public static let slow = 0.42
    public static let page = 0.56
  }

  public enum Control {
    public static let heightSm: CGFloat = 34
    public static let heightMd: CGFloat = 44
    public static let heightLg: CGFloat = 52
    public static let iconSm: CGFloat = 36
    public static let iconMd: CGFloat = 44
    public static let iconLg: CGFloat = 54
    public static let touchTarget: CGFloat = 44
    public static let tvTarget: CGFloat = 64
  }
}

public extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}
