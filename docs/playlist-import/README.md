# استيراد قوائم M3U الخاصة بالمالك · Owner-only M3U playlist import

طبقة **خاصة** داخل `/my-tv` تتيح للمالك لصق رابط أي قائمة M3U وعرض قنواتها وتشغيلها.
لا تُنشر أيّ قائمة للزوار، ولا تُفهرس، ولا توجد أي واجهة عامة لها.

A **private** tier inside `/my-tv` that lets the owner paste any M3U playlist URL,
browse its channels and play them. Nothing is published to visitors, nothing is
indexed, and there is no public entry point.

---

## لماذا هذه الميزة · Why this exists

طُلبت إضافة تسعة روابط قوائم IPTV شائعة التداول. فحصها حتى وجهاتها النهائية أعطى:

Nine commonly-circulated IPTV playlist links were submitted for addition. Following
each to its final destination gave:

| الرابط · Link | الوجهة · Destination | النتيجة · Result |
|---|---|---|
| `iptvonline.tk/lista/` | — | نطاق لا يستجيب · domain does not resolve |
| `m3u.me/dg4` | — | `404` (nginx) |
| `bit.ly/MegaBrList` | `pastebin/47jtM6nr` | استُبدل بإشعار `BLOQUEADA / FAVOR ATUALIZAR` — صفر قنوات |
| `bit.ly/AllCanais1` | `temdetudose.com.br/kodi/AllCanais1.txt` | لا يستجيب · unreachable |
| `pastebin/9vGMgQq4` | — | `404` محذوف · removed |
| `bit.ly/ClipeseRádios` | `pastebin/9vGMgQq4` | نفس الـpaste المحذوف (مكرر) · duplicate of the above |
| `bit.ly/Tjkkcanais` | `pastebin/Y2TukfWJ` | `404` محذوف · removed |
| `bit.ly/Playtv-geh` | `pastebin/uEPEwHb7` | حذفته Pastebin كـ«محتوى ضار محتمل» · removed as *potentially harmful*, 2017-09-24 |
| `siptv.eu/converter/` | — | حيّ، لكنه **أداة تحويل** لتطبيق Smart IPTV لا مصدر بث · alive, but a converter tool, not a source |

**9 روابط ← 8 وجهات فريدة ← 7 ميتة + 1 أداة. صفر مصادر صالحة.**
**9 links → 8 unique destinations → 7 dead + 1 tool. Zero usable sources.**

الاستنتاج العملي: تثبيت روابط قوائم مجهولة في الكود فكرة سيئة — تموت خلال أشهر،
وتحتاج تعديل كود ونشرًا جديدًا كل مرة. فالحل الصحيح ليس إضافة هذه الروابط، بل
**تمكين المالك من إضافة أي قائمة بنفسه**، دون تعديل الكود، وبشكل خاص.

The practical conclusion: hard-coding anonymous playlist URLs is a bad idea — they
die within months and each replacement needs a code change and a deploy. So the
right answer was not to add those links, but to **let the owner add any list
themselves**, privately, without a code change.

---

## طبقات الثقة الثلاث · The three trust tiers

| الطبقة · Tier | المصدر · Source | المرشّحات · Filters | الوصول · Access |
|---|---|---|---|
| منتقاة · Curated | 31 قناة مفحوصة يدوياً | HTTPS + HLS + مفحوصة | عام، بلا دخول · public, no sign-in |
| الدليل العالمي · World | `iptv-org` (MIT) | 7 مرشّحات، SFW، HTTPS، `.m3u8` | عام، بلا دخول · public, no sign-in |
| **قوائمي · My playlists** | **يقدّمها المالك · owner-supplied** | **SSRF + حدود فقط** | **المالك فقط · owner only** |

الطبقة الخاصة **لا تطبّق** مرشّحات المحتوى العامة (SFW، HTTPS-only، `.m3u8`-only)
لأن القائمة من اختيار المالك وتُعرض له وحده. ما يُطبَّق دائماً: حماية SSRF، حدود
الحجم والزمن، وإخفاء بيانات الدخول.

The private tier deliberately **does not** apply the public content filters
(SFW-only, HTTPS-only, `.m3u8`-only), because the list is the owner's own choice
and is shown to them alone. What always applies: the SSRF guard, size/time caps,
and credential hiding.

---

## ميزة الطبقة الخاصة · What the private tier can do that the public one cannot

القنوات التي تحمل `http-referrer` أو `http-user-agent` **لا تعمل أبداً** في متصفح،
لأن المتصفح يمنع ضبط هاتين الترويستين. لذلك يرفضها الدليل العام.

لكن **الخادم يستطيع** ضبطهما. فوكيل البث الخاص تمرّرهما إلى الأصل، فتعمل قوائم
كانت مستحيلة على الطبقة العامة. كما تقبل الطبقة الخاصة `http://` وصيغاً مثل
`.ts` / `.mkv` (مع وسمها كصيغة قد لا يفكّ المتصفح ترميزها).

Entries carrying `http-referrer` or `http-user-agent` **can never play** in a
browser — those are forbidden headers — so the public tier rejects them. The
**server** can set them, so the private proxy forwards them upstream and lists
that were impossible publicly can work here. The private tier also accepts
`http://` and containers such as `.ts` / `.mkv` (flagged as possibly undecodable).

الترويسات تُقرأ من ثلاث صيغ: سمات مضمّنة في `#EXTINF`، و`#EXTVLCOPT:`، و`#EXTHTTP:`
(JSON). ولا تتسرّب إلى المدخل التالي.

Headers are read from three shapes: inline `#EXTINF` attributes, `#EXTVLCOPT:`,
and `#EXTHTTP:` (JSON). They never bleed into the next entry.

---

## حماية SSRF · SSRF protection

وكيل Xtream آمن **بالبناء**: توكنه يحمل مساراً نسبياً والأصل ثابت بالإعدادات، فلا
يمكن توجيهه إلا لخادم واحد. استيراد القوائم مختلف — المالك يقدّم رابطاً عشوائياً،
فعلى الخادم أن يرفض التصويب إلى أي شيء داخلي **فعلياً**.

The Xtream proxy is safe **by construction**: path-only tokens, origin fixed by
config. Playlist import is different — the owner supplies an arbitrary URL — so
the server must actively refuse to be aimed at anything internal.

الطبقات في `src/server/safe-fetch.ts` بالترتيب · Layers, in order:

1. المخطط `http`/`https` فقط، وبلا `userinfo` في السلطة (بيانات الدخول مسموحة في الـquery لأن هذه طبيعة روابط Xtream).
2. أسماء داخلية مرفوضة: `localhost`, `*.local`, `*.internal`, `*.home.arpa`, `*.cluster.local`, `metadata.google.internal`، وأي وسم مفرد.
3. **عناوين IP الحرفية تُفحص فوراً بلا DNS** — `127.0.0.1`, `169.254.169.254`, `10.x`, `192.168.x`, `[::1]`, `[fd00::1]`, والصيغة المُطبّعة `[::ffff:7f00:1]`.
4. المنفذ ليس منفذ خدمة داخلية (22, 25, 53, 3306, 5432, 6379, 9200, 11211, 27017, 2375…). منافذ الوسائط معتادة مسموحة (80, 443, 8080, 8443, 25461, 8000).
5. **كل** عنوان يُرجعه DNS يجب أن يكون عاماً — IPv4 وIPv6، بما فيه الـv4-mapped والصيغ غير القانونية (`010.0.0.1`) تفشل مغلقة.
6. عمليات إعادة التوجيه تُتابَع يدوياً وتُفحص من جديد عند كل قفزة؛ ووكيل البث **يثبّت الأصل** فلا يقبل نقلة إلى مضيف آخر.
7. حدود: 16 ميغابايت للقائمة، 20 ث للاستيراد، 25 ث للبث، 2 ميغابايت لقائمة HLS المُعاد كتابتها.

**خطر متبقٍ مُعلن لا مُخفى:** بين فحص DNS وفتح المقبس نافذة يستطيع محلّل خبيث
استغلالها لإعادة الربط (DNS rebinding). الوصول لهذه الميزة مقصور على مالك موثّق،
ومحدود بمعدّل، ولا تُعاد أجسام الردود الداخلية إلا لذلك المالك. تُخزَّن نتائج
الفحص الإيجابية 60 ث فقط لأن HLS يطلب مقطعاً كل بضع ثوانٍ؛ النتائج السلبية لا
تُخزَّن أبداً.

**Residual risk, documented rather than hidden:** a hostile resolver could rebind
between the DNS check and the socket connect. Reachable only by an authenticated
owner, rate-limited, and internal response bodies are returned to that owner alone.
Positive verdicts are cached for 60 s (HLS asks for a segment every few seconds);
negative verdicts are never cached.

---

## التوكنات · Tokens

`src/server/playlist-token.ts` — AES-256-GCM، حمولة `{o: origin, p: path, r: referrer, u: userAgent, e: expiry}`،
صلاحية 6 ساعات.

- الأصل **مختوم داخل** النص المشفّر: المتصفح لا يقرأه ولا يختاره.
- فصل نطاق المفتاح: بادئة `cloudplay-playlist-proxy:v1:` مقابل `cloudplay-xtream-proxy:v1:`،
  فتوكن Xtream **لا يُقبل** في وكيل القوائم حتى لو تشاركا نفس السر.
- المسار يجب أن يبقى على الأصل المختوم: يُرفض `//host` و`/\host` (WHATWG يُطبّعها
  إلى `//host`) والروابط المطلقة ومحارف التحكم.
- عند الفتح يُعاد التحقق من الأصل ضد حارس العناوين — فتوكن قديم لمضيف صار داخلياً يُرفض.

---

## عقد الـAPI · API contract

### `POST /api/playlist/import`

جسم · Body: `{ "url": "https://…/list.m3u" }` — يتطلب `Authorization: Bearer <supabase jwt>`.

`POST` لا `GET` **عمداً**: روابط القوائم تحتوي غالباً اسم مستخدم وكلمة مرور في
الـquery، و`GET` ينسخها إلى سجل المتصفح وسجلات الوكلاء وسجلات الوصول. جسم الطلب لا يفعل.

ردّ · Response `200`:

```json
{ "data": { "channels": [ { "id": "…", "name": "…", "group": "…", "logo": "https://…",
                          "url": "/api/playlist/stream?t=…", "kind": "hls",
                          "container": "m3u8", "risky": false } ],
            "groups": [ { "name": "News", "count": 2 } ],
            "total": 3, "returned": 3, "truncated": false, "skipped": 0,
            "host": "list.example.com", "fetchedAt": 1760000000000 } }
```

الردّ **لا يحتوي** أي رابط بث أصلي ولا أي بيانات دخول — المضيف فقط للعرض.

| الخطأ · Error | HTTP |
|---|---|
| `METHOD_NOT_ALLOWED` (غير POST) | 405 + `Allow: POST` |
| `SIGN_IN_REQUIRED` | 401 |
| `NOT_AUTHORIZED` | 403 |
| `ACCOUNTS_OFF` / `OWNER_NOT_SET` / `AUTH_UNAVAILABLE` / `NOT_CONFIGURED` | 503 |
| `INVALID_URL` (رابط سيئ أو مضيف داخلي) | 400 |
| `NOT_A_PLAYLIST` / `EMPTY_PLAYLIST` / `TOO_LARGE` | 422 |
| `RATE_LIMIT` (أكثر من 30 استيراداً / 10 د لكل مالك) | 429 |
| `UPSTREAM_ERROR` | 503 |

`Cache-Control: no-store, max-age=0` دائماً — لا تخزين على CDN لمحتوى خاص.
ذاكرة داخلية 10 د لكل رابط (تُفتَح بمفتاح sha256 للرابط) بحد 24 مدخلاً.

### `GET|HEAD /api/playlist/stream?t=<token>`

وكيل الوسائط. لا يحتاج ترويسة تفويض — التوكن نفسه قدرة حامل (bearer capability)
لا يُصدر إلا لمالك موثّق. قوائم HLS تُعاد كتابة كل مراجعها (المقاطع، `EXT-X-KEY`,
`EXT-X-MAP`, `EXT-X-MEDIA`) لتعود عبر الوكيل؛ والمرجع خارج الأصل يُستبدل بـ
`t=off-origin` ميت. الوسائط الثنائية تُمرَّر مع دعم `Range` فيعمل التقديم والتأخير.

---

## الإعدادات · Configuration

لا متغيّر بيئة جديد مطلوب. السر يُقرأ من `PLAYLIST_PROXY_SECRET` أو من
`XTREAM_PROXY_SECRET` الموجود أصلاً على النشر — فالميزة تعمل فوراً.

No new environment variable is required: the secret is read from
`PLAYLIST_PROXY_SECRET`, falling back to the already-configured
`XTREAM_PROXY_SECRET`, so the feature works immediately.

بوابة المالك هي نفسها المستخدمة في مشغّل Xtream: `XTREAM_OWNER_EMAILS` — fail-closed.

---

## الحفظ في المتصفح · Browser storage

الحفظ **اختياري ومُطفأ افتراضياً**. عند تفعيله يظهر تحذير صريح: روابط القوائم
تحتوي غالباً بيانات دخول، والحفظ يخزّنها في `localStorage` **نصاً صريحاً**. المفتاح
`cloudplay-owner-playlists-v1`، بحد 20 قائمة، مع زرّي «احذف» و«انسَ الكل».

Saving is **opt-in and off by default**, with an explicit warning that playlist
URLs often embed credentials and that saving stores them in `localStorage` in
plain text. Key `cloudplay-owner-playlists-v1`, capped at 20, with per-item remove
and a forget-all button.

---

## الاختبارات · Tests

```bash
npm run test:playlists --workspace aether-web   # 44 assertions
```

تُشغّل الوحدات المُصرَّفة الحقيقية والمسارين الحقيقيين، والشبكة مُحاكاة باعتراض
`fetch` و`node:dns/promises` — فتعمل بلا شبكة وبشكل حتمي مع تنفيذ كل حارس.

ثغرتان وجدتهما الاختبارات وأُصلحتا أثناء التطوير · Two real bugs the tests caught and were fixed:

1. `parsePublicUrl` كان يفحص أسماء المضيفين فقط، فقبِل عناوين IP الداخلية الحرفية
   عند الاستيراد. أُضيف فحص فوري لها بلا DNS.
2. WHATWG يُطبّع `[::ffff:127.0.0.1]` إلى `[::ffff:7f00:1]`، والتعبير النمطي كان
   يغطي الصيغة المنقوطة فقط — فكان عنوان loopback يمرّ. تُغطّى الصيغتان الآن.

---

## القيود المقبولة · Accepted limitations

- الاستيراد يجلب القائمة عبر الخادم، فمصدر يحجب مراكز البيانات سيفشل.
- Casting معطّل لهذه القنوات: `isShareableMedia()` يرفض الروابط ذات الـquery، وروابط الوكيل تحمل توكنًا في الـquery.
- `.ts` الخام و`.mkv` و`.avi` قد لا يفكّ المتصفح ترميزها — تُوسَم `risky` في الواجهة.
- الحد 3000 قناة لكل قائمة؛ ما زاد يُبلَّغ عنه عبر `truncated` بدل القطع الصامت.
- الذاكرة ومحدّد المعدّل لكل نسخة serverless، فليست حماية موزّعة — الحماية الأساسية هي بوابة المالك.
- لا شيء يُخزَّن على الخادم: لا قاعدة بيانات ولا هجرة. التوكنات مكتفية بذاتها ليعمل التشغيل عبر النسخ.
