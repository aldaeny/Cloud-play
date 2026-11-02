# تشغيل CLOUD PLAY مجاناً على جهازك — للتجربة المحلية فقط

هذه طريقة مقترحة للتطوير على كمبيوتر باستخدام Docker Desktop وNode.js، بدون حساب سحابي أو دفع. **لم نستطع اختبار Docker في بيئة العمل الحالية**؛ يلزم تنفيذ الخطوات والتحقق من النتائج على جهازك. وهي ليست جاهزة للإطلاق العام: البث والدفع وDRM غير مكتملة، و`logout` لا يبطل الرموز على الخادم.

## المتطلبات
- Docker Desktop مع Compose v2، وNode.js إصدار 20.9 أو أحدث، واتصال إنترنت لتنزيل الصور والحزم.
- مساحة كافية للصور وملفات الفيديو؛ منافذ localhost التالية خالية: 3000 و3001 و3002 و9000 و9001.
- افتح Terminal داخل مجلد المشروع بعد فك ZIP. لا تنفذ هذه الخطوات على قاعدة عملاء أو إنتاج.

## 1. إعداد أسرار تجريبية
```sh
node scripts/setup-local-env.js
```
ينشئ `.env` بأسرار محلية عشوائية؛ لا يعرضها ولا يستبدل ملف `.env` موجوداً. احتفظ به محلياً ولا تشاركه. إذا كان لديك `.env` من مشروع آخر فلا تحذفه تلقائياً؛ انقله احتياطياً بعد التأكد من محتواه قبل توليد ملف جديد.

## 2. بناء الخدمات وتهيئة قاعدة البيانات
نفّذ كل أمر من جذر المشروع، وانتظر انتهاء الأمر السابق؛ استخدم الأوامر كما هي على PowerShell أو Terminal. أمر `config` يعرض القيم وقد يعرض أسرار `.env`، لذا لا تشارك مخرجاته:

```sh
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml config
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml up -d postgres redis minio minio-init
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml build api worker-media web admin
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml run --rm --no-deps api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml up -d api worker-media web admin
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml ps
```

افتح `http://localhost:3001` للويب و`http://localhost:3002` للإدارة. `http://localhost:3000/health` يفحص اتصال API بقاعدة البيانات فقط. منفذ التخزين خاص بالجهاز عبر `localhost:9000`، ولوحة MinIO على `localhost:9001`؛ لا تفتح منافذ التخزين أو قاعدة البيانات للعامة.

## 3. بيانات تجريبية اختيارية للإدارة
**لقاعدة محلية جديدة ومخصصة للتجارب فقط**، إن رغبت ببيانات تجريبية وحساب إدارة:

```sh
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml run --rm --no-deps -e NODE_ENV=development api sh -c "cd apps/api && npx prisma db seed"
```

بعد ذلك يمكن تجربة الدخول في صفحة الإدارة بالبريد `admin@aether.local` وكلمة المرور `admin123456`. هذه بيانات منشورة ومعروفة وليست آمنة؛ **لا تنشر هذا النظام، ولا تستخدم Cloudflare Tunnel أو أي رابط عام معه، ولا تستخدم seed للإنتاج أو لبيانات حقيقية**. الدخول يعرض عناوين المؤسسة قراءةً فقط؛ أزرار التحرير الكامل، إدارة الجلسة وإبطال الرمز لم تكتمل. مسح الجلسة من الصفحة يزيل الرمز من الذاكرة فقط ولا يبطله على الخادم.

## 4. الإيقاف والمشكلات
```sh
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml logs --tail=100
docker compose --env-file .env -f infra/docker/compose.yml -f infra/docker/compose.local.yml down
```
`down` يوقف الحاويات ويحافظ على volumes. لا تستخدم `down -v` إلا إذا كنت تقصد حذف قاعدة البيانات والملفات نهائياً. إذا فشل أمر، احتفظ برسالة الخطأ **بعد إزالة أي أسرار** وشاركها لتشخيصها. لا تشارك `.env` أو بيانات الاتصال.

## حدود وخصوصية
- لم تختبر صور Docker وMinIO أو الـvolumes في هذه البيئة. لا تُفسر خطوات الإعداد على أنها PASS.
- تشغيل مشغل فيديو مدفوع وتوقيع كل أجزاء HLS وCDN غير مكتمل؛ لم يختبر تشغيل iOS أو Android. روابط S3 الموقّعة لا تكفي وحدها لإثبات الخصوصية.
- `checkout` وإلغاء اشتراك لدى مزود وDRM والكوبونات معطلة لحين دمج حقيقي؛ لا توجد معاملات تجريبية أو حقيقية.
- هذه النسخة تتضمن ثغرات اعتماديات متبقية وتحتاج مراجعة أمنية كاملة. راجع `FINAL_REPORT.md` و`INFRASTRUCTURE_TEST_REPORT.md`.

## إعداد كتالوج IPTV اختياري
راجع `XTREAM_LOCAL_SETUP.md` للمخاطر وخطوات إعداد قراءة التصنيفات والقنوات محلياً. نموذج الإعداد يسمح بـHTTP بناءً على طلب المستخدم، لكن بيانات الاعتماد فارغة. HTTP ينقل بيانات الدخول دون تشفير، والسيرفر المطلوب أعاد 403 عند فحص الجذر، والبث لم يُربط.
