// TvHomeScreen.kt — Android TV Home (Leanback + Compose, D-Pad focus)
package com.aether.android.tv

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun TvHomeScreen(onNavigateToPlayer: (String) -> Unit) {
    var selectedRow by remember { mutableStateOf(0) }
    val rows = listOf(
        HomeRow(title = "الأعمال الجديدة", items = listOf("1", "2", "3", "4", "5")),
        HomeRow(title = "الأكثر مشاهدة", items = listOf("6", "7", "8", "9", "10")),
        HomeRow(title = "متابعة المشاهدة", items = listOf("11", "12", "13"))
    )

    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF0A0A0C)) {
        Column(modifier = Modifier.fillMaxSize().padding(32.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Aether", fontSize = 32.sp, fontWeight = FontWeight.Black,
                    color = Color(0xFF00E5FF))
                Spacer(modifier = Modifier.width(16.dp))
                Icon(Icons.Default.Search, contentDescription = "بحث", tint = Color(0xFF888888))
            }
            Spacer(modifier = Modifier.height(32.dp))

            for ((index, row) in rows.withIndex()) {
                Text(row.title, fontSize = 20.sp, fontWeight = FontWeight.Bold,
                    color = Color.White, modifier = Modifier.padding(bottom = 12.dp))
                HorizontalScrollableRow(
                    rowIndex = index,
                    selectedRow = selectedRow,
                    items = row.items,
                    onSelect = { selectedRow = index },
                    onItemClick = { onNavigateToPlayer(it) }
                )
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

private data class HomeRow(title: String, items: List<String>)

@Composable
private fun HorizontalScrollableRow(
    rowIndex: Int,
    selectedRow: Int,
    items: List<String>,
    onSelect: (Int) -> Unit,
    onItemClick: (String) -> Unit
) {
    val focusStates = remember { mutableStateListOf<Boolean>() }
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        items.forEachIndexed { i, item ->
            var focused by remember { mutableStateOf(false) }
            val isFocused = rowIndex == selectedRow && focused
            Card(
                modifier = Modifier
                    .size(280.dp, 160.dp)
                    .focusable()
                    .onFocusChanged { focused = it.isFocused; if (focused) onSelect(rowIndex) },
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFF121217),
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(16.dp),
                onClick = { onItemClick(item) }
            ) {
                Column(modifier = Modifier.fillMaxSize().padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.SpaceBetween) {
                    Box(modifier = Modifier.size(48.dp).clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF00E5FF)))
                    Text("TITLE ${i + 1}", fontWeight = FontWeight.Black)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.PlayArrow, contentDescription = "تشغيل",
                            modifier = Modifier.size(24.dp),
                            tint = if (isFocused) Color(0xFF00E5FF) else Color(0xFF888888))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("تشغيل", fontSize = 14.sp,
                            color = if (isFocused) Color(0xFF00E5FF) else Color(0xFF888888))
                    }
                }
            }
        }
    }
}
