// ProfileScreen.kt — User Profiles with PIN (Compose)
package com.aether.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.KidFriendly
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aether.android.network.AetherApi
import com.aether.android.network.CreateProfileRequest
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(
    api: AetherApi,
    authToken: String
) {
    var profiles by remember { mutableStateOf<List<com.aether.android.network.Profile>>(emptyList()) }
    var showAdd by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val resp = api.getProfiles(authToken)
            profiles = resp.data ?: emptyList()
        } catch (e: Exception) {
            error = e.message ?: "خطأ"
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF0A0A0C)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "الملفات الشخصية",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )

            if (profiles.isEmpty() && !showAdd) {
                Text("لا توجد ملفات شخصية", color = Color(0xFF888888))
            }

            profiles.forEach { profile ->
                ProfileCard(
                    profile = profile,
                    onClick = { /* navigate to profile content */ }
                )
            }

            if (showAdd) {
                AddProfileForm(
                    api = api,
                    authToken = authToken,
                    onAdded = {
                        showAdd = false
                        val resp = scope.runBlocking { api.getProfiles(authToken) }
                        profiles = resp.data ?: emptyList()
                    },
                    onCancel = { showAdd = false }
                )
            } else {
                Button(
                    onClick = { showAdd = true },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF7B30FF),
                        contentColor = Color.White
                    )
                ) {
                    Text("إضافة ملف شخصي")
                }
            }
        }
    }
}

@Composable
private fun ProfileCard(profile: com.aether.android.network.Profile, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        color = Color(0xFF121217),
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF00E5FF)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = profile.name.take(1).uppercase(),
                    color = Color(0xFF0A0A0C),
                    fontWeight = FontWeight.Black
                )
            }
            Column {
                Text(profile.name, color = Color.White, fontWeight = FontWeight.Bold)
                if (profile.isKid) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.KidFriendly, contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = Color(0xFFFFB000))
                        Text("(", color = Color(0xFFFFB000), fontSize = 12.sp)
                        Text("طفل", color = Color(0xFFFFB000), fontSize = 12.sp)
                        Text(")", color = Color(0xFFFFB000), fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AddProfileForm(
    api: AetherApi,
    authToken: String,
    onAdded: () -> Unit,
    onCancel: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var isKid by remember { mutableStateOf(false) }
    var pin by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = name, onValueChange = { name = it },
            label = { Text("اسم الملف") }, singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                focusedBorderColor = Color(0xFF00E5FF)
            )
        )
        OutlinedTextField(
            value = pin, onValueChange = { pin = it },
            label = { Text("رمز PIN (اختياري)") }, singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                focusedBorderColor = Color(0xFF00E5FF)
            )
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = isKid, onCheckedChange = { isKid = it },
                colors = CheckboxDefaults.colors(checkedColor = Color(0xFF00E5FF))
            )
            Text("وضع الأطفال", color = Color.White)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = onCancel, colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF333333), contentColor = Color.White
            )) { Text("Cancel") }
            Button(onClick = {
                loading = true
                scope.launch {
                    try {
                        api.createProfile(authToken, CreateProfileRequest(name, isKid, null, pin.ifEmpty { null }))
                        onAdded()
                    } catch (_: Exception) { }
                    finally { loading = false }
                }
            }, enabled = !loading, colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF00E5FF), contentColor = Color(0xFF0A0A0C)
            )) { Text("إضافة") }
        }
    }
}
