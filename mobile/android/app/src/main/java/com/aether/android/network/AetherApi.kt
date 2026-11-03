// AetherApi.kt — Retrofit API Client (matches OpenAPI spec in docs/api/openapi.yaml)
package com.aether.android.network

import retrofit2.http.*
import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    val phone: String,
    val profileId: String? = null
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class Tokens(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String,
    val tokenType: String = "Bearer"
)

data class Profile(
    val id: String,
    val name: String,
    val isKid: Boolean = false,
    val maturityMax: String? = null,
    val avatarUrl: String? = null
)

data class CreateProfileRequest(
    val name: String,
    val isKid: Boolean = false,
    val maturityMax: String? = null,
    val pin: String? = null
)

data class Title(
    val id: String,
    val titleAr: String? = null,
    val titleEn: String? = null,
    val kind: String,
    val state: String,
    val maturityRating: String? = null,
    val posterUrl: String? = null
)

data class PlaybackSession(
    val sessionId: String,
    val manifestUrl: String,
    val drm: String,
    val resumeAtSec: Int = 0
)

data class CreatePlaybackRequest(
    val title_id: String,
    val episode_id: String? = null,
    val profile_id: String? = null,
    val device_id: String? = null
)

data class ErrorResponse(
    val code: String,
    val message: String,
    val traceId: String? = null
)

interface AetherApi {

    // ── Auth ──────────────────────────────────────────────
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): ApiResponse<Unit>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): ApiResponse<Tokens>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: Map<String, String>): ApiResponse<Tokens>

    @POST("auth/logout")
    suspend fun logout(@Header("Authorization") auth: String): ApiResponse<Unit>

    // ── Profiles ─────────────────────────────────────────
    @GET("profiles")
    suspend fun getProfiles(@Header("Authorization") auth: String): ApiResponse<List<Profile>>

    @POST("profiles")
    suspend fun createProfile(
        @Header("Authorization") auth: String,
        @Body body: CreateProfileRequest
    ): ApiResponse<Profile>

    // ── Catalog ──────────────────────────────────────────
    @GET("home")
    suspend fun getHome(@Header("Authorization") auth: String): ApiResponse<HomeResponse>

    @GET("search")
    suspend fun search(
        @Header("Authorization") auth: String,
        @Query("q") q: String? = null,
        @Query("genre") genre: String? = null,
        @Query("year") year: Int? = null,
        @Query("lang") lang: String? = null,
        @Query("rating") rating: String? = null
    ): ApiResponse<List<Title>>

    @GET("titles/{id}")
    suspend fun getTitle(
        @Header("Authorization") auth: String,
        @Path("id") id: String
    ): ApiResponse<Title>

    @GET("titles/{id}/episodes")
    suspend fun getEpisodes(
        @Header("Authorization") auth: String,
        @Path("id") id: String
    ): ApiResponse<List<Episode>>

    // ── Playback ──────────────────────────────────────────
    @POST("playback/sessions")
    suspend fun createPlaybackSession(
        @Header("Authorization") auth: String,
        @Body body: CreatePlaybackRequest
    ): ApiResponse<PlaybackSession>

    @POST("playback/sessions/{id}/heartbeat")
    suspend fun heartbeat(
        @Header("Authorization") auth: String,
        @Path("id") id: String
    ): ApiResponse<Unit>

    @POST("playback/sessions/{id}/end")
    suspend fun endSession(
        @Header("Authorization") auth: String,
        @Path("id") id: String
    ): ApiResponse<Unit>

    @GET("me/progress")
    suspend fun getProgress(@Header("Authorization") auth: String): ApiResponse<List<WatchProgress>>

    @PUT("me/progress")
    suspend fun updateProgress(
        @Header("Authorization") auth: String,
        @Body body: ProgressRequest
    ): ApiResponse<Unit>

    // ── Billing ──────────────────────────────────────────
    @POST("billing/checkout")
    suspend fun checkout(
        @Header("Authorization") auth: String,
        @Body body: Map<String, String>
    ): ApiResponse<CheckoutResponse>

    // ── Generic response wrapper ──────────────────────────
    data class HomeResponse(val rows: List<HomeRow>, val continueWatching: List<Title>)
    data class HomeRow(val id: String, val title: String, val items: List<Title>)
    data class Episode(val id: String, val name: String, val season: Int, val episode: Int)
    data class WatchProgress(
        val titleId: String,
        val episodeId: String,
        val positionSec: Int,
        val completed: Boolean
    )
    data class ProgressRequest(
        val title_id: String,
        val episode_id: String,
        val position_sec: Int,
        val completed: Boolean
    )
    data class CheckoutResponse(val sessionId: String, val url: String)

    // ── Generic wrapper ────────────────────────────────────
    data class ApiResponse<T>(
        val success: Boolean = true,
        val data: T? = null,
        val error: ErrorResponse? = null
    )

    companion object {
        const val BASE_URL = "https://api.aether.tv/v1/"
    }
}

// Retrofit builder helper
object AetherClient {
    private val retrofit: retrofit2.Retrofit by lazy {
        retrofit2.Retrofit.Builder()
            .baseUrl(AetherApi.BASE_URL)
            .client(
                okhttp3.OkHttpClient.Builder()
                    .addInterceptor(okhttp3.logging.HttpLoggingInterceptor())
                    .build()
            )
            .addConverterFactory(com.google.gson.GsonConverterFactory.create())
            .build()
    }

    val api: AetherApi = retrofit.create(AetherApi::class.java)
}
