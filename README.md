# Aether / Cloud Play — Streaming Platform

## Status: PARTIAL — NOT READY FOR PRODUCTION

The sections below are historical and may contain outdated claims. `FINAL_REPORT.md` and `INFRASTRUCTURE_TEST_REPORT.md` supersede them: playback is fail-closed, storage privacy is not proven, Docker/CDN/payment/DRM and mobile playback are unverified, and API lint passes, but dependency audit reports remaining vulnerabilities. Server-side logout/revocation and payment cancellation are not implemented and return 503.

---

## Overview

A full-stack streaming platform (VOD/IPTV) built with:
- **Backend**: NestJS + Prisma + PostgreSQL
- **Web**: Next.js (React)
- **Admin**: Next.js Admin Dashboard
- **Mobile**: Android (Kotlin), iOS (Swift), webOS (HTML)
- **Infrastructure**: Docker Compose, MinIO, Redis, FFmpeg worker

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker (for production)
- FFmpeg (for media transcoding)

### Development

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Start infrastructure (Docker):**
   ```bash
   cd infra/docker
   docker-compose -f compose.yml up -d
   ```

3. **Install API dependencies:**
   ```bash
   cd apps/api
   npm install
   ```

4. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Start API server:**
   ```bash
   npm run dev
   ```
   API runs on http://localhost:3000

7. **Start Web app:**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
   Web app runs on http://localhost:3001

8. **Start Admin app:**
   ```bash
   cd apps/admin
   npm install
   npm run dev
   ```
   Admin app runs on http://localhost:3002

---

## API Endpoints

> ✅ **OpenAPI 3.0.3 spec متوفر** في [`docs/api/openapi.yaml`](docs/api/openapi.yaml) — يطابق الكود الفعلي في `apps/api/src` (16 مساراً، موسوّم بـ tags، مع security schemes و schemas).

### Authentication
- `POST /auth/register` — Register a new user (email, password, name, phone)
- `POST /auth/login` — Login with email/password
- `POST /auth/refresh` — Refresh access token (refresh_token)
- `POST /auth/logout` — Logout

### Profiles
- `GET /profiles` — List user profiles
- `POST /profiles` — Create profile (name, is_kid, maturity_max, pin)
- `POST /profiles/{id}/verify-pin` — Verify PIN

### Catalog
- `GET /home` — Home page (editorial rows + continue watching)
- `GET /search` — Filtered search (q, genre, year, lang, rating)
- `GET /titles/{id}` — Title details
- `GET /titles/{id}/episodes` — Series episodes (published only)

### Playback
- `POST /playback/sessions` — Start playback session (entitlement check)
- `POST /playback/sessions/{id}/heartbeat` — Session heartbeat
- `POST /playback/sessions/{id}/end` — End session
- `GET/PUT /me/progress` — Watch progress

### Billing
- `POST /billing/checkout` — Stripe checkout session
- `POST /billing/webhooks/stripe` — Stripe webhook

### Admin
- `GET/POST/PUT/DELETE /api/admin/titles` — Manage titles (Next.js admin API route)

---

## Architecture

### Backend Modules
- **IdentityModule**: User registration, login, JWT authentication (Argon2id password hashing)
- **CatalogModule**: Title search and discovery
- **ProfilesModule**: User profiles with PIN protection
- **RightsModule**: Rights window management
- **PlaybackModule**: Playback session management with entitlement checks
- **EntitlementModule**: Subscription and entitlement checking
- **MediaModule**: Media asset management
- **BillingModule**: Subscription billing
- **EditorialModule**: Content editorial workflow
- **AdminModule**: Admin API routes
- **NotificationsModule**: User notifications
- **SupportModule**: Support tickets
- **AnalyticsModule**: Analytics and metrics

### Database Models (Prisma)
- Tenant, TenantBranding, FeatureFlag
- AppUser, Profile, Device
- Plan, Subscription, Invoice, Payment, Coupon
- Title, Season, Episode
- MediaAsset, TranscodeJob
- PlaybackSession, WatchProgress
- Favorite, WatchlistItem
- HomeRow, HomeRowItem, Banner
- StaffUser, Role, AuditLog
- OutboxEvent, Notification, SupportTicket

### Security
- Argon2id password hashing
- JWT authentication (access + refresh tokens)
- CORS configuration
- Global validation pipes
- Admin token verification

---

## Testing

```bash
cd apps/api
npm test
```

Test Coverage:
- IdentityService: 9 tests (register, login, refresh, logout)
- ProfilesService: 5 tests (createProfile, getProfiles, verifyPin)
- RightsService: 4 tests (checkRights, getTerritories)
- EntitlementService: 5 tests (check, grantSubscription, revokeSubscription)

**Total: 23 tests, all passing**

---

## Documentation

- **[OpenAPI 3.0.3 Spec](docs/api/openapi.yaml)** — Full API reference (16 paths, auth, profiles, catalog, playback, billing, admin)
- **[Architecture](docs/architecture.md)** — System architecture, data flow, DB models, security, phases
- **[Implementation Plan](IMPLEMENTATION_PLAN.md)** — Phase-by-phase plan
- **[Project Audit](PROJECT_AUDIT.md)** — Audit findings
- **[Errors & Fixes Log](ERRORS_AND_FIXES.md)** — All errors encountered and their resolutions

---

## Mobile & TV Apps

Three native client apps, all integrating with the same OpenAPI spec:

### Android / Android TV (Kotlin + Compose)
- **Location**: [`mobile/android/`](mobile/android/)
- **Player**: ExoPlayer (media3) — signed HLS playback + DRM
- **Network**: Retrofit + OkHttp (matches OpenAPI spec)
- **TV**: Leanback + D-Pad focus engine
- **Screens**: Auth, Home, Search, Profiles, Player
- **Theme**: Dark default (#0a0a0c), RTL/LTR Arabic/English

### iOS / iPadOS / tvOS (SwiftUI)
- **Location**: [`mobile/ios/`](mobile/ios/)
- **Player**: AVPlayer — signed HLS playback
- **Network**: URLSession + Codable (matches OpenAPI spec)
- **TV**: Focus Engine (tvOS)
- **Screens**: Auth, Home, Search, Profiles, Player
- **Accessibility**: VoiceOver support

### LG webOS (HTML/JS)
- **Location**: [`mobile/webos/`](mobile/webos/)
- **Player**: Video.js — signed HLS playback
- **Network**: fetch-based API client
- **TV**: D-Pad navigation, webOS focus
- **Build**: `mobile/webos/tools/build.sh`

### Shared Design System
All apps use the same brand identity:
- `brandDark`: `#0a0a0c` · `brandCard`: `#121217`
- `cyanGlow`: `#00e5ff` · `magentaGlow`: `#ff2085`
- `violetGlow`: `#7b30ff` · `amberGlow`: `#ffb000`
- **Fonts**: Cairo (Arabic/RTL), Inter (Latin/LTR)
- **UI Kit**: [`packages/ui-tokens/tokens.json`](packages/ui-tokens/tokens.json)

---

## Docker Production Deployment

```bash
# Set environment variables
export DATABASE_URL="postgresql://aether:aether@postgres:5432/aether"
export JWT_ACCESS_SECRET="your-secret-key"
export JWT_REFRESH_SECRET="your-refresh-secret"
export ADMIN_JWT_SECRET="your-admin-secret"

# Build and start
docker-compose -f infra/docker/compose.prod.yml up -d --build
```

Services:
- **postgres**: PostgreSQL 16
- **redis**: Redis 7
- **minio**: Object storage
- **api**: NestJS API on port 3000
- **web**: Next.js web app on port 3001
- **admin**: Next.js admin app on port 3002
- **worker-media**: FFmpeg transcoding worker on port 3004

---

## Brand Identity

### Colors
- `brandDark`: `#0a0a0c`
- `brandCard`: `#121217`
- `cyanGlow`: `#00e5ff`
- `magentaGlow`: `#ff2085`
- `violetGlow`: `#7b30ff`
- `amberGlow`: `#ffb000`

### Typography
- **Cairo**: Arabic text (RTL)
- **Inter**: Latin text (LTR)

---

## License

UNLICENSED — Private Project
