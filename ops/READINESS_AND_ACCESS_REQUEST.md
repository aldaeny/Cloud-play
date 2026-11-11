# Cloud Play Iraq — حزمة التجهيز وطلب الوصول المجمّع

## الحالة

هذه تهيئة قابلة للمراجعة وفحوص تحضير، وليست إثبات إنشاء Staging أو استعادة أو تشغيل مراقبة. لا تغييرات في الإنتاج، ولا موارد مدفوعة أُنشئت، ولا أسرار في الملفات.

## الموارد الدنيا المقترحة

- Web: المشروع الموجود `prj_zxlqaeLb1EvuMDFcnHHvRAelbHad` ضمن الفريق `team_nmqPC9TkSiA2rxnHqz6cVADh` مرجع إداري فقط. يجب فصل إعدادات وURLs وأسرار Staging تماماً، والإبقاء على SSO. لا يكفي وسم deployment بأنه preview إذا اتصل بقاعدة الإنتاج.
- API: نسختان من الصورة الحالية `apps/api/Dockerfile`، لكل نسخة بدايةً 1vCPU و1GiB RAM، خلف HTTPS load balancer. هذه ميزانية بدء اختبار، وليست سعة إنتاجية مثبتة. لا يلزم إعادة كتابة Nest أوالمشغّل.
- PostgreSQL/Auth/Storage: مشروع Supabase مستقل لـStaging. المشروع الإنتاجي `syscezbzxgnfxftfzaqa` ممنوع كهدف للاختبارات. تطبيق migrations الحالية كلها على الهدف المعزول فقط، ثم إنشاء tenant وحسابات ووسائط اصطناعية. Supabase يبقى سلطة الهوية.
- DR: مشروع مستقل آخر، مع منطقة وفصل وصول معتمدين، وbucket استعادة مستقل. لا تعني قاعدة ثانية في نفس cluster وجهة DR مستقلة.
- Storage: buckets خاصة، وأدوار كتابة/قراءة/استعادة منفصلة؛ التحقق من S3 compatibility مع adapter الموجود قبل اعتماده. نسخ bytes مستقلة عن نسخ PostgreSQL.
- Pool: نسختان ×5 اتصالات +10 احتياطية لـAuth/workers =20 ضمن budget30. يجب مطابقة ذلك لحد الخطة/pooler الفعلي. Redis/worker إضافيان فقط إن فُعّلت أعمال transcoding/queue القائمة؛ ليسا لازمين لاختبار quota الذي يستخدمPG.

التهيئة غير السرية: `launch-plan.json`، وقائمة مفاتيح vault المطلوبة: `staging-env-keys.json`. النصوص المرجعية ليست قيماً صالحة للنشر.

## تقدير الميزانية وحدود الإنفاق المطلوبة

**مخصصات تخطيطية بالدولار، لا عروض أسعار حالية من المزود.** لم تتوفر بيانات billing/entitlement لتأكيدها؛ لا تُستخدم كتفويض شراء.

| البند | مخصص شهري |
|---|---:|
| managed database base |25|
| compute لبيئتيStaging/restore |20|
| managed PITR |100|
| Web hosting تجاري |20|
| نسختاAPI |24|
| نسخةStorage مستقلة |6|
| monitoring |5|
| storage |5|
| احتياط |30|
| **المجموع** |**235**|

السقف المقترح المطلوب اعتماده: **250$/شهر**، مع **25$ كحد إضافي لتمرينDR**، أي حد أول شهر أقصاه275$ إذا نُفّذ التمرين. لا تفعيل اشتراك/ترقية قبل التحقق من سعره الفعلي.

غير مشمول حتى تسعيره: media/CDN egress، حقوق المحتوى، مختبر الأجهزة، الضرائب، المقاعد/المناطق الإضافية، worker/Redis عند الحاجة. لذلك235$ ليست تقديراً كاملاً لتكلفة خدمة بث تجارية. يبقى الإطلاق ممنوعاً حتى اعتماد حصة وتكلفة النقل والأجهزة المطلوبة.

تنبيهات إنفاق عند50% و80%، وتجميد إنشاء موارد جديدة عند90%. تنبيهات المزود ليست hard cap؛ لا نفترض أنها تمنع الفوترة، ولا نوقف الإنتاج آلياً لخفض فاتورة دون خطة حادث.

## Geo / Supabase Auth / SSO: الإعداد والصلاحيات

- القائمة المرشحة `IQ` تحتاج اعتماداً صريحاً. السياسات فيNest: `API_GEO_ALLOWED_COUNTRIES=IQ`، وquota: `RATE_LIMIT_STORE=postgres`؛ Web: `API_GEO_ENFORCEMENT=true`. مفاتيحGeo مشتركة بين issuer/backend فيvault الخاص بـStaging فقط.
- لا تضبط `VERCEL=1` يدوياً. لا تثقXFF أوX-Country. يلزم إثبات overwrite/provenance على ingress الحقيقي ورفض duplicate/malformed headers.
- هذه الإعدادات **لا تحمي الاتصال المباشر بـSupabase Auth**. يلزم حل مُدار معتمد يفرض Geo عند كل إصدار/تجديد، ويمنع المسار البديل. Custom domain أوNext proxy وحده ليس كافياً. لا نعطل المسارات أوSSO لإغلاق الاختبار.
- الصلاحيات المطلوبة: إدارة ingress/WAF أوضوابطAuth التي يوفرها المزود فعلياً؛ قراءة إعداداتها؛ نشرStaging فقط؛ ضبط متغيراتStaging منvault؛ جلسةمتصفحSSO أوهويةاختبارخدمة مصرح بها لا bypass token؛ مراجعةسجلاترفض منزوعةالأسرار. لا صلاحية حذف أوتدوير مفاتيح إنتاج مطلوبة.
- مصفوفة التنفيذ: login،signup،refresh،recover،verify،callback،logout،user/session، وكلgrant فعّال؛ GET/POST/OPTIONS حسبالعقد، مع raw Supabase origin، custom domain، API direct origin، alternate deployment origin، redirects، IPv4/IPv6 وتغيّرIP/country، nonce replay، admin claims وتزييفXFF/country. يجب أن ترفض السياسة مسارات التجاوز مع بقاء التدفقات المصرح بها عاملة. لا PASS بمجرد نجاحmiddleware.

## أوامر التحضير والتنفيذ بعد الوصول

```sh
# لا شبكة ولا أسرار: يتحقق من العزل والميزانية والموافقات، ويعيدexit2 عندBLOCKED.
node scripts/ops/validate-launch-plan.mjs ops/launch-plan.json
node --test scripts/ops/ops-plan.test.mjs

# لا شبكة افتراضياً؛ يحتاج خطةمعزولة مكتملة ومعتمدة و--execute صريحاً.
node scripts/ops/probe-staging.mjs ops/launch-plan.json
node scripts/ops/probe-staging.mjs /secure/operator-approved-plan.json --execute

# بعد تنفيذالاستعادة وجمعالملاحظات الفعلية منالمشغّل:
node scripts/ops/verify-recovery-evidence.mjs /secure/operator-approved-plan.json /secure/recovery-observations.json
```

التحقق من الخطة ليس إثبات بنية، والتحقق من تناسق دليل الاستعادة ليس تنفيذPITR أو مصادقة على صدق الملاحظات. يجب مراجعة مراجع الإجراءات والقياسات مستقلاً.

## تمرين PITR / Storage / Rollback الجاهز

1. فعّل entitlement ونافذةPITR على مصدرStaging المعتمد، وليس الإنتاج. سجّل UTC وclock alignment وسعةالحفظ.
2. اكتب marker اصطناعياً ملتزماً قبلنقطةالاستعادة وآخر بعدها، واحتفظ بمعرّفاتالإجراءات دون بياناتحقيقية.
3. نفّذ managedPITR إلىالمشروع المستقل؛ أثبت وجودالأول وغيابالثاني، ثمAuth وRLS/owner/tenant denial وAPI/playback.
4. استعدStorage bytes والنسخ والmetadata وACLs إلىbucket الوجهة؛ قارنSHA256 والأحجام ورفضالقراءةغيرالمصرحبها. DB backup ليسobject backup.
5. جرّب artifact سابقاً محدداً علىالمخطط الحالي فيالوجهة؛ rollback ثمforward recovery، دون Git reset أوDBdowngrade إنتاجي.
6. RPO = وقتالحادث ناقصأحدثcommit مستعاد. RTO = وقتجاهزيةالخدمةالمثبتة ناقصوقتالـحادث. أهدافمرشحة:300s و1800s؛ ليستقياساتأوSLA معتمداً.
7. قالبالملاحظات: sourceProjectRef،restoreProjectRef،incidentAt،restorePointAt،newestRestoredCommitAt،verifiedServiceReadyAt،beforePointMarkerPresent،afterPointMarkerAbsent،rlsOwnerTenantDenialVerified،authVerified،playbackVerified،rollbackVerified،alertDeliveryVerified،objects[sourceSha256/restoredSha256/sourceBytes/restoredBytes/metadataMatch/aclDenialVerified]،evidenceReferences. كلtimestamp بـUTC. لا قيم افتراضية لنتائج التجربة.

## المراقبة والسعة

`monitoring-policy.json` يحدد متطلباتالتنبيه، ولايدعي تفعيلها. يلزم monitor خارج API ومتلقيتنبيه معتمد. probe60s وtimeout5s؛ تنبيه بعد3 إخفاقات وتعافٍ بعدنجاحين. استخدمآليةهويةمصرحبها للمساراتالمحمية، لا تعطيلSSO.

بعدالنشر المعزول: إثباتتنبيه فعلي وإيصاله وتعافيه، ثمload على10/25/50/100 حساب اصطناعي عبرload balancer. أبقِ حدودالسلامة الحالية، وابدأبـ5 مستخدمين/10دقائق. وسّعفقطضمنميزانيةمعتمدة. اجمعp95/p99/errors/timeouts/throughput وCPU/RSS وDB connections و503/429 وإعادةتشغيلنسخة وتعطلauthority. لايُستنتجSLO إنتاجي منقيمةfixture السابقة. لاطلباتإلىمزودغيرمصرحبه.

## البحث عن مختبر أجهزة

لم يظهر إعدادBrowserStack/Sauce/LambdaTest/Device Farm فيبحثالمستودع المحدد. طلب قراءةأسماءGitHub Actions secrets رُفضHTTP403: `Resource not accessible by integration`، ولم تُقرأ قيم. GitHub environments المتاحة: Preview وProduction. هذا لايثبتعدموجوداشتراكخارجالصلاحيات، لكنه يمنعاكتشافمختبرمصرحبه عبرالمواردالحالية. مصفوفةالأجهزةالستة تبقىNOT RUN.

## طلب واحد مجمّع — غير منفّذ حتى توفيره

- **الموارد:**Staging API بنسختين وHTTPSLB، مشروعSupabase مستقل، Storageخاص، مشروعاستعادةمستقل، monitor خارجي ومتلقيalerts، وdevice lab حقيقي.
- **المراجع:**احتفظبمراجعالمشاريعالموجودة أعلاه للمنع/الربطالإداري؛ قدّمrefs الجديدة فينسخةخطةآمنةخارجGit. لا تختلقrefs.
- **الصلاحيات:**provisioning محدودبـStaging وDR، إدارةingress/Auth، قراءةbackup/PITR inventory واستعادةإلىالوجهة، bucket read/write/recovery مقيدة، deploy/rollback فيStaging، SSOsession مصرحبها، وربطمختبرالأجهزة. secret-name inventory اختياري عبرصلاحيةقراءةmetadata فقط، لاكشفالأسرار.
- **الإنفاق:**اعتمادحدود250$/شهر و25$ لتمرينDR أوحدودبديلة، مععرضأسعارفعلي للنقل والمختبر وPITR قبلشراءخدماته.
- **الوجهة:**مشروعومخزنمستقلان عنالمصدر والإنتاج؛ تحديدالمنطقةوالاحتفاظوالتنظيفالمسموح.
- **الوصولالآمن:**vault/platform bindings أوservice identity قصيرةالعمر وsessionمصرحبه عبرالمنصة. لا أسرارفيchat أوGit. بعدالإتاحةيمكنمتابعةالتنفيذ فيالجلسة، ولايوجدادعاءبوجودعاملخلفي يراقبالمواردأويستأنفدونتفاعلللجلسة.
