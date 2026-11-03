# Docker setup — حالة تجريبية غير مختبرة

Docker غير موجود في بيئة الاختبار؛ لم يُنفذ build أو up أو اختبار صحة الحاويات. ملفا `infra/docker/compose.yml` و`compose.prod.yml` إعدادان تجريبيان غير معتمدين للإنتاج؛ الملف المحلي يربط API بـlocalhost، وملف prod قد ينشر المنفذ على الشبكة. انظر `FREE_LOCAL_SETUP.md` لتجربة الواجهتين محلياً. إصدار YAML قُرئ فقط، وليس بديلاً عن `docker compose config`.

من جذر المشروع في بيئة بها Docker Compose v2:

```sh
cp .env.example .env
# عدّل كلمات المرور الثلاثة وJWT واستبدل placeholders.
# اجعل POSTGRES_PASSWORD مطابقاً لكلمة المرور في DATABASE_URL، مع URL encoding عند الحاجة.
# اضبط STORAGE_PUBLIC_ENDPOINT على عنوان متاح للمتصفح.
docker compose --env-file .env -f infra/docker/compose.yml config
docker compose --env-file .env -f infra/docker/compose.yml up -d postgres redis minio minio-init
docker compose --env-file .env -f infra/docker/compose.yml build api worker-media
docker compose --env-file .env -f infra/docker/compose.yml run --rm --no-deps api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose --env-file .env -f infra/docker/compose.yml up -d api worker-media
docker compose --env-file .env -f infra/docker/compose.yml ps
curl --fail http://localhost:3000/health
```

هذه تعليمات مقترحة لم تُختبر في Docker. شغّل migrations قبل استقبال الطلبات وراجع النسخ الاحتياطية وتوافق ترحيل قاعدة موجودة؛ migration الأولى baseline من schema الحالي، فلا تطبّقها عميانياً على قاعدة قائمة. الـ health endpoint يفحص PostgreSQL فقط؛ healthcheck العامل يفحص فتح المنفذ فقط، وليس نجاح مهام التحويل. منافذ MinIO مرتبطة بـ localhost؛ ضع خدمة خاصة وتفويضاً وTLS أمام أي وصول خارجي. لا تنشر PostgreSQL أو Redis مباشرة للعامة.

الـ volumes: `postgres_data`, `redis_data`, `minio_data`. الأمر `docker compose ... down -v` يحذف البيانات. لا تشغّل `prisma migrate dev` في الإنتاج. `prisma db seed` يتضمن بيانات تجريبية ويمنعه البرنامج في بيئة production. لا تعتمد على الأسماء أو كلمات المرور التجريبية في التشغيل الفعلي.

صور الويب والإدارة صُححت لبناء npm workspaces من جذر المشروع ولكن لم تُختبر في Docker، وأضيفتا في ملف الدمج المحلي `compose.local.yml`. يتطلب Next.js 16 Node 20.9 أو أحدث؛ صور Node 20 المحددة غير مثبتة بتجزئة ثابتة. متغير المنفذ API_PORT مدعوم ما لم يُحدد PORT، ويجب أن يتطابق المنفذ مع mapping وhealthcheck في Compose إذا تغيّر. migration الثالثة تتطلب تنظيف أي تكرارات تقدم أفلام موجودة دون حذف تلقائي، بعد النسخ الاحتياطي.

تحذير: Dockerfiles الحالية تستخدم npm ci وتحتفظ باعتماديات التطوير في الصورة النهائية. لذلك `npm audit --omit=dev` لا يغطي كامل محتوى الصورة. لا تعتمد الصور للإنتاج قبل فصل مراحل البناء وتشذيب الاعتماديات وإجراء فحص صورة حقيقي.
