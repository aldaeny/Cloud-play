// AuthView.swift — Registration & Login (SwiftUI)
import SwiftUI

struct AuthView: View {
    @State private var isRegister = false
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var phone = ""
    @State private var error: String?
    @State private var loading = false

    let api: AetherAPI
    let onLoginSuccess: (String) -> Void

    var body: some View {
        ZStack {
            AetherColors.brandDark.ignoresSafeArea()
            VStack(spacing: 20) {
                Text("Aether")
                    .font(.system(size: 36, weight: .black))
                    .foregroundColor(AetherColors.cyanGlow)

                Text(isRegister ? "إنشاء حساب جديد" : "مرحباً بك")
                    .font(.system(size: 18))
                    .foregroundColor(.white)

                TextField(isRegister ? "البريد الإلكتروني" : "البريد الإلكتروني", text: $email)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color(white: 0.1, 0.1, 0.1, 0.8))
                    .cornerRadius(8)
                    .foregroundColor(.white)

                if isRegister {
                    TextField("الاسم", text: $name)
                        .textFieldStyle(.plain)
                        .padding()
                        .background(Color(white: 0.1, 0.1, 0.1, 0.8))
                        .cornerRadius(8)
                        .foregroundColor(.white)

                    TextField("رقم الهاتف", text: $phone)
                        .textFieldStyle(.plain)
                        .padding()
                        .background(Color(white: 0.1, 0.1, 0.1, 0.8))
                        .cornerRadius(8)
                        .foregroundColor(.white)
                }

                SecureField("كلمة المرور", text: $password)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color(white: 0.1, 0.1, 0.1, 0.8))
                    .cornerRadius(8)
                    .foregroundColor(.white)

                if let error = error {
                    Text(error)
                        .foregroundColor(AetherColors.magentaGlow)
                        .font(.system(size: 14))
                }

                Button(action: {
                    Task { await handleAuth() }
                }) {
                    if loading {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text(isRegister ? "تسجيل" : "دخول")
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
                .buttonStyle(.plain)
                .background(AetherColors.cyanGlow)
                .foregroundColor(AetherColors.brandDark)
                .cornerRadius(8)
                .disabled(loading)

                Button(action: { isRegister.toggle() }) {
                    Text(isRegister ? "لديك حساب؟ سجل دخول" : "لا تملك حساب؟ سجل الآن")
                        .foregroundColor(AetherColors.gray)
                }
            }
            .padding()
        }
    }

    private func handleAuth() async {
        loading = true
        error = nil
        do {
            if isRegister {
                try await api.register(RegisterRequest(email: email, password: password,
                                                      name: name, phone: phone))
                onLoginSuccess(email)
            } else {
                let tokens = try await api.login(LoginRequest(email: email, password: password))
                onLoginSuccess(tokens.access_token)
            }
        } catch {
            self.error = (error as? APIError)?.message ?? error.localizedDescription
        }
        loading = false
    }
}
