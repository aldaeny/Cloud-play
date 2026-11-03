# Stage 3: Admin Control Panel (Next.js)

## Purpose
لوحة تحكم لإدارة المحتوى، الحقوق، النشر، والمستخدمين.
منفصلة عن موقع المشاهد (Cookies غير مشتركة).
هوية موظفين منفصلة (StaffUser).

## Key Sections (Based on "sync/global/channelGroups", "sync/global/managedPlaylist", "movieServers", "admin_channels")
1. **Content Management (Catalog, Media, Rights)**
   - `movieServers`: إدارة مصادر الأصول (الرفع، الترميز، S3/MinIO).
   - `sync/global/channelGroups`: تجميع القنوات/العناوين في مجموعات (للبث الحي المرخّص لاحقاً أو VOD).
   - `sync/global/managedPlaylist`: إدارة قوائم التشغيل المدارة (Home Rows, Banners).
   - `admin_channels`: إدارة القنوات/العناوين الإدارية (الحقوق، النشر، التدقيق).

2. **Editorial (Home Rows, Banners)**
   - تحرير الصفحة الرئيسية (الصفوف، الترتيب، البانرات).

3. **Users & Subscriptions**
   - عرض، إيقاف، استرداد (عبر البوابة).

4. **Finance (Invoices, Payments)**
   - عرض الفواتير، المدفوعات (Stripe/Tap).

5. **Analytics & Support**
   - مشاهدات، زمن مشاهدة، تذاكر الدعم.

## Implementation (Stage 3)
- Next.js (TypeScript)
- Tailwind CSS (Colors: brandDark, brandCard, cyanGlow, magentaGlow, violetGlow, amberGlow)
- API Integration (/v1/admin/...)
- Audit Log (Every write)

## Acceptance Criteria (Stage 3)
- No publish without rights (RightsService check).
- Audit log for every admin write.
- Tables, filtering, pagination.
