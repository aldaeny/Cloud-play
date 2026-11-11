# Cloud Play — hardware validation

## Status: NOT RUN (hardware); BLOCKED (access)

No physical device, remote-control lab or authorized cloud-device session was supplied. No item below is PASS. Chromium automation at mobile/TV viewports is recorded separately in application CI and cannot satisfy this matrix.

| Hardware/browser target | Result | Missing evidence |
| --- | --- | --- |
| iPhone/iPad — Safari iOS | NOT RUN | Physical model, iOS/Safari versions, tester/session |
| Mac — Safari macOS | NOT RUN | Real Mac/Safari environment and direct execution |
| Android phone/tablet — Chrome Android | NOT RUN | Physical Android model/OS/Chrome and direct execution |
| Android TV — TV browser/player | NOT RUN | Physical TV/box, model/OS/browser, remote |
| Google TV — TV browser/player | NOT RUN | Physical TV/box, model/OS/browser, remote |
| Other supported televisions/browsers | NOT RUN | Product-owner supported-model matrix plus devices |

For **each** target record date, tester, model, OS/build, browser version, transport/network, sanitized recording and per-case PASS/FAIL/BLOCKED/NOT RUN:

1. Registration/sign-in/logout/recovery (isolated accounts only).
2. RTL/LTR navigation, themes, portrait/landscape, no clipped controls.
3. Live TV, channel switching, categories, EPG, favorites.
4. M3U import/saved lists/server switching and Xtream live/movie/series/management.
5. Manifest → final segment, encrypted identity-key decoding where supported.
6. Authorized selection → short grant →45s renewal, pause/VOD seek preservation; native Safari HLS and MSE separately.
7. Auth refresh, absolute cap, logout/revocation, same-user different session.
8. IP/country change: private playback denies old selection; approved location requires fresh selection/import.
9. Fullscreen, back, focus order, physical remote, volume/subtitles/quality controls.
10. Offline/reconnect, timeout/provider errors; no infinite renewal on denied context.
11. No provider credential/origin in DOM, requests to third-party origins, console, or exported logs.

Do not contact a real IPTV provider without independent permission. Do not remove SSO or change production configuration to run these tests. Request device access through the authorized lab permission mechanism, never credentials in chat.
