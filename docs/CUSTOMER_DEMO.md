# Reproducible local customer demo — original media only

No external IPTV server or copyrighted media is needed. No real charge occurs.
Use the local self-hosted installation in SELF_HOSTED_PACKAGE.md. Complete all
runtime checks first. This is an operator-authorized **synthetic** account, not a
customer email-verification or production-access claim.

1. Generate original test-pattern video, sine-wave audio and subtitles:

   ```
   FFMPEG=/absolute/path/to/ffmpeg node scripts/generate-media-fixtures.mjs .cache/media-fixtures
   ```

   FFmpeg must already be installed on the operator's local machine. Do not download
   arbitrary media or enable a provider. The generator needs no paid service.
2. Import into the local private MinIO/Prisma catalog and create a unique account
   in the real local GoTrue authority:

   ```
   RELEASE=$(git rev-parse HEAD)
   node scripts/selfhost/cli.mjs demo-import cloudplay-local-demo "$RELEASE"
   ```

   Credentials and title/profile/device identifiers are written only to
   `.selfhost/demo/customer-demo.json` (private, ignored by Git), never logs. Do not
   paste that file into chat. Imports are additive; no existing customer rows are
   deleted. Repeated output is refused. Failed imports may leave a synthetic Auth
   account or objects; automatic destructive cleanup is intentionally absent.
3. Log into the existing viewer with the generated account after trusting the local
   Auth certificate. In administration, show tenant branding, synthetic title,
   internal plans and audit records. Verify the backend catalog with `/search` and
   `/titles/:id` using the real Supabase access bearer, not a client tenant ID.
4. For protected VOD, enable `VOD_DELIVERY_ENABLED=true`, set a unique
   `VOD_SIGNING_KEY`, and use Supabase authority. The backend accepts the existing
   POST `/playback/sessions` body with title/profile/device IDs; it additionally
   requires a trusted **server-issued**, request-bound Geo assertion scoped to
   `vod:<titleId>`. Returned manifest/resource URLs still require the bearer and
   trusted Geo on every request. **Never put the bearer in the media URL.**

## Deliberate remaining demo gate

The new backend VOD path is verified via actual Nest/DB HTTP tests with explicit
Auth/object-store fixtures; the existing browser player is preserved. A secure
viewer-to-VOD bridge and a self-hosted trusted Geo ingress are not yet wired into
one customer-facing flow. The current static movie selection does not automatically
become the Prisma VOD catalog. Do not claim step4 plays in the viewer merely because
import succeeded. Do not spoof Vercel headers/flags on a local server or synthesize
a real country from a browser header to make it pass.

The shipped regression harness is reproducible proof for the protected backend:
`npm run test:postgres:native --workspace aether-api` in CI. Browser fixture decoding
is separate proof, not a physical device or full unified customer demo. Until that
last bridge/ingress/catalog integration is completed and tested, the full
customer-presentable connected-player demo remains **PARTIAL**, not ready to sell.
