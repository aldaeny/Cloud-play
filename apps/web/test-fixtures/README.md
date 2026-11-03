# Test fixtures

## `iptv-org-iq-2026-11-03.m3u`

Byte-identical copy of the public Iraqi playlist fetched on 2026-11-03 from
`iptv-org/iptv` → `streams/iq.m3u` (the repo file that the
`https://iptv-org.github.io/iptv/countries/iq.m3u` build publishes).
8,445 bytes, 146 lines, sha256 `d68091ae…` (asserted in the test).

It is committed because:

* the parser's acceptance numbers must be reproducible without internet access;
* it contains only publicly published channel URLs, no credentials or tokens;
* it lets CI prove the real-world shape (HTTP entries, duplicate names, a
  `[Geo-blocked]`/`BLOCKED` name, VLC player options) is handled.

Replacing it with a newer export is fine; the parser tests assert invariants
(parse counts, playability rules), not exact channel names.
