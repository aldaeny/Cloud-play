// ProfileView.swift — User Profiles (SwiftUI)
import SwiftUI

struct ProfileView: View {
    let api: AetherAPI
    let authToken: String

    @State private var profiles: [Profile] = []
    @State private var showAdd = false
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        ZStack {
            AetherColors.brandDark.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Text("الملفات الشخصية")
                        .font(.system(size: 24, weight: .black))
                        .foregroundColor(.white)

                    if profiles.isEmpty && !showAdd {
                        Text("لا توجد ملفات شخصية")
                            .foregroundColor(AetherColors.gray)
                    }

                    ForEach(profiles) { profile in
                        ProfileCard(profile: profile)
                    }

                    if showAdd {
                        AddProfileForm(api: api, authToken: authToken, onAdded: {
                            showAdd = false
                            await loadProfiles()
                        }, onCancel: { showAdd = false })
                    }
                }
                .padding()
            }

            if showAdd {
                Button("رجوع", action: { showAdd = false })
                    .padding(16)
                    .foregroundColor(.white)
            }

            VStack {
                Spacer()
                Button("إضافة ملف شخصي") { showAdd = true }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(AetherColors.violetGlow)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
            .padding()
        }
        .task { await loadProfiles() }
    }

    private func loadProfiles() async {
        do {
            profiles = try await api.getProfiles(token: authToken)
        } catch {
            error = (error as? APIError)?.message
        }
    }
}

struct ProfileCard: View {
    let profile: Profile
    var body: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(AetherColors.cyanGlow)
                .frame(width: 48, height: 48)
                .overlay(
                    Text(profile.name.prefix(1).uppercased())
                        .foregroundColor(AetherColors.brandDark)
                        .fontWeight(.black)
                )
            VStack(alignment: .leading, spacing: 4) {
                Text(profile.name)
                    .foregroundColor(.white)
                    .fontWeight(.bold)
                if profile.isKid ?? false {
                    Label("طفل", systemImage: "child.2.fill")
                        .foregroundColor(AetherColors.amberGlow)
                        .font(.system(size: 12))
                }
            }
            Spacer()
        }
        .padding()
        .background(AetherColors.brandCard)
        .cornerRadius(12)
    }
}

struct AddProfileForm: View {
    let api: AetherAPI
    let authToken: String
    let onAdded: () -> Void
    let onCancel: () -> Void

    @State private var name = ""
    @State private var isKid = false
    @State private var pin = ""
    @State private var loading = false

    var body: some View {
        VStack(spacing: 16) {
            TextField("اسم الملف", text: $name)
                .textFieldStyle(.plain)
                .padding()
                .background(Color(white: 0.1, 0.1, 0.1, 0.8))
                .cornerRadius(8)
                .foregroundColor(.white)

            TextField("رمز PIN (اختياري)", text: $pin)
                .textFieldStyle(.plain)
                .padding()
                .background(Color(white: 0.1, 0.1, 0.1, 0.8))
                .cornerRadius(8)
                .foregroundColor(.white)

            Toggle("وضع الأطفال", isOn: $isKid)
                .tint(AetherColors.cyanGlow)

            HStack {
                Button("Cancel", action: onCancel)
                Spacer()
                Button(action: {
                    Task { await add() }
                }) {
                    loading ? ProgressView() : Text("إضافة")
                }
                .disabled(loading || name.isEmpty)
            }
        }
        .padding()
        .background(AetherColors.brandCard)
        .cornerRadius(12)
    }

    private func add() async {
        loading = true
        do {
            try await api.createProfile(
                token: authToken,
                body: CreateProfileRequest(
                    name: name,
                    isKid: isKid,
                    maturityMax: nil,
                    pin: pin.isEmpty ? nil : pin
                )
            )
            onAdded()
        } catch {
            // handle error
        }
        loading = false
    }
}
