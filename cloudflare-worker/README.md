# Xtream Media Proxy - Cloudflare Worker

A Cloudflare Worker that proxies Xtream Codes media streams to bypass IP blocks from hosting providers like Vercel.

## Why This Is Needed

When hosting on Vercel (or other cloud providers), the server's IP addresses are often blocked by IPTV providers. This worker runs on Cloudflare's edge network with different IPs, allowing you to:

1. Fetch catalog data directly from the browser (already implemented in `xtream-client.ts`)
2. Proxy media streams (HLS playlists, TS segments, MP4) through Cloudflare

## Features

- **HLS Manifest Rewriting**: Automatically rewrites `.m3u8` playlists to proxy all segment/key URLs through the worker
- **Binary Media Proxying**: Streams TS segments, MP4 files, and images with full Range request support (seeking works)
- **CORS Support**: Adds proper CORS headers for browser playback
- **Caching**: Caches playlists for 30s, media segments for 5min using Cloudflare KV
- **Same-Origin Protection**: Only proxies requests to the configured Xtream server
- **Redirect Handling**: Follows up to 3 redirects, but only within the same origin

## Quick Deploy

### 1. Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Create KV Namespaces

```bash
# Production namespace
wrangler kv:namespace create "XTREAM_CACHE"

# Preview namespace (for wrangler dev)
wrangler kv:namespace create "XTREAM_CACHE" --preview
```

Copy the IDs returned and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "XTREAM_CACHE"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

### 3. Set Secrets

```bash
# Required: Your Xtream server details
wrangler secret put XTREAM_BASE_URL
# Enter: http://redchicks.xyz:2052

wrangler secret put XTREAM_USERNAME
# Enter: adam@net

wrangler secret put XTREAM_PASSWORD
# Enter: 83632625225643
```

### 4. Deploy

```bash
# Deploy to production
wrangler deploy

# Or test locally first
wrangler dev
```

### 5. Configure Custom Domain (Optional)

In Cloudflare Dashboard → Workers & Pages → Your Worker → Triggers → Add Custom Domain.

## Usage from Browser

### Option 1: Direct Connection (Default)

The `XtreamClient` in `xtream-client.ts` connects directly to your Xtream server from the browser. This works if:
- Your server doesn't block residential IPs
- CORS is properly configured on the Xtream server

### Option 2: Cloudflare Worker Proxy (Recommended for Vercel)

If direct connection is blocked, use the worker:

1. Deploy the worker as above
2. In the XtreamPlayer UI, enter your worker URL in the "Proxy URL" field:
   ```
   https://your-worker.your-subdomain.workers.dev
   ```
   Or your custom domain:
   ```
   https://xtream-proxy.yourdomain.com
   ```

3. The client will automatically route all media through the worker:
   - Catalog API calls → Direct from browser (still works)
   - Media streams (HLS, MP4) → Through Cloudflare Worker

## How It Works

```
Browser → Xtream API (player_api.php) → Direct (catalog data)
Browser → HLS/MP4 streams → Cloudflare Worker → Xtream Server
```

### Playlist Rewriting

When the browser requests a playlist (`/proxy/live/user/pass/123.m3u8`):

1. Worker fetches the playlist from Xtream server
2. Rewrites all segment/key URLs from:
   ```
   http://server:port/live/user/pass/segment1.ts
   ```
   To:
   ```
   https://worker.workers.dev/proxy/live/user/pass/segment1.ts
   ```
3. Caches rewritten playlist for 30s
4. Returns to browser with CORS headers

### Media Segment Proxying

When the browser requests a segment:
1. Worker forwards request to Xtream server with Range header
2. Streams response back with CORS headers
3. Caches for 5min in KV

## Security

- Only proxies to the configured `XTREAM_BASE_URL` origin
- Blocks cross-origin redirects
- No credentials exposed in worker code (stored as secrets)
- Rate limiting via Cloudflare's built-in protection

## Monitoring

Check logs in Cloudflare Dashboard → Workers & Pages → Your Worker → Logs.

## Troubleshooting

### "Upstream authentication failed" (502)
- Check that `XTREAM_USERNAME` and `XTREAM_PASSWORD` secrets are correct
- Verify the account isn't expired or maxed out on connections

### "Cross-origin redirect blocked" (502)
- The Xtream server is redirecting to a different domain
- This is blocked for security; contact your provider

### Playback doesn't work
1. Check browser console for CORS errors
2. Verify worker is deployed and accessible
3. Test worker health: `https://your-worker.workers.dev/health`

### KV errors
- Ensure KV namespace is created and bound in `wrangler.toml`
- Check namespace IDs match

## Architecture

```
┌─────────────┐     Catalog API      ┌──────────────┐
│   Browser   │ ───────────────────▶ │ Xtream Server │
└─────────────┘   (player_api.php)   └──────────────┘
       │
       │ Media streams (HLS/MP4)
       ▼
┌─────────────┐     Proxy Request    ┌──────────────┐
│   Browser   │ ───────────────────▶ │ Cloudflare    │
└─────────────┘   (/proxy/...)        │ Worker        │
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Xtream Server │
                                       └──────────────┘
```

## Files

- `xtream-proxy.js` - Main worker code
- `wrangler.toml` - Wrangler configuration
- `README.md` - This file

## License

Part of Cloud Play project.