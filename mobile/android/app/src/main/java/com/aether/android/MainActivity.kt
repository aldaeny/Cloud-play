// MainActivity.kt — Aether Android (Phone) — Navigation + Theming
package com.aether.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavType
import androidx.navigation.compose.*
import com.aether.android.network.AetherClient
import com.aether.android.ui.AuthScreen
import com.aether.android.ui.PlayerScreen
import com.aether.android.ui.ProfileScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AetherTheme {
                val navController = rememberNavController()
                val api = AetherClient.api
                var authToken by remember { mutableStateOf<String?>(null) }

                Surface(modifier = Modifier.fillMaxSize()) {
                    if (authToken == null) {
                        AuthScreen(api, onLoginSuccess = { token -> authToken = token })
                    } else {
                        AetherNavHost(
                            navController = navController,
                            api = api,
                            authToken = authToken!!,
                            onLogout = { authToken = null }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AetherTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF00E5FF),
            secondary = Color(0xFFFF2085),
            tertiary = Color(0xFF7B30FF),
            background = Color(0xFF0A0A0C),
            surface = Color(0xFF121217)
        ),
        content = content
    )
}

@Composable
private fun AetherNavHost(
    navController: NavHostController,
    api: com.aether.android.network.AetherApi,
    authToken: String,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            Scaffold(
                bottomBar = { AetherBottomBar(currentRoute) { navController.navigate(it) } },
                topBar = { AetherTopBar("الرئيسية") }
            ) { padding ->
                // Home content — catalog rows, continue watching
                Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                    Text("Aether Home", color = Color(0xFF00E5FF),
                        fontWeight = FontWeight.Black, fontSize = 28.sp)
                    Text("VOD First — Signed HLS Playback", color = Color.White)
                    // Home rows would load from api.getHome(authToken)
                }
            }
        }

        composable("search") {
            Scaffold(
                bottomBar = { AetherBottomBar(currentRoute) { navController.navigate(it) } },
                topBar = { AetherTopBar("بحث") }
            ) { padding ->
                Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                    Text("Search", color = Color.White, fontWeight = FontWeight.Bold)
                    // Search bar + results from api.search()
                }
            }
        }

        composable("profiles") {
            Scaffold(
                bottomBar = { AetherBottomBar(currentRoute) { navController.navigate(it) } },
                topBar = { AetherTopBar("الملفات") }
            ) { padding ->
                ProfileScreen(api, authToken)
            }
        }

        composable(
            route = "player/{titleId}",
            arguments = listOf(navArgument("titleId") { type = NavType.StringType })
        ) { backStackEntry ->
            val titleId = backStackEntry.arguments?.getString("titleId") ?: return@composable
            PlayerScreen(
                context = androidx.compose.ui.platform.LocalContext.current,
                api = api,
                authToken = authToken,
                titleId = titleId,
                onEnded = { navController.popBackStack() }
            )
        }
    }
}

@Composable
private fun AetherTopBar(title: String) {
    TopAppBar(
        title = { Text(title, color = Color.White, fontWeight = FontWeight.Bold) },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = Color(0xFF0A0A0C),
            titleContentColor = Color.White
        )
    )
}

@Composable
private fun AetherBottomBar(current: String?, onNavigate: (String) -> Unit) {
    NavigationBar(
        containerColor = Color(0xFF0A0A0C)
    ) {
        val items = listOf(
            Triple("home", "الرئيسية", Icons.Default.Home),
            Triple("search", "بحث", Icons.Default.Search),
            Triple("profiles", "الملفات", Icons.Default.Person)
        )
        items.forEach { (route, label, icon) ->
            NavigationBarItem(
                selected = current == route,
                onClick = { onNavigate(route) },
                icon = { Icon(icon, contentDescription = label) },
                label = { Text(label) },
                colors = NavigationBarItemDefaults.colors(
                    indicatorColor = Color(0xFF121217),
                    selectedIconColor = Color(0xFF00E5FF),
                    selectedTextColor = Color(0xFF00E5FF),
                    unselectedIconColor = Color(0xFF888888),
                    unselectedTextColor = Color(0xFF888888)
                )
            )
        }
    }
}
