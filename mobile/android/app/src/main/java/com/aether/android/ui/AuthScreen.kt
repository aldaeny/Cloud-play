// AuthScreen.kt — Registration & Login (Compose)
package com.aether.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aether.android.network.AetherApi
import com.aether.android.network.LoginRequest
import com.aether.android.network.RegisterRequest
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    api: AetherApi,
    onLoginSuccess: (String) -> Unit
) {
    var isRegister by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFF0A0A0C)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Aether",
                fontSize = 36.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF00E5FF)
            )
            Text(
                text = if (isRegister) "إنشاء حساب جديد" else "مرحباً بك",
                fontSize = 18.sp,
                color = Color.White
            )

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("البريد الإلكتروني") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = Color(0xFF00E5FF),
                    unfocusedBorderColor = Color(0xFF333333)
                )
            )

            if (isRegister) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("الاسم") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF00E5FF)
                    )
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("رقم الهاتف") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF00E5FF)
                    )
                )
            }

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("كلمة المرور") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = Color(0xFF00E5FF)
                )
            )

            if (error.isNotEmpty()) {
                Text(text = error, color = Color(0xFFFF2085), fontSize = 14.sp)
            }

            Button(
                onClick = {
                    loading = true
                    error = ""
                    scope.launch {
                        try {
                            if (isRegister) {
                                api.register(RegisterRequest(email, password, name, phone))
                                onLoginSuccess(email)
                            } else {
                                val resp = api.login(LoginRequest(email, password))
                                resp.data?.let { onLoginSuccess(it.accessToken) }
                                ?: run { error = resp.error?.message ?: "خطأ في الدخول" }
                            }
                        } catch (e: Exception) {
                            error = e.message ?: "خطأ اتصال"
                        } finally {
                            loading = false
                        }
                    }
                },
                enabled = !loading,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF00E5FF),
                    contentColor = Color(0xFF0A0A0C)
                )
            ) {
                Text(if (loading) "جارٍ التحميل…" else if (isRegister) "تسجيل" else "دخول")
            }

            TextButton(onClick = { isRegister = !isRegister }) {
                Text(
                    text = if (isRegister) "لديك حساب؟ سجل دخول" else "لا تملك حساب؟ سجل الآن",
                    color = Color(0xFF888888)
                )
            }
        }
    }
}
