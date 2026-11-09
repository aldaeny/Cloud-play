# تحديث 2026-11-08 — الخطة المحدّثة

**حالة الميزات الموثوقة: `FEATURE_STATUS.md`.** هذا الملف يحتوي ترتيب التنفيذ والقرارات المفتوحة.
الأقسام المؤرخة 2026-11-01 أدناه تاريخية؛ مراحل تأسيس الـ API المذكورة فيها أُنجزت لاحقًا.

## القرار المفتوح D1 — لازم قبل مراحل 2/4/5/6/8

الويب المنشور يعمل على Supabase، وواجهة NestJS (32 نموذجًا) غير منشورة ولا يستدعيها الويب. اختر واحدًا:

- **A — ربط الويب بـ NestJS:** نشر الـ API على مضيف غير serverless، وتوحيد الحسابات والبيانات فيه. أقوى وأكثر عملًا.
- **B — التوحيد على Supabase:** توسيع جداول Supabase وRLS، وترك NestJS غير مستخدم. أسرع وأقل كلفة، لكن يهدر كودًا مكتوبًا.
- **C — هجين:** Supabase للحسابات، NestJS للكتالوج والمزامنة والاشتراكات. وسطٌ، مقابل حدود أوضح.

لم يُتخذ القرار بعد، ولذلك لم يُهاجَر أي حساب ولم يُربط الويب بالـ API من طرف واحد.

## ترتيب التنفيذ الموصى به (يختلف عن ترقيم المراحل)

1. حسم D1.
2. رفع الحجب عن `prisma generate` وتشغيل اختبارات الـ API حتى تصبح خضراء.
3. نشر الـ API خارج serverless (المزامنة والبث المستمر لا يناسبان `maxDuration: 60`).
4. محرك تعدد السيرفرات: priority / isDefault / lastSyncAt / اختبار اتصال / وظيفة مزامنة.
5. المسلسلات + VOD (حاليًا المسلسلات مجرد نص حالة فارغة).
6. وحدات لوحة الإدارة، ثم الاشتراكات بعد توفّر مزوّد دفع موثّق.

## ما أُنجز في هذا الفرع (مُختبَر فعليًا)

- **مرحلة 9:** بحث يتعامل مع العربية بشكل صحيح (`src/lib/search-normalize.ts`)، موصول بمواضع البحث الأربعة.
- **مرحلة 10:** CSP + HSTS + Permissions-Policy (`security-headers.js`)، مع صفر مخالفات CSP في متصفح حقيقي.
- **400 فحص ناجح / صفر فاشل**، و`tsc` صفر أخطاء، والبناء ناجح.

## مخاطر مفتوحة تحتاج إجراءً منك

- **Xtream يعمل على HTTP صريح** (`XTREAM_ALLOW_HTTP=true`, منفذ 2052): بيانات الدخول تعبر الشبكة غير مشفّرة. الحل منفذ HTTPS من المزوّد (غالبًا 2053) ثم `XTREAM_ALLOW_HTTP=false`.
- **CSP يحتوي `script-src 'unsafe-inline'`** لأن Next.js يحقن سكربتات hydration ضمنية؛ إزالتها تحتاج nonce pipeline. موثّق ومقصود، وليس مُتجاهَلًا.
- **النشر:** لم يُنشر هذا الفرع. بانتظار موافقتك الصريحة.

---

# IMPLEMENTATION_PLAN.md — Aether / Cloud Play

## Date: 2026-11-01

---

## Execution Strategy

Work in small, verifiable stages. For each stage: inspect → identify → fix → test → document.

---

## STAGE 1: API Foundation (Critical)

### 1.1 Fix API package.json
- Add NestJS, Prisma, JWT, argon2, class-validator, class-transformer
- Add development dependencies (TypeScript, @types, ts-node)
- Add scripts: dev, build, test, lint

### 1.2 Create prisma.service.ts
- PrismaClient wrapper with lifecycle hooks
- Connect/disconnect management

### 1.3 Create identity.dto.ts
- RegisterDto with class-validator decorators
- LoginDto with email/phone + password validation

### 1.4 Create missing module files
- media.module.ts, entitlement.module.ts, billing.module.ts
- editorial.module.ts, admin.module.ts, notifications.module.ts
- support.module.ts, analytics.module.ts

### 1.5 Fix bcrypt → Argon2id
- Replace bcrypt with argon2 in identity.service.ts

### 1.6 Create NestJS entry point
- main.ts with bootstrap
- Global validation pipe
- CORS configuration

### 1.7 Create nest-cli.json

### 1.8 Create tsconfig.json for API

---

## STAGE 2: Web App Configuration (Critical)

### 2.1 Create web package.json
- Next.js, React, Tailwind CSS
- Scripts: dev, build, start

### 2.2 Create next.config.js
- React Strict Mode
- Image optimization config

### 2.3 Create tsconfig.json for web

### 2.4 Create _app.tsx and _document.tsx
- Global CSS import
- Font loading (Cairo, Inter)

---

## STAGE 3: Admin App Configuration (Critical)

### 3.1 Create admin package.json
- Next.js, React, Tailwind CSS

### 3.2 Create next.config.js for admin

### 3.3 Create tsconfig.json for admin

### 3.4 Create admin auth library
- apps/admin/lib/auth.ts with token verification

---

## STAGE 4: Docker & Infrastructure (Critical)

### 4.1 Create Dockerfiles
- apps/api/Dockerfile
- apps/web/Dockerfile
- apps/admin/Dockerfile
- apps/worker-media/Dockerfile + app structure

### 4.2 Fix compose.prod.yml
- Use environment variable interpolation

### 4.3 Create .dockerignore files

---

## STAGE 5: Configuration & Security (High)

### 5.1 Create .gitignore
- Node modules, env files, uploads, build output

### 5.2 Update .env.example
- Add DEFAULT_TENANT_ID
- Add all missing variables

### 5.3 Fix default tenant ID in code
- Use environment variable instead of hardcoded UUID

---

## STAGE 6: Testing & Validation

### 6.1 Create test files for core modules
- Identity service tests
- Profiles service tests
- Rights service tests

### 6.2 Validate TypeScript compilation
- Run tsc --noEmit

### 6.3 Validate Prisma schema
- Run prisma validate

---

## STAGE 7: Documentation

### 7.1 Update README.md with current status
### 7.2 Complete OpenAPI specification
### 7.3 Create setup guide

---

## Dependencies Between Stages

- Stage 1 must complete before Stage 2-4 (API is foundation)
- Stage 2 and 3 are independent
- Stage 4 depends on Stage 1-3 (Dockerfiles reference app code)
- Stage 5 can run in parallel
- Stage 6 depends on Stage 1-3
- Stage 7 depends on all stages

---

## Files to Create (Total: ~30 files)

### Stage 1 (API):
1. apps/api/package.json
2. apps/api/src/prisma.service.ts
3. apps/api/src/modules/identity/identity.dto.ts
4. apps/api/src/modules/media/media.module.ts
5. apps/api/src/modules/entitlement/entitlement.module.ts
6. apps/api/src/modules/billing/billing.module.ts
7. apps/api/src/modules/editorial/editorial.module.ts
8. apps/api/src/modules/admin/admin.module.ts
9. apps/api/src/modules/notifications/notifications.module.ts
10. apps/api/src/modules/support/support.module.ts
11. apps/api/src/modules/analytics/analytics.module.ts
12. apps/api/src/main.ts
13. apps/api/nest-cli.json
14. apps/api/tsconfig.json

### Stage 2 (Web):
15. apps/web/package.json
16. apps/web/next.config.js
17. apps/web/tsconfig.json
18. apps/web/pages/_app.tsx
19. apps/web/pages/_document.tsx

### Stage 3 (Admin):
20. apps/admin/package.json
21. apps/admin/next.config.js
22. apps/admin/tsconfig.json
23. apps/admin/lib/auth.ts
24. apps/admin/pages/_app.tsx
25. apps/admin/pages/_document.tsx

### Stage 4 (Docker):
26. apps/api/Dockerfile
27. apps/web/Dockerfile
28. apps/admin/Dockerfile
29. apps/worker-media/Dockerfile
30. apps/worker-media/package.json
31. apps/worker-media/src/worker.ts
32. .gitignore

---

## Success Criteria

- [ ] API compiles without TypeScript errors
- [ ] Web app builds successfully
- [ ] Admin app builds successfully
- [ ] Docker Compose starts all services
- [ ] Prisma schema validates
- [ ] Tests pass
