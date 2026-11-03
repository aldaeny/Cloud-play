// PlayerView.swift — AVPlayer with Signed HLS Playback (iOS/tvOS)
import SwiftUI
import AVKit

struct PlayerView: View {
    let api: AetherAPI
    let authToken: String
    let titleId: String
    let episodeId: String?
    let profileId: String?
    @Environment(\.dismiss) var dismiss

    @State private var player: AVPlayer?
    @State private var manifestUrl: String?
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let player = player {
                AVPlayerViewController(player: player)
                    .ignoresSafeArea()
                    .onAppear { player.play() }
                    .onDisappear { player.pause() }
            }

            if loading {
                ProgressView("جارٍ التحميل…")
                    .scaleEffect(1.5)
                    .foregroundColor(AetherColors.cyanGlow)
            }

            if let error = error {
                VStack(spacing: 20) {
                    Text(error)
                        .foregroundColor(AetherColors.magentaGlow)
                        .multilineTextAlignment(.center)
                    Button("رجوع", action: { dismiss() })
                        .padding()
                        .background(AetherColors.cyanGlow)
                        .foregroundColor(AetherColors.brandDark)
                        .cornerRadius(8)
                }
            }

            Button(action: {
                player?.pause()
                dismiss()
            }) {
                Image(systemName: "arrow.back.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.white)
                    .padding(16)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .task { await loadPlayback() }
    }

    private func loadPlayback() async {
        do {
            let session = try await api.createPlaybackSession(
                token: authToken,
                body: CreatePlaybackRequest(
                    title_id: titleId,
                    episode_id: episodeId,
                    profile_id: profileId,
                    device_id: nil
                )
            )
            let url = URL(string: session.manifestUrl)!
            let avPlayer = AVPlayer(url: url)
            self.player = avPlayer
            self.manifestUrl = session.manifestUrl

            // Heartbeat every 30 seconds
            Task {
                while let _ = manifestUrl {
                    try? await Task.sleep(nanoseconds: 30_000_000_000)
                    try? await api.heartbeat(token: authToken, sessionId: session.sessionId)
                }
            }
        } catch {
            self.error = (error as? APIError)?.message ?? error.localizedDescription
        }
        loading = false
    }
}
