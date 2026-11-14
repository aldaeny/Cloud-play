/**
 * Cloudflare Worker: Xtream Media Proxy
 *
 * This worker acts as a proxy for Xtream media streams to bypass IP blocks.
 * The worker runs on Cloudflare's edge network which has different IPs than Vercel.
 *
 * DEPLOYMENT:
 * 1. Install Wrangler: npm i -g wrangler
 * 2. Login: wrangler login
 * 3. Create KV namespace: wrangler kv:namespace create "XTREAM_CACHE"
 * 4. Update wrangler.toml with the KV namespace ID
 * 5. Deploy: wrangler deploy
 *
 * CONFIGURATION:
 * Set these as Worker secrets (wrangler secret put):
 * - XTREAM_BASE_URL: http://redchicks.xyz:2052
 * - XTREAM_USERNAME: adam@net
 * - XTREAM_PASSWORD: 83632625225643
 *
 * USAGE FROM BROWSER:
 * Instead of direct URLs like:
 *   http://redchicks.xyz:2052/live/user/pass/123.m3u8
 * Use the worker:
 *   https://your-worker.workers.dev/proxy/live/user/pass/123.m3u8
 *
 * The worker will:
 * 1. Rewrite HLS manifests to proxy all segment URLs through itself
 * 2. Proxy binary media (TS segments, MP4, images) with Range support
 * 3. Cache manifests for 30s, segments for 5min (when KV enabled)
 * 4. Add CORS headers for browser playback
 */

// CORS headers for browser playback
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Access-Control-Max-Age': '86400',
};

// Helper to build upstream URL - extracts credentials from Xtream path format
// Xtream paths: /live/username/password/stream_id.ts or /movie/username/password/stream_id.mp4
function buildUpstreamUrl(baseUrl, path, searchParams) {
  // Extract username/password from Xtream path format: /type/username/password/stream_id.ext
  const pathMatch = path.match(/^\/(live|movie|series)\/([^\/]+)\/([^\/]+)\/(.+)$/);
  let username = '';
  let password = '';
  let cleanPath = path;

  if (pathMatch) {
    username = pathMatch[2];
    password = pathMatch[3];
    cleanPath = '/' + pathMatch[1] + '/' + pathMatch[4];
  }

  const url = new URL(cleanPath, baseUrl);

  // Add username/password to query if extracted from path
  if (username && password) {
    url.searchParams.set('username', username);
    url.searchParams.set('password', password);
  }

  // Copy all query parameters from the original request
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url;
}

// Helper to check if URL is a playlist
function isPlaylist(url, contentType) {
  return url.pathname.toLowerCase().endsWith('.m3u8') || /mpegurl/i.test(contentType);
}

// Rewrite playlist to proxy all references
function rewritePlaylist(body, baseUrl, workerUrl) {
  const base = new URL(baseUrl);
  const worker = new URL(workerUrl);

  return body
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        // Handle EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA with URI="..."
        return line.replace(/URI="([^"]*)"/g, (_match, uri) => {
          try {
            const absolute = new URL(uri, base);
            // Only proxy same-origin references
            if (absolute.origin === base.origin) {
              const proxiedPath = absolute.pathname + absolute.search;
              return `URI="${worker.origin}/proxy${proxiedPath}"`;
            }
          } catch {
            // Invalid URI, leave as-is
          }
          return _match;
        });
      }

      // Plain segment URL
      try {
        const absolute = new URL(trimmed, base);
        if (absolute.origin === base.origin) {
          const proxiedPath = absolute.pathname + absolute.search;
          return `${worker.origin}/proxy${proxiedPath}`;
        }
      } catch {
        // Not a valid URL, leave as-is
      }
      return line;
    })
    .join('\n');
}

// Fetch from upstream with redirect handling (max 3 redirects)
// For playlists: only same-origin redirects (security)
// For binary media: allow cross-origin redirects (CDN segments)
async function fetchUpstream(url, headers, signal, maxRedirects = 3, allowCrossOrigin = false) {
  let currentUrl = url;
  const origin = url.origin;

  for (let i = 0; i <= maxRedirects; i++) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'CloudPlay-Proxy/1.0',
        ...headers,
      },
      redirect: 'manual',
      signal,
      cf: {
        cacheTtl: 300, // 5 min default cache
        cacheEverything: true,
      },
    });

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      response.body?.cancel?.().catch(() => {});

      if (!location) {
        throw new Error('Redirect without location header');
      }

      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        throw new Error('Invalid redirect URL');
      }

      // For playlists: only follow same-origin redirects (security)
      // For binary media: allow cross-origin redirects (CDN segments)
      if (nextUrl.origin !== origin && !allowCrossOrigin) {
        throw new Error('Cross-origin redirect blocked');
      }

      currentUrl = nextUrl;
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams;

    // Handle OPTIONS for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Health check endpoint
    if (path === '/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // Debug endpoint to test proxy with httpbin
    if (path === '/debug/httpbin') {
      try {
        const resp = await fetch('https://httpbin.org/get', {
          headers: { 'User-Agent': 'CloudPlay-Proxy/1.0' },
          cf: { cacheTtl: 60 },
        });
        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 502 });
      }
    }

    // Proxy endpoint: /proxy/<path>
    if (path.startsWith('/proxy/')) {
      const proxyPath = path.slice(7); // Remove '/proxy/'
      const baseUrl = env.XTREAM_BASE_URL;

      if (!baseUrl) {
        return new Response('Server not configured', { status: 503 });
      }

      // Build upstream URL with query parameters
      let upstreamUrl;
      try {
        upstreamUrl = buildUpstreamUrl(baseUrl, proxyPath, searchParams);
      } catch {
        return new Response('Invalid path', { status: 400 });
      }

      // Security: Only allow proxying to configured Xtream server
      if (upstreamUrl.origin !== new URL(baseUrl).origin) {
        return new Response('Forbidden: cross-origin request', { status: 403 });
      }

      // Get Range header for media seeking
      const rangeHeader = request.headers.get('Range');

      // Create abort signal with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        // Check KV cache for playlists (30s TTL) - only if KV is available
        const cacheKey = `playlist:${upstreamUrl.toString()}`;
        const isPlaylistRequest = upstreamUrl.pathname.toLowerCase().endsWith('.m3u8');
        const hasKV = !!env.XTREAM_CACHE;

        if (hasKV && isPlaylistRequest && request.method === 'GET' && !rangeHeader) {
          const cached = await env.XTREAM_CACHE.get(cacheKey, { type: 'json' });
          if (cached && cached.body) {
            const rewritten = rewritePlaylist(cached.body, baseUrl, url.origin);
            return new Response(rewritten, {
              status: 200,
              headers: {
                'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
                ...CORS_HEADERS,
              },
            });
          }
        }

        // Forward request to upstream
        const upstreamHeaders = {
          'Accept': '*/*',
          'User-Agent': 'CloudPlay-Proxy/1.0',
        };
        if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

        // For playlists: only same-origin redirects (security)
    // For binary media: allow cross-origin redirects (CDN segments)
    const allowCrossOrigin = !isPlaylistRequest;
    const upstreamResponse = await fetchUpstream(upstreamUrl, upstreamHeaders, controller.signal, 3, allowCrossOrigin);

        // Handle upstream errors
        if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
          return new Response('Upstream authentication failed', { status: 502 });
        }
        if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
          return new Response('Upstream error: ' + upstreamResponse.status, { status: 502 });
        }

        const contentType = upstreamResponse.headers.get('content-type') || '';
        const isPlaylistResponse = isPlaylist(upstreamUrl, contentType);

        // Handle playlist responses - rewrite URLs
        if (isPlaylistResponse && request.method === 'GET' && !rangeHeader) {
          const body = await upstreamResponse.text();
          const rewritten = rewritePlaylist(body, baseUrl, url.origin);

          // Cache playlist in KV for 30 seconds (if KV available)
          if (hasKV) {
            await env.XTREAM_CACHE.put(cacheKey, JSON.stringify({
              body: rewritten,
              contentType: 'application/vnd.apple.mpegurl; charset=utf-8',
            }), { expirationTtl: 30 });
          }

          return new Response(rewritten, {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
              'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
              ...CORS_HEADERS,
            },
          });
        }

        // Binary media: stream through with Range support
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', contentType || 'application/octet-stream');
        responseHeaders.set('Accept-Ranges', 'bytes');
        responseHeaders.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

        // Copy relevant headers from upstream
        for (const header of ['content-length', 'content-range', 'last-modified', 'etag']) {
          const value = upstreamResponse.headers.get(header);
          if (value) responseHeaders.set(header, value);
        }

        // Add CORS headers
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          responseHeaders.set(key, value);
        }

        // Return streamed response
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });

      } catch (error) {
        console.error('Proxy error:', error);
        if (error instanceof DOMException && error.name === 'AbortError') {
          return new Response('Upstream timeout', { status: 504 });
        }
        return new Response('Proxy error: ' + error.message, { status: 502 });
      } finally {
        clearTimeout(timeout);
      }
    }

    // 404 for unknown paths
    return new Response('Not found', { status: 404 });
  },
};