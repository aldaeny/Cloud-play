// TvHomeScreen.swift — tvOS Home with Focus Engine
import SwiftUI

struct TvHomeScreen: View {
    @FocusState private var focusedItem: Int?
    @State private var selectedRow = 0

    private let rows: [HomeRow] = [
        HomeRow(title: "الأعمال الجديدة", items: Array(1...5)),
        HomeRow(title: "الأكثر مشاهدة", items: Array(6...10)),
        HomeRow(title: "متابعة المشاهدة", items: Array(11...13))
    ]

    var body: some View {
        ZStack {
            AetherColors.brandDark.ignoresSafeArea()
            VStack(spacing: 24) {
                HStack {
                    Text("Aether")
                        .font(.system(size: 32, weight: .black))
                        .foregroundColor(AetherColors.cyanGlow)
                    Spacer()
                }
                .padding()

                ScrollView {
                    VStack(spacing: 24) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(row.title)
                                    .font(.headline)
                                    .foregroundColor(.white)

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 24) {
                                        ForEach(Array(row.items.enumerated()), id: \.offset) { itemIndex, item in
                                            TitleCardTV(
                                                title: "TITLE \(item)",
                                                isFocused: selectedRow == index
                                            )
                                            .focusable()
                                            .focused($focusedItem, equals: index * 100 + itemIndex)
                                            .onChange(of: focusedItem) { newValue in
                                                if let value = newValue {
                                                    selectedRow = value / 100
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding()
                }
            }
        }
    }
}

struct TitleCardTV: View {
    let title: String
    let isFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 16)
                .fill(AetherColors.brandCard)
                .frame(width: 280, height: 160)
                .overlay(
                    Text(title)
                        .foregroundColor(.white)
                        .fontWeight(.black)
                        .multilineTextAlignment(.center)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(
                            isFocused ? Color(hex: "#00e5ff") : Color.clear,
                            lineWidth: isFocused ? 3 : 0
                        )
                )
                .shadow(
                    color: isFocused ? Color(hex: "#00e5ff").opacity(0.5) : Color.clear,
                    radius: 10
                )

            HStack {
                Image(systemName: "play.fill")
                    .foregroundColor(isFocused ? AetherColors.cyanGlow : AetherColors.gray)
                Text("تشغيل")
                    .foregroundColor(isFocused ? AetherColors.cyanGlow : AetherColors.gray)
            }
        }
    }
}

struct HomeRow: Identifiable {
    let id = UUID()
    let title: String
    let items: [Int]
}

#Preview {
    TvHomeScreen()
}
