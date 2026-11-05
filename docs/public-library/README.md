# المكتبة العامة المجانية — Public free library

منصة مفتوحة لكل الزوار، **بدون تسجيل دخول، بدون اشتراك، بدون دفع**.
Open to every visitor — **no sign-in, no subscription, no payment.**

| | قبل / Before | بعد / After |
|---|---|---|
| أفلام / Films | 2 | **36** |
| قنوات مباشرة / Live channels | 12 | **31** |
| صفحات مفهرسة / Indexable pages | 17 | **51** |

---

## 1) مكتبة الأفلام — Film library

**المصدر:** مجموعة `feature_films` في Internet Archive (أفلام كاملة في الملك العام الأمريكي)
بالإضافة إلى أفلام Blender المفتوحة (CC BY) وفيلم *Sita Sings the Blues* (CC0).

**Source:** the Internet Archive `feature_films` collection (full US public-domain features),
plus the Blender open movies (CC BY) and *Sita Sings the Blues* (CC0).

### كيف يعمل التشغيل — How playback works

```
المتصفح  →  /api/movies/watch/<film-id>  →  archive.org/metadata/<archive-id>
                                              ↓ اختيار أفضل ملف MP4
         ←  302 redirect  ←  archive.org/download/<archive-id>/<file>.mp4
```

أسماء الملفات في Internet Archive غير موحّدة (`<id>.mp4`، `Title_512kb.mp4`،
`Title.ia.mp4`) وتتغيّر عند إعادة الرفع. لذلك **لا نُثبّت أسماء الملفات في الكود**؛
نحتفظ بمعرّف العمل فقط ونحلّه وقت الطلب.

Archive filenames are inconsistent and change on re-upload, so the app stores only the
**item identifier** and resolves the best browser-playable MP4 at request time.

**قواعد الاختيار / Selection rules** (`pages/api/movies/watch/[id].ts`):

| الأولوية / Priority | الصيغة / Format |
|---|---|
| 400 | `h.264` (النسخة الكاملة / full quality) |
| 380 | `h.264 IA` |
| 350 | أي صيغة تحتوي `h.264` |
| 170–200 | `512kb` (نسخة مخفّضة / low bitrate fallback) |
| 150 | `MPEG4` |

- يُرفض أي ملف داخل مجلد فرعي (مثل `.thumbs/`) أو بامتداد غير `.mp4`.
- العناصر المسحوبة (`is_dark: true`) تُرفض بـ **410 `FILM_UNAVAILABLE`** — لا نُظهر مشغّلاً معطوباً.
- لا يوجد ملف قابل للتشغيل ⇒ **404 `NO_PLAYABLE_FILE`**.
- تعذّر الوصول للمصدر ⇒ **502 `SOURCE_UNREACHABLE`** (يظهر زر إعادة المحاولة في المشغّل).
- إعادة التوجيه **دائماً إلى `archive.org` فقط**.

**لا تمرّ بيانات الفيلم عبر سيرفراتنا** — المتصفح يتصل بـ Internet Archive مباشرة،
فلا تكلفة نطاق ترددي ولا إعادة استضافة.
Film bytes never pass through this app: the browser connects to archive.org directly.

### الملفات / Files

| ملف | الوظيفة |
|---|---|
| `src/server/public-films.ts` | بيانات الأفلام (بيانات صرفة، آمنة للعميل) |
| `pages/api/movies/watch/[id].ts` | محلّل التشغيل العام |
| `src/components/movies/OpenMovies.tsx` | شبكة الملصقات + صفحة الفيلم |
| `src/styles/films.css` | التنسيق |
| `pages/movies/[id].tsx` | 36 صفحة تفاصيل مُولّدة مسبقاً (SSG) |
| `tests/public-films.test.mjs` | 15 اختباراً |

### إضافة فيلم — Adding a film

أضف سطراً في `ARCHIVE_FILMS`:

```ts
archive('slug-here', 'archive_item_id', 'English Title', 'العنوان بالعربي', '1945', 'noir',
  'وصف عربي قصير.', 'Short English description.'),
```

قبل الإضافة تحقّق من:
1. العمل موجود في مجموعة الملك العام وليس مسحوباً.
2. له ملف MP4 قابل للتشغيل:
   `https://archive.org/advancedsearch.php?q=identifier:"<id>"&fl[]=identifier&fl[]=format&output=json`
3. العنوان والسنة والوصف صحيحان.

الصفحة والتفاصيل والاختبارات تُلتقط تلقائياً — لا حاجة لتعديل أي ملف آخر.
The detail page, grid entry and tests pick it up automatically.

---

## 2) القنوات المباشرة — Live channels

31 قناة، كلها مُتحقّق منها بجلب قائمة `#EXTM3U` الفعلية من سيرفر المالك.
31 channels, each verified by fetching a real `#EXTM3U` master from the owner's servers.

| التبويب / Tab | العدد | أمثلة |
|---|---|---|
| العراق / Iraq | 3 | الشرقية، الشرقية الإخبارية، الرشيد |
| أخبار واقتصاد / News & business | 14 | الجزيرة، العربية، الحدث، سكاي نيوز عربية، TRT عربي، DW عربية، العربي، العربي 2، الميادين، CNBC عربية، العربية أسواق، الكويت الإخبارية، فلسطين مباشر، الجزيرة مباشر |
| الخليج / Gulf | 4 | الكويت 1، الكويت إثراء، عجمان، القرآن الكريم |
| بلاد الشام / Levant | 6 | التلفزيون الأردني، عمّان، رؤيا، تلفزيون فلسطين، مساواة، المستقبل |
| رياضة / Sport | 2 | الكويت الرياضية، الأردن الرياضية |
| عالمية / International | 2 | Al Jazeera English, DW English |

شروط الإدراج (لم تتغيّر) — Inclusion rules (unchanged):

1. البث من نطاق المالك أو شبكة توصيل المحتوى الخاصة به.
2. منشور علناً لمشغّل المالك المجاني — بلا بيانات دخول ولا رموز ولا DRM ولا وسيط.
3. HTTPS بالكامل.
4. تم جلب قائمة التشغيل والتحقق منها فعلياً.

هذه قائمة مُراجعة يدوياً، **وليست** قائمة IPTV مُجمّعة: التجميع لا يُثبت هوية ناشر كل بث.
Hand-checked curation, **not** an aggregated IPTV playlist.

---

## 3) ما يبقى خاصاً — What stays private

مشغّل Xtream الخاص بالمالك (`/my-tv`) **لم يتغيّر**: يتطلب تسجيل دخول، ومحصور ببريد المالك،
و`noindex`. لا تظهر أي من بياناته في أي صفحة أو API عام.

The owner-only Xtream player (`/my-tv`) is **unchanged**: sign-in required, restricted to the
owner's email, `noindex`. None of its data appears on any public page or API.

---

## 4) الاختبارات — Tests

```bash
npm run test:films   --workspace aether-web   # 15 checks
npm run test:public  --workspace aether-web   # 10 checks
npm run test:private --workspace aether-web   # 23 checks
```

الاختبارات بنيوية/غير متصلة بالإنترنت: تتحقق من قواعد الانتقاء ومن أن المسارات عامة فعلاً.
تم التحقق من توفّر المصادر بشكل منفصل.
Offline/structural: they assert curation rules and that the routes are genuinely public.
Source availability was verified separately.

---

## 5) حدود معروفة — Known limitations

- التشغيل يتصل بالمصدر مباشرة؛ إذا توقف المصدر أو منع التشغيل من مواقع أخرى فسيظهر زر
  إعادة المحاولة ورابط الصفحة الرسمية.
- بعض أفلام الثلاثينيات والأربعينيات بجودة المصدر الأصلية فقط (نسخة `512kb`).
- الملصقات تأتي من `archive.org/services/img/<id>`؛ إن فشل تحميلها يظهر بديل حرفي أنيق.
- البث المباشر يعتمد على شبكة المستخدم والمنطقة الجغرافية.
- **كل** الأفلام — بما فيها فيلما Blender — تُحلّ عبر `/api/movies/watch/<id>`. لا يوجد أي رابط ملف مُثبّت في الكود.

### لا تستخدم `gtv-videos-bucket`

الدلو `commondatastorage.googleapis.com/gtv-videos-bucket/...` الذي تتداوله أمثلة المشغّلات
**يرفض القراءة المجهولة** (`AccessDenied`). استخدامه يعطي مشغّلاً معطوباً.
نسخ Blender على Internet Archive (`BigBuckBunny_328` و`Sintel`) عامة وتعمل، وملصقاتها محلية في
`public/art/films/`. يوجد اختبار انحدار يمنع عودة هذا الرابط.

The widely-copied `commondatastorage.googleapis.com/gtv-videos-bucket/...` URLs **deny anonymous
reads** (`AccessDenied`) and produce a broken player. The Blender titles are served from their
public Internet Archive items (`BigBuckBunny_328`, `Sintel`) with local poster stills in
`public/art/films/`. A regression test blocks that bucket from coming back.

- Playback connects straight to the source; outages or cross-site blocking surface the retry
  button plus a link to the official page.
- Some older titles only exist as a `512kb` derivative.
- Posters come from `archive.org/services/img/<id>`, with a lettered fallback if one fails.
- Live playback depends on the viewer's network and region.
