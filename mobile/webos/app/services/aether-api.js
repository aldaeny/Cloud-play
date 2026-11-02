// aether-api.js — webOS API Client (matches OpenAPI spec in docs/api/openapi.yaml)
const BASE_URL = 'https://api.aether.tv/v1';

class AetherAPI {
    constructor() {
        this.token = null;
    }

    setToken(token) { this.token = token; }

    async request(method, path, body = null) {
        const url = `${BASE_URL}/${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            const error = new Error(data.error?.message || 'Request failed');
            error.code = data.error?.code;
            throw error;
        }
        return data;
    }

    // ── Auth ────────────────────────────────────────────
    async register({ email, password, name, phone }) {
        return this.request('POST', 'auth/register', { email, password, name, phone });
    }

    async login({ email, password }) {
        const res = await this.request('POST', 'auth/login', { email, password });
        this.setToken(res.data?.access_token);
        return res.data;
    }

    async refresh(refreshToken) {
        const res = await this.request('POST', 'auth/refresh', { refresh_token: refreshToken });
        this.setToken(res.data?.access_token);
        return res.data;
    }

    async logout() {
        return this.request('POST', 'auth/logout');
    }

    // ── Profiles ───────────────────────────────────────
    async getProfiles() {
        const res = await this.request('GET', 'profiles');
        return res.data || [];
    }

    async createProfile({ name, is_kid, maturity_max, pin }) {
        return this.request('POST', 'profiles', { name, is_kid, maturity_max, pin });
    }

    // ── Catalog ────────────────────────────────────────
    async getHome() {
        return this.request('GET', 'home');
    }

    async search({ q, genre, year, lang, rating } = {}) {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (genre) params.set('genre', genre);
        if (year) params.set('year', year);
        if (lang) params.set('lang', lang);
        if (rating) params.set('rating', rating);
        const query = params.toString();
        const res = await this.request('GET', `search${query ? '?' + query : ''}`);
        return res.data || [];
    }

    async getTitle(id) {
        return this.request('GET', `titles/${id}`);
    }

    async getEpisodes(id) {
        const res = await this.request('GET', `titles/${id}/episodes`);
        return res.data || [];
    }

    // ── Playback ────────────────────────────────────────
    async createPlaybackSession({ title_id, episode_id, profile_id, device_id }) {
        return this.request('POST', 'playback/sessions', { title_id, episode_id, profile_id, device_id });
    }

    async heartbeat(sessionId) {
        return this.request('POST', `playback/sessions/${sessionId}/heartbeat`);
    }

    async endSession(sessionId) {
        return this.request('POST', `playback/sessions/${sessionId}/end`);
    }

    async updateProgress(body) {
        return this.request('PUT', 'me/progress', body);
    }

    // ── Billing ────────────────────────────────────────
    async checkout(planId) {
        return this.request('POST', 'billing/checkout', { plan_id: planId });
    }
}

const aetherApi = new AetherAPI();
