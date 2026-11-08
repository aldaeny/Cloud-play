# Free sports channels — what was verified and what was not

Date: 2026-11-08

## The request

Add free sports channels, specifically **قنوات الكأس (Al Kass)**, at zero cost,
publicly, without sign-in.

## What was actually verified

Every stream URL below was fetched and returned a real HLS manifest. Nothing was
guessed or copied without checking.

| Channel | Result |
| --- | --- |
| **العراقية الرياضية** (Al Iraqia Sport, IQ) | ✅ Live rolling playlist — `#EXT-X-MEDIA-SEQUENCE` advancing, real `.ts` segments. Iraqi Media Network's own CDN. **Added, playable.** |
| **عُمان الرياضية** (Oman Sports, OM) | ✅ Master playlist with 1080p / 720p / 480p / 240p variants. Mangomolo CDN used by Oman's public broadcaster. **Added, playable.** |
| **الكويت الرياضية** (KTV Sport, KW) | ✅ Re-verified, 240p–1080p. Already in the list. |
| **الأردن الرياضية** (Jordan Sport, JO) | Already in the list (upstream marks it geo-blocked in some regions). |
| Sharjah Sports | ❌ HTTP 500, and upstream marks it geo-blocked. **Not added.** |
| Bahrain Sports 1 | ⚠️ Manifest is valid, but it is served from a generic Wowza Streaming Cloud hostname with no attributable broadcaster ownership. Fails the curation rule "served from the broadcaster's own domain or its CDN". **Not added.** |

## Al Kass — the honest answer

**No open, free, credential-free Al Kass web stream could be verified.**

- The official site `https://www.alkass.net/` is live and is the real operator
  (Qatar Media Corporation).
- The historical live URLs listed on Wikipedia
  (`/alkass/live.aspx?ch=one`, `…two`, `…four`, `…five`, `…online`) now
  **redirect to the homepage** — they are dead.
- The only `alkassdigital.net` URL in the public iptv-org database belongs to
  **QBC**, a general entertainment channel, **not** Al Kass sports.
- Digital viewing now runs through Al Kass's own **Shoof (شوف)** app, and
  current match coverage there requires **activating a subscription**.
- Of the eleven Al Kass channels, **five are free-to-air** and **six are
  encrypted** through beIN. The encrypted transponder (10770 H) must never be
  presented as free.

So instead of inventing a stream URL or embedding a restreamer, Al Kass is
published as a **free-to-air satellite reference**: the free transponders plus
the operator's own page, clearly labelled **"لا تُشغّل داخل المنصة" / "Not
playable inside the platform"**.

The same treatment applies to **ثمانية (Thmanyah)**, whose official release
confirms free match coverage through 2031 via its app and satellite channels,
but for which no embeddable open HLS URL could be verified.

## Design

Two clearly separated tiers on `/tv-sources` → "قنوات منتقاة":

1. **Playable** — `src/server/public-tv.ts`, unchanged rules: broadcaster's own
   CDN, openly published, HTTPS, verified manifest. Now 33 channels, 4 of them
   sports.
2. **Reference only** — `src/server/free-to-air.ts` +
   `src/components/iptv/FtaReference.tsx`. Contains **no stream URL and no
   player**, only tuning data and an official link.

`free-to-air.ts` has a defensive `getFreeToAir()` guard (HTTPS official page,
non-empty bands, sane Ku-band values). Tuning details are transcribed from
public satellite-monitoring listings, dated, and carry a "may change — confirm
on the official site or rescan" disclaimer, because those listings contradict
each other on FEC and encryption status.

## Tests

`npm run test:fta` — 18 checks. The load-bearing ones:

- **No entry carries a stream-like field or an `.m3u8` URL anywhere.**
- Al Kass **does not** list the encrypted 10770 transponder.
- The status text explicitly names the encryption boundary.
- The component contains **no** `<video>`, player import, or stream reference.
- Thmanyah's Arabsat 11919 H and Al Kass's Nilesat 11919 H are **not conflated**
  (same numbers, different satellites — a real trap in the source data).
- The guard rejects malformed entries.

## Untouched

`/live`'s licensed-source gate and honesty strings, `legacySourcesAllowed()`
(still hardcoded `false`, `/api/iptv/iraq` still returns 503), and the
`/my-tv` owner gate are all unchanged.
