# الدليل العالمي — iptv-org world directory

دليل قنوات مفتوح يجمعه المجتمع، مُضاف إلى `/live` بجانب القنوات المنتقاة.
**مجاني، بدون تسجيل دخول، بدون اشتراك** مثل بقية الموقع.

A community-maintained open channel directory, added to `/live` next to the curated
channels. **Free, no sign-in, no subscription**, like the rest of the site.

**المصدر / Source:** `https://iptv-org.github.io/iptv/index.m3u`
**المشروع / Project:** https://github.com/iptv-org/iptv (MIT)

---

## 1) طبقتان من الثقة — Two trust tiers

| | قنوات منتقاة / Curated | الدليل العالمي / World |
|---|---|---|
| العدد | 31 | **~9,600** صالح للمتصفح |
| التحقق | كل قائمة تشغيل فُحصت يدوياً | لم نتحقق من كل قناة |
| المصدر | سيرفر المالك نفسه، مفحوص | تجميع مجتمعي من طرف ثالث |
| التصيير | على السيرفر (SSR، قابل للأرشفة) | عند الطلب (كبير ويتحدّث يومياً) |
| الملف | `src/server/public-tv.ts` | `src/server/community-tv.ts` |

القنوات المنتقاة تبقى الافتراضية. الدليل العالمي **اختياري** ومُعلَّم بوضوح أنه غير مُتحقّق منه.
Curated stays the default. The world directory is opt-in and clearly labelled as unverified.

> المشروع لا يستضيف أي فيديو — هو فهرس روابط عامة فقط، ويحذف أي إدخال بطلب من صاحبه.
> The project hosts no video; it is an index of public URLs and removes entries on request.

---

## 2) فلاتر قابلية التشغيل — Playability filters

هذه أهم نقطة عملية: معظم قوائم IPTV مليئة بإدخالات **لا يمكن للمتصفح تشغيلها**.
This is the practical crux: most IPTV lists are full of entries a browser **cannot** play.

يُستبعد الإدخال إذا:

| # | الشرط | السبب |
|---|---|---|
| 1 | يعلن `http-referrer` أو `http-user-agent` | ترويسات ممنوعة في المتصفح — hls.js لا يستطيع تعيينها أبداً |
| 2 | ليس HTTPS | mixed-content على صفحة HTTPS |
| 3 | ليس `.m3u8` | الحاويات الأخرى (`.ts`، `.php`) لا يعمل بها المشغّل |
| 4 | يحتوي بيانات دخول أو منفذ غير 443 أو مضيف خاص | حارس `isSafePublicStream()` المشترك |
| 5 | مسار بشكل Xtream: `/live/<user>/<pass>/<id>.` | إعادة بث تجارية مكشوفة |
| 6 | اسمه أو تصنيفه للبالغين | حماية إضافية — القائمة الرئيسية مُفلترة أصلاً في المصدر |
| 7 | مرآة مكررة لنفس القناة | بطاقة واحدة لكل بث (الروابط البديلة تُطوى) |

**النتيجة المُقاسة على المستودع الكامل:** 18,456 إدخالاً خام → **9,632** صالحاً، تغطي **175 دولة**،
في **80ms** و**1.6MB** ذاكرة.

Measured over the whole upstream repository: 18,456 raw entries → **9,632** playable,
covering **175 countries**, parsed in **80ms** at **1.6 MB** of memory.

### لماذا السقف 20,000 وليس 5,000

القائمة مرتّبة بالدولة. سقف منخفض يقطعها أبجدياً **ويُحرم دولاً كاملة** —
اختبرنا 5,000 فظهرت 122 دولة فقط؛ برفع السقف ظهرت 175. السقف الآن حد أمان لا قصّ فعلي.

The playlist is ordered by country, so a low cap truncates it alphabetically and silently
drops whole nations — a 5,000 cap yielded only 122 countries versus 175 uncapped. The cap is
now a safety bound, not an actual cut. There is a test asserting it stays high.

---

## 3) التخزين المؤقت — Caching

```
المتصفح → /api/iptv/community → [ذاكرة الوحدة 6 ساعات] → iptv-org.github.io/iptv/index.m3u
```

- جلب واحد كل 6 ساعات، مع منع الطلبات المتزامنة (`inflight`).
- `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`.
- عند فشل المصدر نواصل تقديم آخر فهرس ناجح بدل إفراغ الصفحة.
- حد الحجم 24MB ومهلة 20s.
- الاستجابة **مُصفّحة** (60 افتراضياً، 200 أقصى) فالمتصفح لا يستقبل الفهرس كاملاً أبداً.

One fetch per 6 h with in-flight dedupe; stale index served on upstream failure; responses
paginated so the browser never receives the full index.

---

## 4) الواجهة — UI

`/live` فيه مفتاح مصدرين:

- **قنوات منتقاة** → `PublicTv` (31، مُصيَّرة على السيرفر)
- **الدليل العالمي** → `CommunityTv`: اختيار الدولة (175)، تصنيفات، بحث، مفضلة، «تحميل المزيد»

المفضلة تستخدم نفس المفتاح `cloudplay-tv-favorites-v1` فتتزامن مع الحساب المجاني.
الشعارات من `tvg-logo` عبر `<Image unoptimized>` مع بديل علم الدولة عند فشل التحميل.

---

## 5) الملفات — Files

| Path | Purpose |
|---|---|
| `apps/web/src/server/community-tv.ts` | المحلّل + الفلاتر + الاستعلام (دوال صرفة) |
| `apps/web/pages/api/iptv/community.ts` | نقطة عامة مُخزّنة ومُصفّحة |
| `apps/web/src/components/iptv/CommunityTv.tsx` | واجهة الدليل |
| `apps/web/src/components/iptv/LiveTv.tsx` | مفتاح المصدرين |
| `apps/web/tests/community-tv.test.mjs` | 19 اختباراً |

---

## 6) الاختبارات — Tests

```bash
npm run test:community --workspace aether-web   # 19 checks
npm run test:public    --workspace aether-web   # 10 checks (regression)
npm run test:films     --workspace aether-web   # 17 checks (regression)
npm run test:private   --workspace aether-web   # 23 checks (regression)
```

شكل `#EXTINF` في الاختبارات مطابق لما يولّده المشروع فعلياً — تحقّقنا منه في
`scripts/models/stream.ts` و`scripts/generators/indexGenerator.ts` في مستودع iptv-org.
The test fixtures match the generator's real output, verified against
`scripts/models/stream.ts` and `scripts/generators/indexGenerator.ts` upstream.

---

## 7) حدود معروفة — Known limitations

- **إدخالات قديمة**: الدليل يحتوي روابط ميتة. مثال تم فحصه فعلياً: القنوات العراقية
  (`imn-live.esite-lab.com/hls/iraqia-*.m3u8` و`stream.afaq.iq`) ما زالت مدرَجة لكنها
  ترجع 404/500 — نفس ما وجدناه عند الفحص اليدوي. لذلك تبقى القنوات المنتقاة هي الموثوقة للعراق.
- **الحجب الجغرافي**: قنوات كثيرة تعمل فقط داخل بلد tertentu.
- **CORS**: بعض المصادر تمنع التشغيل من مواقع أخرى؛ يظهر زر إعادة المحاولة.
- **التصنيفات**: تأتي من `group-title` في `index.m3u` المُولّد. ملفات `streams/*.m3u` الخام
  لا تحتويها، لذا فحص الحجم على الملفات الخام يُظهر تصنيفات فارغة — هذا متوقّع.
- **الحقوق**: التجميع لا يُثبت حق كل بث. للاستخدام التجاري راجع شروط كل جهة مالكة.

- **Stale entries**: the directory lists dead links. Verified example: the Iraqi channels
  (`imn-live.esite-lab.com/hls/iraqia-*.m3u8`, `stream.afaq.iq`) are still listed but return
  404/500 — matching our earlier hand-checks. Curated remains the reliable source for Iraq.
- **Geo-blocking**, **CORS**, and per-channel rights all vary; aggregation does not prove rights.
