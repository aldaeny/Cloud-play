# Cloud Play Iraq — Free Account Model

Cloud Play Iraq is a **free** product. There is no paywall, checkout, or paid
subscription in the viewer. This document describes the free-account model and
the public deployment.

## Access model

- **Free account (Supabase Auth).** Visitors can create an account with email +
  password at no cost. `mailer_autoconfirm` is enabled, so sign-up signs the user
  in immediately.
- **Guest browsing still works.** Favorites and watch progress are stored in
  `localStorage` and work without an account.
- **Signed-in sync.** When a user signs in, the device library is merged with
  their cloud rows and kept in sync:
  - `cloudplay_favorites` — movie + channel favorites
  - `cloudplay_progress` — resume positions
- **No payment anywhere.** The billing module remains in the API for future
  flexibility but is non-blocking; checkout/coupon endpoints fail closed.

## Security

- The browser only ever receives the **public** Supabase URL + anon key
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Every table has **row-level security** with own-row policies
  (`auth.uid() = user_id`). A signed-in user can only read/write their own rows.
- The `service_role` / secret key and DB password are never exposed to the
  browser or committed to the repo.
- Schema is persisted in `supabase/migrations/`.

## API entitlement (free access)

`EntitlementService` defaults to **free access** (`FREE_ACCESS=true`). Free
access waives only the payment requirement; it still enforces:

- rights windows (licensing),
- stream limits,
- device limits.

An operator can re-enable the subscription gate with `FREE_ACCESS=false`.
`PlaybackService` no longer mislabels a free-access user as
`SUBSCRIPTION_REQUIRED` when a different check fails.

## Tests

- `apps/api` entitlement suite: free access default, rights/stream/device limits
  still enforced, paid gate when `FREE_ACCESS=false`.
- `apps/api` playback free-access suite: correct error mapping + fail-closed HLS.
- Web: `eslint`, `tsc --noEmit`, `next build`, and a headless browser harness
  (`free-account-check.mjs`) covering the login form, validation, settings
  account card, favorite sync event, and free copy.

## Deployment

- Web: Vercel project `cloud-play-iraq` → https://cloud-play-iraq.vercel.app/
- Accounts/sync: Supabase project `cloud-play-iraq`
  (`syscezbzxgnfxftfzaqa`, eu-central-1, free plan).
