// CloudPlayTheme.kt — Liquid Glass appearance layer for Android / Android TV.
//
// `CloudPlayTokens` is generated from packages/ui-tokens/tokens.json and is
// shared with the web app and iOS. This file maps those raw values onto
// Material 3, adds the glass surface modifier and the spring motion specs so
// every Compose screen follows one identity in dark, light, RTL and LTR.

package com.aether.android.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring

/** Same three modes as the web `cloudplay-theme` preference. */
enum class CloudPlayAppearance(val ar: String, val en: String) {
    SYSTEM("تلقائي", "Automatic"),
    DARK("داكن", "Dark"),
    BLACK("أسود", "Black"),
    LIGHT("فاتح", "Light");

    companion object {
        fun from(value: String?): CloudPlayAppearance =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: SYSTEM
    }
}

/** Semantic colours for one appearance, derived only from the shared tokens. */
@Immutable
data class CloudPlayColors(
    val isDark: Boolean,
    val canvas: Color,
    val canvasRaised: Color,
    val ink: Color,
    val inkSecondary: Color,
    val inkTertiary: Color,
    val glass: Color,
    val glassStrong: Color,
    val glassSolid: Color,
    val glassRim: Color,
    val glassRimStrong: Color,
    val accent: Color,
    val accentStrong: Color,
    val accentMagenta: Color,
    val success: Color,
    val warning: Color,
    val danger: Color,
    val ambient: List<Color>,
)

fun cloudPlayColors(dark: Boolean): CloudPlayColors = if (dark) {
    CloudPlayColors(
        isDark = true,
        canvas = CloudPlayTokens.Dark.canvas,
        canvasRaised = CloudPlayTokens.Dark.canvasRaised,
        ink = CloudPlayTokens.Dark.textPrimary,
        inkSecondary = CloudPlayTokens.Dark.textSecondary,
        inkTertiary = CloudPlayTokens.Dark.textTertiary,
        glass = CloudPlayTokens.Dark.glass1,
        glassStrong = CloudPlayTokens.Dark.glass2,
        glassSolid = CloudPlayTokens.Dark.glassSolid,
        glassRim = CloudPlayTokens.Dark.glassRim,
        glassRimStrong = CloudPlayTokens.Dark.glassRimStrong,
        accent = CloudPlayTokens.Dark.accent,
        accentStrong = CloudPlayTokens.Dark.accentStrong,
        accentMagenta = CloudPlayTokens.Dark.accentMagenta,
        success = CloudPlayTokens.Dark.success,
        warning = CloudPlayTokens.Dark.warning,
        danger = CloudPlayTokens.Dark.danger,
        ambient = listOf(
            CloudPlayTokens.Dark.ambientBlue,
            CloudPlayTokens.Dark.ambientViolet,
            CloudPlayTokens.Dark.ambientMagenta,
        ),
    )
} else {
    CloudPlayColors(
        isDark = false,
        canvas = CloudPlayTokens.Light.canvas,
        canvasRaised = CloudPlayTokens.Light.canvasRaised,
        ink = CloudPlayTokens.Light.textPrimary,
        inkSecondary = CloudPlayTokens.Light.textSecondary,
        inkTertiary = CloudPlayTokens.Light.textTertiary,
        glass = CloudPlayTokens.Light.glass1,
        glassStrong = CloudPlayTokens.Light.glass2,
        glassSolid = CloudPlayTokens.Light.glassSolid,
        glassRim = CloudPlayTokens.Light.glassRim,
        glassRimStrong = CloudPlayTokens.Light.glassRimStrong,
        accent = CloudPlayTokens.Light.accent,
        accentStrong = CloudPlayTokens.Light.accentStrong,
        accentMagenta = CloudPlayTokens.Light.accentMagenta,
        success = CloudPlayTokens.Light.success,
        warning = CloudPlayTokens.Light.warning,
        danger = CloudPlayTokens.Light.danger,
        ambient = listOf(
            CloudPlayTokens.Light.ambientBlue,
            CloudPlayTokens.Light.ambientViolet,
            CloudPlayTokens.Light.ambientMagenta,
        ),
    )
}

val LocalCloudPlayColors = staticCompositionLocalOf { cloudPlayColors(dark = true) }

val CloudPlayShapes = Shapes(
    extraSmall = RoundedCornerShape(CloudPlayTokens.Radius.xs),
    small = RoundedCornerShape(CloudPlayTokens.Radius.sm),
    medium = RoundedCornerShape(CloudPlayTokens.Radius.md),
    large = RoundedCornerShape(CloudPlayTokens.Radius.lg),
    extraLarge = RoundedCornerShape(CloudPlayTokens.Radius.xl),
)

/** Type scale in sp; Arabic reads at the same size with a taller line height. */
@Composable
fun cloudPlayTypography(colors: CloudPlayColors): Typography {
    val isArabic = LocalConfiguration.current.locales[0].language == "ar"
    fun style(size: Int, weight: FontWeight, height: Float) = TextStyle(
        fontSize = size.sp,
        fontWeight = weight,
        lineHeight = (size * (if (isArabic) height + 0.15f else height)).sp,
    )
    return Typography(
        displayLarge = style(34, FontWeight.Bold, 1.2f),
        headlineMedium = style(26, FontWeight.Bold, 1.25f),
        titleLarge = style(20, FontWeight.SemiBold, 1.3f),
        titleMedium = style(16, FontWeight.SemiBold, 1.4f),
        bodyLarge = style(15, FontWeight.Normal, 1.65f),
        bodyMedium = style(14, FontWeight.Normal, 1.65f),
        labelLarge = style(13, FontWeight.SemiBold, 1.4f),
        labelSmall = style(11, FontWeight.Medium, 1.4f),
    )
}

private fun m3Scheme(colors: CloudPlayColors, dark: Boolean) = if (dark) {
    darkColorScheme(
        primary = colors.accent,
        onPrimary = CloudPlayTokens.Dark.textOnAccent,
        primaryContainer = colors.accentStrong,
        secondary = colors.accentMagenta,
        tertiary = colors.accentStrong,
        background = colors.canvas,
        onBackground = colors.ink,
        surface = colors.glassSolid,
        onSurface = colors.ink,
        surfaceVariant = colors.glassStrong,
        onSurfaceVariant = colors.inkSecondary,
        outline = colors.glassRimStrong,
        error = colors.danger,
    )
} else {
    lightColorScheme(
        primary = colors.accent,
        onPrimary = CloudPlayTokens.Light.textOnAccent,
        primaryContainer = colors.accentStrong,
        secondary = colors.accentMagenta,
        tertiary = colors.accentStrong,
        background = colors.canvas,
        onBackground = colors.ink,
        surface = colors.glassSolid,
        onSurface = colors.ink,
        surfaceVariant = colors.glassStrong,
        onSurfaceVariant = colors.inkSecondary,
        outline = colors.glassRimStrong,
        error = colors.danger,
    )
}

/**
 * The single theme entry point. Pass the stored preference; `null`/`SYSTEM`
 * follows the device and re-composes when the system appearance changes.
 */
@Composable
fun CloudPlayTheme(
    appearance: CloudPlayAppearance = CloudPlayAppearance.SYSTEM,
    content: @Composable () -> Unit,
) {
    val systemDark = isSystemInDarkTheme()
    val dark = when (appearance) {
        CloudPlayAppearance.SYSTEM -> systemDark
        CloudPlayAppearance.DARK, CloudPlayAppearance.BLACK -> true
        CloudPlayAppearance.LIGHT -> false
    }
    val colors = cloudPlayColors(dark)
    CompositionLocalProvider(LocalCloudPlayColors provides colors) {
        MaterialTheme(
            colorScheme = m3Scheme(colors, dark),
            typography = cloudPlayTypography(colors),
            shapes = CloudPlayShapes,
            content = content,
        )
    }
}

/** Convenience accessor: `CloudPlayTheme.colors.accent`. */
object CloudPlayTheme {
    val colors: CloudPlayColors
        @Composable get() = LocalCloudPlayColors.current
}

/**
 * Glass surface: translucent fill, 1dp rim, continuous corner, soft shadow.
 * Use `strong = true` for raised sheets and the player chrome.
 */
fun Modifier.cpGlass(
    corner: androidx.compose.ui.unit.Dp = CloudPlayTokens.Radius.lg,
    strong: Boolean = false,
    elevated: Boolean = true,
    colors: CloudPlayColors = cloudPlayColors(dark = true),
): Modifier {
    val shape = RoundedCornerShape(corner)
    var modifier = this
        .clip(shape)
        .background(if (strong) colors.glassStrong else colors.glass, shape)
        .border(1.dp, colors.glassRim, shape)
    if (elevated) {
        modifier = modifier.shadow(
            elevation = 18.dp,
            shape = shape,
            ambientColor = colors.canvas,
            spotColor = colors.canvas,
        )
    }
    return modifier
}

/** Ambient canvas brush shared by every screen background. */
fun cloudPlayCanvasBrush(colors: CloudPlayColors): Brush = Brush.linearGradient(
    listOf(colors.canvas, colors.canvasRaised, colors.canvas)
)

/** Logical direction helper: Arabic is RTL, English is LTR. */
@Composable
fun cloudPlayLayoutDirection(language: String): LayoutDirection =
    if (language == "ar") LayoutDirection.Rtl else LayoutDirection.Ltr

/** iOS-style spring motion, mirroring the web `--cp-ease-spring`. */
object CloudPlayMotion {
    fun <T> spring(damping: Float = 0.82f) =
        spring<T>(dampingRatio = damping, stiffness = Spring.StiffnessMediumLow)

    val fast get() = spring<Float>(dampingRatio = 0.9f, stiffness = Spring.StiffnessMedium)
}

/** Padding helper so screens share the glass rhythm instead of magic numbers. */
fun Modifier.cpScreenPadding() = padding(horizontal = 20.dp, vertical = 16.dp)
