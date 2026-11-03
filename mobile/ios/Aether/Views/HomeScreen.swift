// Stage 6: iOS Home Screen (SwiftUI)
// Inspired by Aether Design (brandDark: #0a0a0c, brandCard: #121217, cyanGlow: #00e5ff, magentaGlow: #ff2085, violetGlow: #7b30ff, amberGlow: #ffb000)

import SwiftUI

struct AetherHomeScreen: View {
    @State private var selectedTab = 0
    
    var body: some View {
        ZStack {
            Color(hex: "#0a0a0c").ignoresSafeArea() // brandDark
            
            VStack {
                // Header
                HStack {
                    Text("Aether")
                        .font(.system(size: 28, weight: .black))
                        .foregroundColor(Color(hex: "#00e5ff")) // cyanGlow
                    Spacer()
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.gray)
                    Image(systemName: "bell")
                        .foregroundColor(.gray)
                        .padding(.leading, 16)
                }
                .padding()
                
                // Content (Home, Search, Details, Playback)
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        Text("الرئيسية (Stage 4 Reference)")
                            .font(.title)
                            .fontWeight(.black)
                            .foregroundColor(.white)
                        
                        // Carousel Placeholder (SwiftUI equivalent of 3D Carousel)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 20) {
                                ForEach(0..<5) { i in
                                    RoundedRectangle(cornerRadius: 20)
                                        .fill(Color(hex: "#121217")) // brandCard
                                        .frame(width: 200, height: 300)
                                        .overlay(
                                            Text("TITLE \(i+1)")
                                                .foregroundColor(.white)
                                                .fontWeight(.black)
                                        )
                                        .border(Color(hex: "#00e5ff"), width: i == 2 ? 2 : 0) // Active glow
                                        .shadow(color: Color(hex: "#00e5ff").opacity(i == 2 ? 0.5 : 0), radius: 10)
                                }
                            }
                        }
                        .padding(.vertical, 20)
                        
                        // Trending Row
                        Text("الأكثر مشاهدة (TRENDING)")
                            .font(.headline)
                            .foregroundColor(.white)
                            .padding(.bottom, 8)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(0..<6) { i in
                                    VStack(alignment: .leading) {
                                        RoundedRectangle(cornerRadius: 10)
                                            .fill(Color(hex: "#121217"))
                                            .frame(width: 100, height: 150)
                                            .overlay(
                                                Text("TITLE \(i+1)")
                                                    .font(.caption)
                                                    .fontWeight(.bold)
                                                    .foregroundColor(.white)
                                            )
                                        Text("S1 • E\(i+1)")
                                            .font(.caption2)
                                            .foregroundColor(.gray)
                                    }
                                }
                            }
                        }
                    }
                    .padding()
                }
                
                // Bottom Nav
                HStack {
                    Spacer()
                    Button(action: {}) { Image(systemName: "house.fill").foregroundColor(Color(hex: "#00e5ff")) }
                    Spacer()
                    Button(action: {}) { Image(systemName: "tv.fill").foregroundColor(.gray) }
                    Spacer()
                    Button(action: {}) { Image(systemName: "arrow.down.circle.fill").foregroundColor(.gray) }
                    Spacer()
                    Button(action: {}) { Image(systemName: "person.fill").foregroundColor(.gray) }
                    Spacer()
                }
                .padding()
                .background(Color(hex: "#121217").opacity(0.95))
                .border(Color.white.opacity(0.1), width: 0.5)
            }
        }
    }
}

// Helper for Hex Colors
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: Double(a) / 255)
    }
}

struct AetherHomeScreen_Previews: PreviewProvider {
    static var previews: some View {
        AetherHomeScreen()
    }
}
