// TvMainActivity.kt — Android TV entry point
package com.aether.android.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

class TvMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(
                primary = Color(0xFF00E5FF),
                secondary = Color(0xFFFF2085),
                background = Color(0xFF0A0A0C),
                surface = Color(0xFF121217)
            )) {
                TvHomeScreen(onNavigateToPlayer = { titleId -> /* launch PlayerScreen */ })
            }
        }
    }
}
