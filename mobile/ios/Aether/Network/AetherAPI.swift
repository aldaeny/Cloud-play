// AetherAPI.swift — Network Client (matches OpenAPI spec in docs/api/openapi.yaml)
// Uses URLSession + Codable

import Foundation

// MARK: - Models

struct RegisterRequest: Codable {
    let email: String
    let password: String
    let name: String
    let phone: String
    let profileId: String?
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct Tokens: Codable {
    let access_token: String
    let refresh_token: String
    let token_type: String?
}

struct Profile: Codable, Identifiable {
    let id: String
    let name: String
    let isKid: Bool?
    let maturityMax: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case isKid = "is_kid"
        case maturityMax = "maturity_max"
        case avatarUrl = "avatar_url"
    }
}

struct CreateProfileRequest: Codable {
    let name: String
    let isKid: Bool?
    let maturityMax: String?
    let pin: String?

    enum CodingKeys: String, CodingKey {
        case name
        case isKid = "is_kid"
        case maturityMax = "maturity_max"
        case pin
    }
}

struct Title: Codable, Identifiable {
    let id: String
    let titleAr: String?
    let titleEn: String?
    let kind: String
    let state: String
    let maturityRating: String?
    let posterUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case titleAr = "title_ar"
        case titleEn = "title_en"
        case kind, state
        case maturityRating = "maturity_rating"
        case posterUrl = "poster_url"
    }
}

struct PlaybackSession: Codable {
    let sessionId: String
    let manifestUrl: String
    let drm: String
    let resumeAtSec: Int

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case manifestUrl = "manifest_url"
        case drm
        case resumeAtSec = "resume_at_sec"
    }
}

struct CreatePlaybackRequest: Codable {
    let title_id: String
    let episode_id: String?
    let profile_id: String?
    let device_id: String?
}

struct Episode: Codable, Identifiable {
    let id: String
    let name: String
    let season: Int
    let episode: Int
}

struct WatchProgress: Codable {
    let titleId: String
    let episodeId: String
    let positionSec: Int
    let completed: Bool

    enum CodingKeys: String, CodingKey {
        case titleId = "title_id"
        case episodeId = "episode_id"
        case positionSec = "position_sec"
        case completed
    }
}

struct ErrorResponse: Codable {
    let code: String
    let message: String
    let traceId: String?
}

struct HomeResponse: Codable {
    let rows: [HomeRow]
    let continueWatching: [Title]?

    enum CodingKeys: String, CodingKey {
        case rows
        case continueWatching = "continue_watching"
    }
}

struct HomeRow: Codable {
    let id: String
    let title: String
    let items: [Title]
}

// MARK: - Generic API Response

struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: ErrorResponse?
}

// MARK: - API Client

final class AetherAPI {
    static let shared = AetherAPI()

    private let baseURL = URL(string: "https://api.aether.tv/v1")!
    private let session = URLSession.shared

    private func request<T: Codable>(
        method: String,
        path: String,
        body: (some Codable)? = nil,
        token: String? = nil,
        responseType: T.Type
    ) async throws -> T {
        var url = baseURL.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method

        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: req)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        // Handle non-2xx
        if !(200...299).contains(httpResponse.statusCode) {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError(code: errorResponse.code, message: errorResponse.message)
            }
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Auth

    func register(_ body: RegisterRequest) async throws -> Void {
        let response: APIResponse<Empty> = try await request(
            method: "POST", path: "auth/register", body: body
        )
        if let error = response.error { throw APIError(code: error.code, message: error.message) }
    }

    func login(_ body: LoginRequest) async throws -> Tokens {
        let response: APIResponse<Tokens> = try await request(
            method: "POST", path: "auth/login", body: body
        )
        if let data = response.data { return data }
        if let error = response.error { throw APIError(code: error.code, message: error.message) }
        throw APIError(code: "UNKNOWN", message: "Unexpected response")
    }

    func refresh(token: String) async throws -> Tokens {
        let body = ["refresh_token": token]
        let response: APIResponse<Tokens> = try await request(
            method: "POST", path: "auth/refresh", body: body as Codable
        )
        if let data = response.data { return data }
        if let error = response.error { throw APIError(code: error.code, message: error.message) }
        throw APIError(code: "UNKNOWN", message: "Unexpected response")
    }

    func logout(token: String) async throws {
        _ = try await request(method: "POST", path: "auth/logout", token: token, responseType: APIResponse<Empty>.self)
    }

    // MARK: - Profiles

    func getProfiles(token: String) async throws -> [Profile] {
        let response: APIResponse<[Profile]> = try await request(
            method: "GET", path: "profiles", token: token
        )
        return response.data ?? []
    }

    func createProfile(token: String, body: CreateProfileRequest) async throws -> Profile {
        let response: APIResponse<Profile> = try await request(
            method: "POST", path: "profiles", body: body, token: token
        )
        if let data = response.data { return data }
        if let error = response.error { throw APIError(code: error.code, message: error.message) }
        throw APIError(code: "UNKNOWN", message: "Unexpected response")
    }

    // MARK: - Catalog

    func getHome(token: String) async throws -> HomeResponse {
        let response: APIResponse<HomeResponse> = try await request(
            method: "GET", path: "home", token: token
        )
        if let data = response.data { return data }
        throw APIError(code: "UNKNOWN", message: "No home data")
    }

    func search(token: String, query: String? = nil, genre: String? = nil,
                year: Int? = nil, lang: String? = nil, rating: String? = nil) async throws -> [Title] {
        var components = URLComponents()
        components.path = "search"
        var items: [URLQueryItem] = []
        if let query { items.append(URLQueryItem(name: "q", value: query)) }
        if let genre { items.append(URLQueryItem(name: "genre", value: genre)) }
        if let year { items.append(URLQueryItem(name: "year", value: String(year))) }
        if let lang { items.append(URLQueryItem(name: "lang", value: lang)) }
        if let rating { items.append(URLQueryItem(name: "rating", value: rating)) }
        components.queryItems = items.isEmpty ? nil : items

        let path = components.query ?? ""
        let fullPath = "search" + (path.isEmpty ? "" : "?" + path)
        let response: APIResponse<[Title]> = try await request(
            method: "GET", path: fullPath, token: token
        )
        return response.data ?? []
    }

    func getTitle(token: String, id: String) async throws -> Title {
        let response: APIResponse<Title> = try await request(
            method: "GET", path: "titles/\(id)", token: token
        )
        if let data = response.data { return data }
        throw APIError(code: "NOT_FOUND", message: "Title not found")
    }

    func getEpisodes(token: String, id: String) async throws -> [Episode] {
        let response: APIResponse<[Episode]> = try await request(
            method: "GET", path: "titles/\(id)/episodes", token: token
        )
        return response.data ?? []
    }

    // MARK: - Playback

    func createPlaybackSession(token: String, body: CreatePlaybackRequest) async throws -> PlaybackSession {
        let response: APIResponse<PlaybackSession> = try await request(
            method: "POST", path: "playback/sessions", body: body, token: token
        )
        if let data = response.data { return data }
        if let error = response.error { throw APIError(code: error.code, message: error.message) }
        throw APIError(code: "UNKNOWN", message: "Unexpected response")
    }

    func heartbeat(token: String, sessionId: String) async throws {
        _ = try await request(method: "POST", path: "playback/sessions/\(sessionId)/heartbeat",
                              token: token, responseType: APIResponse<Empty>.self)
    }

    func endSession(token: String, sessionId: String) async throws {
        _ = try await request(method: "POST", path: "playback/sessions/\(sessionId)/end",
                              token: token, responseType: APIResponse<Empty>.self)
    }

    func updateProgress(token: String, body: WatchProgress) async throws {
        _ = try await request(method: "PUT", path: "me/progress", body: body, token: token,
                              responseType: APIResponse<Empty>.self)
    }

    // MARK: - Billing

    func checkout(token: String, planId: String) async throws -> CheckoutSession {
        let body = ["plan_id": planId]
        let response: APIResponse<CheckoutSession> = try await request(
            method: "POST", path: "billing/checkout", body: body as Codable, token: token
        )
        if let data = response.data { return data }
        throw APIError(code: "UNKNOWN", message: "No checkout session")
    }
}

struct CheckoutSession: Codable {
    let sessionId: String
    let url: String

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case url
    }
}

struct Empty: Codable {}

struct APIError: LocalizedError {
    let code: String
    let message: String

    var errorDescription: String? { "\(code): \(message)" }
}

// MARK: - Color Helper

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
