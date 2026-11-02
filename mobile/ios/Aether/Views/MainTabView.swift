// MainTabView.swift — Main Tab Navigation (iOS/tvOS)
import SwiftUI

struct MainTabView: View {
    let api: AetherAPI
    let authToken: String
    let onLogout: () -> Void

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(api: api, authToken: authToken)
                .tabItem {
                    Label("الرئيسية", systemImage: "house.fill")
                }
                .tag(0)

            SearchView(api: api, authToken: authToken)
                .tabItem {
                    Label("بحث", systemImage: "magnifyingglass")
                }
                .tag(1)

            ProfileView(api: api, authToken: authToken)
                .tabItem {
                    Label("الملفات", systemImage: "person.fill")
                }
                .tag(2)
        }
        .tint(AetherColors.cyanGlow)
        .preferredColorScheme(.dark)
    }
}

struct HomeView: View {
    let api: AetherAPI
    let authToken: String
    @State private var homeData: HomeResponse?

    var body: some View {
        ZStack {
            AetherColors.brandDark.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    HStack {
                        Text("Aether")
                            .font(.system(size: 28, weight: .black))
                            .foregroundColor(AetherColors.cyanGlow)
                        Spacer()
                    }
                    .padding()

                    if let homeData = homeData {
                        ForEach(homeData.rows) { row in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(row.title)
                                    .font(.headline)
                                    .foregroundColor(.white)
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 16) {
                                        ForEach(row.items) { title in
                                            TitleCard(title: title)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    } else {
                        ProgressView()
                            .scaleEffect(1.5)
                            .foregroundColor(AetherColors.cyanGlow)
                    }
                }
                .padding(.bottom, 20)
            }
        }
        .task {
            do {
                homeData = try await api.getHome(token: authToken)
            } catch {
                // handle error
            }
        }
    }
}

struct SearchView: View {
    let api: AetherAPI
    let authToken: String
    @State private var query = ""
    @State private var results: [Title] = []

    var body: some View {
        ZStack {
            AetherColors.brandDark.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(AetherColors.gray)
                    TextField("ابحث عن محتوى…", text: $query)
                        .textFieldStyle(.plain)
                        .foregroundColor(.white)
                    Button(action: { Task { await search() } }) {
                        Image(systemName: "arrow.magnifyingglass.circle.fill")
                            .foregroundColor(AetherColors.cyanGlow)
                    }
                }
                .padding()
                .background(AetherColors.brandCard)
                .cornerRadius(12)
                .padding(.horizontal)

                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(results) { title in
                            TitleRow(title: title)
                        }
                    }
                    .padding()
                }
            }
        }
    }

    private func search() async {
        do {
            results = try await api.search(token: authToken, query: query.isEmpty ? nil : query)
        } catch {
            // handle error
        }
    }
}

struct TitleCard: View {
    let title: Title
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 12)
                .fill(AetherColors.brandCard)
                .frame(width: 140, height: 200)
                .overlay(
                    Text(title.titleEn ?? title.titleAr ?? "TITLE")
                        .foregroundColor(.white)
                        .fontWeight(.bold)
                        .font(.system(size: 12))
                        .multilineTextAlignment(.center)
                )
            Text(title.kind == "series" ? "مسلسل" : "فيلم")
                .font(.caption2)
                .foregroundColor(AetherColors.gray)
        }
    }
}

struct TitleRow: View {
    let title: Title
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(AetherColors.brandCard)
                .frame(width: 80, height: 120)
                .overlay(
                    Text(title.titleEn ?? title.titleAr ?? "TITLE")
                        .foregroundColor(.white)
                        .font(.system(size: 10))
                )
            VStack(alignment: .leading, spacing: 4) {
                Text(title.titleEn ?? title.titleAr ?? "Untitled")
                    .foregroundColor(.white)
                    .fontWeight(.bold)
                Text(title.kind == "series" ? "مسلسل" : "فيلم")
                    .font(.caption)
                    .foregroundColor(AetherColors.gray)
                if let rating = title.maturityRating {
                    Text("التصنيف: \(rating)")
                        .font(.caption2)
                        .foregroundColor(AetherColors.amberGlow)
                }
            }
            Spacer()
        }
        .padding()
        .background(AetherColors.brandCard)
        .cornerRadius(12)
    }
}
