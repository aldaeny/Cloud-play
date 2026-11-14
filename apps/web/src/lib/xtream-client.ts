'use client';

/**
 * Client-side Xtream Codes API library.
 * Runs entirely in the browser to bypass Vercel/cloud IP blocks.
 * The user provides their own credentials which never leave the browser.
 */

export type XtreamCredentials = {
  server: string;           // e.g. "http://redchicks.xyz:2052"
  username: string;
  password: string;
  proxyUrl?: string;        // Optional Cloudflare Worker proxy URL (e.g. "https://xtream-proxy.yourdomain.workers.dev")
};

export type XtreamCategory = {
  category_id: string;
  category_name: string;
  parent_id?: number;
};

export type XtreamStream = {
  num: number;
  name: string;
  stream_type: string;
  stream_id: string;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
};

export type XtreamMovie = {
  num: number;
  name: string;
  stream_type: string;
  stream_id: string;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
};

export type XtreamSeries = {
  num: number;
  name: string;
  series_id: string;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  category_id: string;
};

export type XtreamEpisode = {
  id: string;
  title: string;
  container_extension: string;
  info: {
    movie_image: string;
    released: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    rating: string;
    duration: string;
    episode_num: number;
    season: number;
  };
};

export type XtreamAccountInfo = {
  user_info: {
    username: string;
    password: string;
    message: string;
    auth: number;
    status: string;
    exp_date: string;
    is_trial: string;
    active_cons: string;
    created_at: string;
    max_connections: string;
    allowed_output_formats: string[];
  };
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    rtmp_port: string;
    timezone: string;
    timestamp_now: number;
    time_now: string;
  };
};

export type XtreamErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'SERVER_UNREACHABLE'
  | 'SERVER_BLOCKED'
  | 'INVALID_RESPONSE'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

export class XtreamError extends Error {
  constructor(public code: XtreamErrorCode, message: string) {
    super(message);
    this.name = 'XtreamError';
  }
}

function normalizeServerUrl(server: string): string {
  const trimmed = server.trim();
  if (!trimmed) throw new XtreamError('INVALID_CREDENTIALS', 'Server URL is required');

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`);
    // Ensure it ends with /
    if (!url.pathname.endsWith('/')) {
      url.pathname = url.pathname + '/';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new XtreamError('INVALID_CREDENTIALS', 'Invalid server URL format');
  }
}

function buildApiUrl(baseUrl: string, action: string, params: Record<string, string> = {}): string {
  const url = new URL(`${baseUrl}/player_api.php`);
  url.searchParams.set('username', params.username || '');
  url.searchParams.set('password', params.password || '');
  url.searchParams.set('action', action);

  for (const [key, value] of Object.entries(params)) {
    if (key !== 'username' && key !== 'password' && value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CloudPlay/1.0',
        ...options.headers,
      },
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new XtreamError('SERVER_UNREACHABLE', 'Request timed out');
    }
    throw new XtreamError('SERVER_UNREACHABLE', 'Failed to reach server');
  } finally {
    clearTimeout(timeout);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    throw new XtreamError('INVALID_CREDENTIALS', 'Invalid username or password');
  }

  if (response.status === 429) {
    throw new XtreamError('RATE_LIMITED', 'Too many requests, please wait');
  }

  if (!response.ok) {
    throw new XtreamError('SERVER_UNREACHABLE', `Server returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (text.includes('blocked') || text.includes('forbidden') || text.includes('403')) {
      throw new XtreamError('SERVER_BLOCKED', 'Server blocked the request (possibly cloud IP)');
    }
    throw new XtreamError('INVALID_RESPONSE', 'Server returned non-JSON response');
  }

  try {
    return await response.json();
  } catch {
    throw new XtreamError('INVALID_RESPONSE', 'Failed to parse JSON response');
  }
}

export class XtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private proxyUrl: string | undefined;
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private pending: Map<string, Promise<unknown>> = new Map();

  constructor(credentials: XtreamCredentials) {
    this.baseUrl = normalizeServerUrl(credentials.server);
    this.username = credentials.username.trim();
    this.password = credentials.password.trim();
    this.proxyUrl = credentials.proxyUrl?.trim();

    if (!this.username || !this.password) {
      throw new XtreamError('INVALID_CREDENTIALS', 'Username and password are required');
    }
    if (this.proxyUrl) {
      try {
        new URL(this.proxyUrl);
      } catch {
        throw new XtreamError('INVALID_CREDENTIALS', 'Invalid proxy URL format');
      }
    }
  }

  private getCacheKey(action: string, extraParams: Record<string, string> = {}): string {
    const params = new URLSearchParams({ action, ...extraParams }).toString();
    return params;
  }

  private async cachedFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = 30000): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expires > now) {
      return cached.data as T;
    }

    if (this.pending.has(key)) {
      return this.pending.get(key)! as Promise<T>;
    }

    const promise = fetcher().then(data => {
      this.cache.set(key, { data, expires: now + ttlMs });
      return data;
    }).finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Test connection and get account info
   */
  async testConnection(): Promise<XtreamAccountInfo> {
    return this.cachedFetch('account_info', async () => {
      const url = buildApiUrl(this.baseUrl, '', { username: this.username, password: this.password });
      const response = await fetchWithTimeout(url);
      return handleResponse<XtreamAccountInfo>(response);
    }, 60000); // Cache account info for 1 minute
  }

  /**
   * Get live TV categories
   */
  async getLiveCategories(): Promise<XtreamCategory[]> {
    return this.cachedFetch('live_categories', async () => {
      const url = buildApiUrl(this.baseUrl, 'get_live_categories', {
        username: this.username,
        password: this.password
      });
      const response = await fetchWithTimeout(url);
      const data = await handleResponse<unknown>(response);

      if (!Array.isArray(data)) {
        throw new XtreamError('INVALID_RESPONSE', 'Expected array for categories');
      }

      return data as XtreamCategory[];
    });
  }

  /**
   * Get live streams for a category
   */
  async getLiveStreams(categoryId: string): Promise<XtreamStream[]> {
    return this.cachedFetch(`live_streams:${categoryId}`, async () => {
      const url = buildApiUrl(this.baseUrl, 'get_live_streams', {
        username: this.username,
        password: this.password,
        category_id: categoryId
      });
      const response = await fetchWithTimeout(url);
      const data = await handleResponse<unknown>(response);

      if (!Array.isArray(data)) {
        throw new XtreamError('INVALID_RESPONSE', 'Expected array for streams');
      }

      return data as XtreamStream[];
    });
  }

  /**
   * Get VOD categories (movies)
   */
  async getVodCategories(): Promise<XtreamCategory[]> {
    return this.cachedFetch('vod_categories', async () => {
      const url = buildApiUrl(this.baseUrl, 'get_vod_categories', {
        username: this.username,
        password: this.password
      });
      const response = await fetchWithTimeout(url);
      const data = await handleResponse<unknown>(response);

      if (!Array.isArray(data)) {
        throw new XtreamError('INVALID_RESPONSE', 'Expected array for VOD categories');
      }

      return data as XtreamCategory[];
    });
  }

  /**
   * Get VOD streams (movies) for a category
   */
  async getVodStreams(categoryId: string): Promise<XtreamMovie[]> {
    return this.cachedFetch(`vod_streams:${categoryId}`, async () => {
      const url = buildApiUrl(this.baseUrl, 'get_vod_streams', {
        username: this.username,
        password: this.password,
        category_id: categoryId
      });
      const response = await fetchWithTimeout(url);
      const data = await handleResponse<unknown>(response);

      if (!Array.isArray(data)) {
        throw new XtreamError('INVALID_RESPONSE', 'Expected array for VOD streams');
      }

      return data as XtreamMovie[];
    });
  }

  /**
   * Get series categories
   */
  async getSeriesCategories(): Promise<XtreamCategory[]> {
    return this.cachedFetch('series_categories', async () => {
      const url = buildApiUrl(this.baseUrl, 'get_series_categories', {
        username: this.username,
        password: this.password
      });
      const response = await fetchWithTimeout(url);
      const data = await handleResponse<unknown>(response);

      if (!Array.isArray(data)) {
        throw new XtreamError('INVALID_RESPONSE', 'Expected array for series categories');
      }

      return data as XtreamCategory[];
    });
  }

  /**
   * Get series list for a category
   */
  async getSeries(categoryId: string): Promise<XtreamSeries[]> {
    return this.cachedFetch(`series:${categoryId}`, async () => {
      const url = buildApiUrl(this.baseUrl, 'get_series', {
        username: this.username,
        password: this.password,
        category_id: categoryId
      });
      const response = await fetchWithTimeout(url);
      const data = await handleResponse<unknown>(response);

      if (!Array.isArray(data)) {
        throw new XtreamError('INVALID_RESPONSE', 'Expected array for series');
      }

      return data as XtreamSeries[];
    });
  }

  /**
   * Get episodes for a series
   */
  async getSeriesInfo(seriesId: string): Promise<{ episodes: Record<string, XtreamEpisode[]> }> {
    return this.cachedFetch(`series_info:${seriesId}`, async () => {
      const url = buildApiUrl(this.baseUrl, 'get_series_info', {
        username: this.username,
        password: this.password,
        series_id: seriesId
      });
      const response = await fetchWithTimeout(url);
      return handleResponse<{ episodes: Record<string, XtreamEpisode[]> }>(response);
    });
  }

  /**
   * Build stream URL for live TV
   * Uses Cloudflare Worker proxy if configured, otherwise direct URL
   */
  getLiveStreamUrl(streamId: string, extension = 'm3u8'): string {
    const path = `/live/${this.username}/${this.password}/${streamId}.${extension}`;
    if (this.proxyUrl) {
      return `${this.proxyUrl}/proxy${path}`;
    }
    const params = new URLSearchParams({
      username: this.username,
      password: this.password,
      type: 'live',
    });
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * Build stream URL for VOD (movies)
   * Uses Cloudflare Worker proxy if configured, otherwise direct URL
   */
  getVodStreamUrl(streamId: string, extension = 'mp4'): string {
    const path = `/movie/${this.username}/${this.password}/${streamId}.${extension}`;
    if (this.proxyUrl) {
      return `${this.proxyUrl}/proxy${path}`;
    }
    const params = new URLSearchParams({
      username: this.username,
      password: this.password,
    });
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * Build stream URL for series episode
   * Uses Cloudflare Worker proxy if configured, otherwise direct URL
   */
  getSeriesStreamUrl(episodeId: string, extension = 'mp4'): string {
    const path = `/series/${this.username}/${this.password}/${episodeId}.${extension}`;
    if (this.proxyUrl) {
      return `${this.proxyUrl}/proxy${path}`;
    }
    const params = new URLSearchParams({
      username: this.username,
      password: this.password,
    });
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.pending.clear();
  }

  /**
   * Get current credentials (for storage)
   */
  getCredentials(): XtreamCredentials {
    return {
      server: this.baseUrl,
      username: this.username,
      password: this.password,
    };
  }
}

/**
 * Create a client from stored credentials
 */
export function createClientFromStorage(): XtreamClient | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem('xtream_credentials');
    if (!stored) return null;

    const credentials = JSON.parse(stored) as XtreamCredentials;
    return new XtreamClient(credentials);
  } catch {
    return null;
  }
}

/**
 * Save credentials to localStorage
 */
export function saveCredentials(credentials: XtreamCredentials): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('xtream_credentials', JSON.stringify(credentials));
}

/**
 * Clear stored credentials
 */
export function clearCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('xtream_credentials');
}

/**
 * Check if credentials are stored
 */
export function hasStoredCredentials(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('xtream_credentials');
}