# هندسة منصة Aether (المرحلة 1)

## 1. المعمارية
نمط **Modular monolith + عامل ترميز منفصل**.
- **العملاء:** iOS/iPadOS/tvOS (SwiftUI)، Android/Android TV (Kotlin/Compose)، Web (Next.js)، LG webOS (Shell)، Admin (Next.js).
- **الحافة:** CDN + WAF، API Gateway TLS.
- **التطبيق:** NestJS API، عامل ترميز (FFmpeg)، عامل إشعارات.
- **البيانات:** PostgreSQL، Redis، S3/MinIO، BullMQ.
- **الخدمات الخارجية:** DRM License Provider، Stripe/Local Gateway، Email Provider، APNs/FCM.

## 2. تدفق التشغيل
1. `POST /playback/sessions` (فحص الاستحقاق)
2. إصدار `manifest URL` موقّع + `sessionId` + `drm config`
3. العميل يطلب `master.m3u8` من CDN
4. العميل يطلب ترخيص DRM (إذا وُجد)
5. نبضات (Heartbeat) كل 30 ثانية لتجديد التوقيع

## 3. تدفق المعالجة
`upload URL` (خاص) → فحص → `rights_approved` → طابور ترميز (FFmpeg) → HLS/DASH → QC → `published`

## 4. قاعدة البيانات (PostgreSQL)
- **الكيانات:** tenant, user, profile, device, plan, subscription, title, rights_window, season, episode, media_asset, playback_session, watch_progress, audit_log, outbox_event...
- **الحالات:** draft → metadata_review → rights_pending → rights_approved → processing → qc → published.

## 5. مواصفة API
- الأساس: `https://api.{tenant}/v1`
- المصادقة: `Authorization: Bearer`
- المشاهد: `/auth`, `/profiles`, `/home`, `/search`, `/titles`, `/playback/sessions`, `/billing`, `/me/...`
- الإدارة: `/v1/admin`

## 6. الواجهة البصرية (مستوحاة من التصميم المرفق)
- **الانميشن (Intro Layer):** 3.5 ثانية، انتقال الأيقونة والنص (Cairo/Inter fonts).
- **الألوان:** brandDark (#0a0a0c)، brandCard (#121217)، cyanGlow (#00e5ff)، magentaGlow (#ff2085)، violetGlow (#7b30ff)، amberGlow (#ffb000).
- **التصميم:** 3D Carousel Experience، قسم IPTV Live Stream (نموذج مرجعي)، محاكي الجوال (Mobile App Simulator).
- **الوضع:** داكن افتراضي، RTL/LTR.

## 7. الأمان والامتثال
- كلمات المرور/PIN: Argon2id.
- JWT قصير، Refresh تدوير.
- WAF، TLS، تحديد معدل.
- GDPR، سياسة خصوصية، شروط.
- Sentry، Prometheus/Grafana.

## 8. مراحل التنفيذ
1. **المرحلة 1:** المعمارية، المخطط، OpenAPI، هيكل المستودع، Compose، تصميم الواجهة (تم).
2. **المرحلة 2:** API (هوية، ملفات، كتالوج، حقوق، رفع، استحقاق، تشغيل موقّع) + اختبارات.
3. **المرحلة 3:** لوحة التحكم.
4. **المرحلة 4:** ويب المشاهد (Next.js) + ربط الإدارة (استلهام التصميم).
5. **المرحلة 5-7:** Android, iOS, webOS.
6. **المرحلة 8:** الإنتاج، CDN، اشتراكات، مراقبة.

## 9. التشغيل المحلي
```bash
docker compose -f infra/docker/compose.yml up -d
pnpm install
pnpm --filter api prisma migrate dev
pnpm --filter api dev
```
