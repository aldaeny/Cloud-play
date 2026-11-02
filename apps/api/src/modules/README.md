# NestJS Modular Monolith - Aether API (Stage 2)

## Structure
apps/api/src/modules/
├── identity/          # حسابات، JWT، OAuth، أجهزة، جلسات
├── profiles/          # ملفات، رقابة أبوية، PIN
├── catalog/           # عناوين، مواسم، حلقات، أشخاص، بحث
├── rights/            # نوافذ الحقوق، المناطق، حالة الاعتماد
├── media/             # أصول، ترجمات، سلالم جودة، مهام ترميز
├── entitlement/       # هل يحق لهذا الملف تشغيل هذا الأصل الآن؟
├── playback/          # جلسة، نبض، تقدم، حد التزامن، رابط موقّع
├── billing/           # خطط، اشتراك، فواتير، كوبونات، webhooks
├── editorial/         # الصفحة الرئيسية، البانرات، الصفوف
├── admin/             # أدوار وصلاحيات وسجل تدقيق
├── notifications/     # بريد، دفع، داخل التطبيق
├── support/           # تذاكر
└── analytics/         # أحداث مشاهدة مجمّعة

## Core Modules (Stage 2 Implementation)

### 1. Identity Module
- `IdentityService`: تسجيل، تسجيل دخول، تدوير Refresh Token، إبطال الجلسة.
- `AuthGuard`: حماية المسارات (Bearer JWT).
- `DeviceService`: إدارة الأجهزة (الحد الأقصى).

### 2. Profiles Module
- `ProfileService`: إنشاء، قائمة، PIN (Argon2id)، رقابة أبوية (Maturity Max).

### 3. Catalog Module
- `CatalogService`: بحث (PostgreSQL tsvector + pg_trgm)، تفاصيل العناوين، المواسم، الحلقات.
- `SearchController`: `/search?q&genre&year&lang&rating`.

### 4. Rights Module
- `RightsService`: نوافذ الحقوق (المناطق، البداية/النهاية)، حالة الاعتماد (`rights_approved`).
- `RightsGuard`: منع النشر بدون حقوق سارية.

### 5. Media Module
- `MediaService`: رفع الأصل (Signed URL)، فحص النوع/الحجم، مهام الترميز (BullMQ + FFmpeg).
- `TranscodeWorker`: إنتاج HLS/DASH (1080p, 720p, 480p, 360p).

### 6. Entitlement Module
- `EntitlementService`: فحص الاستحقاق (الاشتراك، الحقوق، التقييم، حد التزامن، حد الأجهزة).

### 7. Playback Module
- `PlaybackController`: `POST /playback/sessions`, `POST /playback/sessions/{id}/heartbeat`, `POST /playback/sessions/{id}/end`.
- `PlaybackService`: إصدار `manifestUrl` موقّع، إدارة النبضات (Heartbeat).

### 8. Billing Module
- `BillingService`: الخطط، الاشتراك، الفواتير، الكوبونات.
- `StripeWebhookController`: `/billing/webhooks/stripe`.

### 9. Editorial Module
- `EditorialService`: الصفحة الرئيسية (Home Rows)، البانرات، الصفوف.

### 10. Admin Module
- `AdminController`: `/v1/admin/...` (CRUD عناوين، حقوق، نشر، مستخدمين، إلخ).
- `AuditLogService`: سجل التدقيق (كل كتابة إدارية).

### 11. Notifications Module
- `NotificationService`: بريد، دفع، داخل التطبيق (Outbox Pattern).

### 12. Support Module
- `SupportService`: تذاكر الدعم.

### 13. Analytics Module
- `AnalyticsService`: أحداث المشاهدة المجمّعة (ليس بديلًا لسجل التدقيق).

## Stage 2 Acceptance Criteria
- Unit: آلة حالات النشر، حساب حد الجلسات، انتهاء النافذة الجغرافية/الزمنية.
- Integration: تسجيل، رفض تشغيل بلا اشتراك، رفض تقييم أعلى من الملف، 409 عند تجاوز التدفقات، webhook مكرر لا يضاعف الاشتراك.
- Contract: OpenAPI مقابل الاستجابات.
