# Outbound connection inventory and remaining SSRF work

Source scan: `rg -n 'fetch\(|https?\.request\(|axios' apps --glob '*.{ts,tsx,js,mjs,cjs}'` excluding generated builds/tests/scripts. This inventories direct calls, not all SDK internals/browser media/image loads.

| Source | Classification / disposition |
|---|---|
| `apps/web/src/server/xtream.ts:52` | Operator provider/source or stream origin; direct fetch remains unpinned. Requires conversion and contract tests. NOT globally protected. |
| `apps/web/src/server/xtream-private.ts:129` | Operator provider/source or stream origin; direct fetch remains unpinned. Requires conversion and contract tests. NOT globally protected. |
| `apps/web/src/server/iraq-playlist.ts:40` | Operator provider/source or stream origin; direct fetch remains unpinned. Requires conversion and contract tests. NOT globally protected. |
| `apps/web/src/server/firebase-public.ts:25` | Fixed public source; no request-selected host, redirect denied. Socket pinning not implemented. |
| `apps/web/src/server/api-bridge.ts:147` | Trusted operator-configured internal API origin; private networking is intentional. No public-IP filter should be applied blindly. Redirect denied. |
| `apps/web/src/lib/owner-api.ts:19` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/lib/channels.ts:17` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/lib/channels.ts:84` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/components/iptv/LicensedTv.tsx:14` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/components/iptv/PrivatePlayer.tsx:83` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/components/iptv/PublicTv.tsx:107` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/components/iptv/PublicTv.tsx:117` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/components/iptv/CommunityTv.tsx:129` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/src/components/account/OwnerPlayerLink.tsx:41` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/web/pages/api/xtream/stream.ts:75` | Operator provider/source or stream origin; direct fetch remains unpinned. Requires conversion and contract tests. NOT globally protected. |
| `apps/web/pages/api/iptv/community.ts:38` | Fixed public source; no request-selected host, redirect denied. Socket pinning not implemented. |
| `apps/web/pages/api/movies/watch/[id].ts:77` | Fixed archive.org metadata endpoint, curated IDs; automatic redirects currently remain unpinned. Must migrate and test. |
| `apps/api/src/common/supabase-auth.service.ts:128` | Configured Supabase HTTPS identity endpoint; redirect denied, not request-controlled. DNS pinning not implemented. |
| `apps/admin/pages/index.tsx:21` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/pages/index.tsx:34` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:54` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:73` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:102` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:113` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:124` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:136` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:151` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/components/xtream-servers-panel.tsx:165` | Browser same-origin API call; not a server-side arbitrary URL transport. |
| `apps/admin/lib/backend.ts:15` | Trusted operator-configured internal API origin; private networking is intentional. No public-IP filter should be applied blindly. Redirect denied. |

Additional transports: Nest `pinned-provider-request.ts` uses HTTPS with pinned lookup and certificate verification. Web `safe-fetch.ts` now uses `pinned-get.ts` with actual validated socket lookup and per-hop checks. Supabase SDK in `src/lib/supabase.ts` has its own identity/network stack. Native browser HLS/DASH/image traffic is not server SSRF but still requires source/CSP/privacy review.

## Fresh Web socket evidence

`node apps/web/tests/pinned-fetch.test.mjs`:13checks pass against actual local HTTP sockets with fixture DNS/routing. Covers public-preflight/private-connect rebinding, mixed address families/malformed address, IPv4/IPv6 mapped/transition, actual redirect to private, stream cap and stall timeout. Actual TLS/SNI/certificate tests currently cover the Nest transport, not Web transport; Web TLS-specific fixture coverage remains absent. HTTPS-to-HTTP downgrade is now denied. DNS resolution has2s bound and stream response remains under overall deadline. Existing playlist route suite44pass uses explicitly labeled mock transport, not actual upstream.

Global SSRF acceptance remains **NOT IMPLEMENTED**. Do not treat this inventory or a fixed hostname as proof of pinned sockets. No redchicks probe or external provider request was performed.
