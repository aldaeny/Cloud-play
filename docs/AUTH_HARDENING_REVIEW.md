# Supabase Auth hardening — compatibility review

Reviewed 2026-11-08 against project `syscezbzxgnfxftfzaqa` (`cloud-play-iraq`).
Priority 3 requires hardening **after** a compatibility review. This is that
review. **No auth setting was changed**, because the review found that the
high-value changes would break sign-in, recovery, or the one existing account.

Supabase Auth remains the single source of truth for identity and sessions
(D1 Option C). Nothing here replaces it.

---

## 1. Verified current configuration

| Setting | Current | Assessment |
|---|---|---|
| `site_url` | `https://cloud-play-iraq.vercel.app` | ✅ Correct |
| `uri_allow_list` | production `/**`, `http://localhost:3001/**`, `http://127.0.0.1:3001/**` | ⚠️ Dev redirects present in production |
| `jwt_exp` | `3600` (1h) | ✅ Reasonable |
| `refresh_token_rotation_enabled` | `true` | ✅ Good |
| `security_refresh_token_reuse_interval` | `10`s | ✅ Good |
| `mailer_autoconfirm` | **`true`** | ⚠️ Emails unverified — but see §2.1 |
| `smtp_host` | **`null`** (no SMTP) | ❌ Root blocker |
| `rate_limit_email_sent` | **`2`/hour** | ❌ Built-in mail is heavily throttled |
| `password_min_length` | `6` | ⚠️ Weak, and the UI matches it |
| `password_hibp_enabled` | `false` | ⚠️ No breached-password check |
| `security_captcha_enabled` | `false` | ⚠️ No bot protection |
| `security_update_password_require_current_password` | `false` | ⚠️ See §2.2 — **must stay false for now** |
| `sessions_timebox` / `sessions_inactivity_timeout` | `0` / `0` (disabled) | ⚠️ Sessions never expire |
| `mailer_notifications_*` | all `false` | ⚠️ No security-event emails |
| OAuth providers | all disabled | ✅ Email/password only, small surface |
| `mfa_totp_enroll_enabled` / `verify` | `true` / `true` | ✅ Available, not enforced |

### Account impact baseline
Exactly **one** account exists:
`dcf31e85-dd5b-4972-91aa-b11ba343508c` · `aldaeny60@gmail.com` ·
email confirmed · created 2026-11-05 · last sign-in 2026-11-05.
`confirmation_sent_at` is `null` while the email is confirmed — consistent with
`mailer_autoconfirm = true`. Any change must preserve this account's access.

---

## 2. Blocking compatibility findings

### 2.1 Disabling `mailer_autoconfirm` would break signup — BLOCKED
Turning off auto-confirm requires delivering a confirmation email. There is **no
SMTP configured**, and the built-in service is capped at **2 emails/hour**, which
is a development allowance, not production capacity. Disabling auto-confirm today
would leave new users unable to confirm and unable to sign in.

**Prerequisite:** configure custom SMTP, raise the email rate limit, verify a
confirmation email actually arrives, and only then set
`mailer_autoconfirm = false`.

Note this also gates the password-recovery fix below: the UI is now correct, but
**delivery** cannot be verified without SMTP.

### 2.2 Requiring the current password would break recovery — DO NOT ENABLE
`security_update_password_require_current_password = true` is normally good
hardening. It is **incompatible with the recovery flow just repaired**: a user who
forgot their password cannot supply the current one. Supabase grants a temporary
recovery session precisely so `auth.updateUser({ password })` can complete without
it. Enabling this now would re-break recovery.

**Prerequisite:** a separate, re-authenticated "change password" path for
signed-in users, distinct from recovery. Only then enable it.

### 2.3 Raising `password_min_length` needs a coordinated UI change
The web UI enforces **6** in three places (`AccountPanel.tsx:78`, `:101`, and
`minLength={6}` at `:204`) and its error copy says "at least 6 characters" in both
languages. Raising the server minimum alone would let the UI accept a password
the server then rejects, producing a confusing failure.

Existing sign-in is **not** affected (the minimum applies when a password is set),
so this is safe once the UI and copy are updated in the same change. Recommended
target: **8**, or 10 with `password_required_characters`.

### 2.4 Session timeouts would sign out the existing account
Setting `sessions_timebox` or `sessions_inactivity_timeout` invalidates existing
sessions. The standing instruction is to preserve accounts **and sessions**, so
this needs explicit approval and a user-visible warning first.

### 2.5 Enabling captcha needs frontend work
`security_captcha_enabled = true` without an hCaptcha widget and site key in the
sign-in/sign-up forms would make every auth attempt fail. Blocked until the
frontend integration exists.

### 2.6 Connector limitation — honest constraint
The available `update_auth_config` tool only accepts: `site_url`,
`uri_allow_list`, `jwt_exp`, `disable_signup`, `external_email_enabled`,
`external_phone_enabled`, `mailer_autoconfirm`, `sms_autoconfirm`,
`security_refresh_token_rotation_enabled`, `security_refresh_token_reuse_interval`.

It **cannot** set `password_min_length`, `password_hibp_enabled`,
`security_captcha_enabled`, session timeouts, `smtp_*`, or notification toggles.
Those must be changed in the Supabase dashboard. This is recorded so the gap is
not mistaken for completed work.

---

## 3. Bug found and fixed during this review

**Password recovery could never be completed.** `resetPasswordForEmail` was wired
up and the UI claimed a message was sent, but **nothing called `auth.updateUser`**.
Opening the reset link produced a temporary recovery session, rendered the normal
signed-in view, and offered no way to set a new password.

This was not theoretical: `auth.users.recovery_sent_at` is
`2026-11-05 14:02:05`, i.e. a recovery email was actually requested on this
account, and the flow had no completion step.

Fixed in `AccountProvider.tsx` + `AccountPanel.tsx` (commit *"fix(web): complete
password recovery"*): listen for `PASSWORD_RECOVERY`, show a new-password form
before the signed-in view, call `auth.updateUser({ password })`, and clear the
recovery flag only after Supabase confirms. Design freeze respected; 12 regression
tests including four design-freeze checks. **Delivery still NOT VERIFIED** — no
SMTP.

---

## 4. Recommended order of operations

Each step is independently reversible and must be verified before the next.

1. **Configure SMTP** (operator; dashboard). Send a test confirmation and a test
   recovery email to the existing account and confirm both arrive.
2. **Complete a real recovery round trip** end-to-end with the fixed UI.
3. **Disable `mailer_autoconfirm`** once step 1 is proven. Re-test signup.
4. **Raise `password_min_length` to 8** together with the UI minimum and both
   error strings. Re-test signup and recovery.
5. **Enable `password_hibp_enabled`.** Affects only new/changed passwords.
6. **Add a re-authenticated change-password path**, then enable
   `security_update_password_require_current_password`.
7. **Enable security-event notification emails** (password/email changed).
8. **Remove the `localhost` / `127.0.0.1` redirect entries** from the production
   allow-list once local development uses a separate Supabase project or branch.
   Left in place for now because removing them breaks local sign-in testing.
9. **Set session timebox/inactivity** — requires approval; will sign users out.
10. **Add captcha** with the frontend widget, then enable it.

---

## 5. Status

| Item | Status |
|---|---|
| Compatibility review | **COMPLETED AND VERIFIED** (config read directly; account impact checked) |
| Password-recovery completion bug | **COMPLETED AND VERIFIED** at the UI/state level (12 tests) |
| Recovery email delivery | **NOT VERIFIED** — no SMTP |
| SMTP + disable autoconfirm | **BLOCKED** — operator must configure SMTP first |
| Min length / HIBP / captcha / session timeouts | **NOT IMPLEMENTED** — prerequisites above; most not settable via the connector |
| Any production auth setting change | **NONE MADE** — deliberately, to avoid breaking the existing account |
