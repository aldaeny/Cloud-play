// TvMainActivity.kt — Android TV entry point
package com.aether.android.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.aether.android.designsystem.CloudPlayAppearance
import com.aether.android.designsystem.CloudPlayTheme

class TvMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CloudPlayTheme(appearance = CloudPlayAppearance.DARK) {
                TvHomeScreen(onNavigateToPlayer = { titleId -> /* launch PlayerScreen */ })
            }
        }
    }
}
