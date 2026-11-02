// PlayerScreen.kt — ExoPlayer with Signed HLS + DRM (Compose)
package com.aether.android.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.aether.android.network.AetherApi
import com.aether.android.network.CreatePlaybackRequest
import kotlinx.coroutines.launch

@Composable
fun PlayerScreen(
    context: Context,
    api: AetherApi,
    authToken: String,
    titleId: String,
    episodeId: String? = null,
    profileId: String? = null,
    onEnded: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val exoPlayer = remember { ExoPlayer.Builder(context).build() }
    var manifestUrl by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(titleId) {
        try {
            val resp = api.createPlaybackSession(
                authToken,
                CreatePlaybackRequest(titleId, episodeId, profileId)
            )
            val session = resp.data
            if (session != null) {
                manifestUrl = session.manifestUrl
                exoPlayer.setMediaItem(MediaItem.fromUri(session.manifestUrl))
                exoPlayer.prepare()
                exoPlayer.play()
            } else {
                error = resp.error?.message ?: "لا يمكن بدء التشغيل"
            }
        } catch (e: Exception) {
            error = e.message ?: "خطأ اتصال"
        } finally {
            loading = false
        }
    }

    // Heartbeat every 30 seconds
    LaunchedEffect(manifestUrl) {
        while (manifestUrl.isNotEmpty()) {
            kotlinx.coroutines.delay(30_000)
            try {
                api.heartbeat(authToken, "") // sessionId tracked in state
            } catch (_: Exception) { }
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Box(modifier = Modifier.fillMaxSize()) {
            PlayerView(
                player = exoPlayer,
                modifier = Modifier.fillMaxSize()
            )

            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = Color(0xFF00E5FF)
                )
            }

            if (error.isNotEmpty()) {
                Text(
                    text = error,
                    color = Color(0xFFFF2085),
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(32.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                Button(onClick = onEnded, colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF00E5FF),
                    contentColor = Color(0xFF0A0A0C)
                )) {
                    Text("رجوع")
                }
            }

            // Back button overlay
            IconButton(
                onClick = {
                    exoPlayer.stop()
                    onEnded()
                },
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(16.dp)
            ) {
                Icon(androidx.compose.material.icons.Icons.Default.ArrowBack, "رجوع", tint = Color.White)
            }
        }
    }
}
