/**
 * PUBLIC film library — free for every visitor, no sign-in, no payment.
 *
 * Sources, both permissively licensed:
 *   • Internet Archive `feature_films` collection — US public domain features.
 *   • Blender Foundation open movies — Creative Commons Attribution.
 *
 * Archive.org stores each title under an item identifier, but the playable
 * filename differs per upload (`<id>.mp4`, `Title_512kb.mp4`, …). Rather than
 * hardcoding filenames that break on re-uploads, we keep the identifier and let
 * `/api/movies/watch` resolve the best H.264 MP4 at request time and redirect.
 * Items that are dark, missing, or have no MP4 are refused rather than shown
 * as a broken player.
 */

export type FilmGenre = 'classic' | 'noir' | 'comedy' | 'horror' | 'western' | 'family' | 'adventure' | 'animation';

export type PublicFilm = {
  id: string;
  title: string;
  titleAr: string;
  year: string;
  genre: FilmGenre;
  ar: string;
  en: string;
  /** Internet Archive item identifier — the single source of the playable file. */
  archiveId: string;
  /** Local poster art, when we ship a still instead of using the Archive thumbnail. */
  still?: string;
  source: string;
  license: 'public-domain' | 'cc-by';
  licenseLabel: string;
  licenseUrl: string;
  credit: string;
};

const PD = {
  license: 'public-domain' as const,
  licenseLabel: 'ملك عام',
  licenseUrl: 'https://archive.org/details/feature_films',
  credit: 'Internet Archive — Feature Films',
};

function archive(
  id: string,
  archiveId: string,
  title: string,
  titleAr: string,
  year: string,
  genre: FilmGenre,
  ar: string,
  en: string,
): PublicFilm {
  return { id, archiveId, title, titleAr, year, genre, ar, en, source: `https://archive.org/details/${archiveId}`, ...PD };
}

const ARCHIVE_FILMS: PublicFilm[] = [
  // ——— Screwball & comedy ———
  archive('his-girl-friday', 'his_girl_friday', 'His Girl Friday', 'فتاته يوم الجمعة', '1940', 'comedy',
    'صحافية بارعة يريد رئيس تحريرها أن يستعيدها قبل زواجها، فتتورط في قضية إعدام. من أسرع الكوميديا الحوارية في تاريخ السينما.',
    'A star reporter is about to remarry, so her editor pulls her into one last story — a looming execution. One of the fastest-talking comedies ever made.'),
  archive('my-favorite-brunette', 'my_favorite_brunette', 'My Favorite Brunette', 'سمراؤي المفضلة', '1947', 'comedy',
    'مصوّر أطفال يحلم بأن يكون محققاً خاصاً، فيجد نفسه متهماً بجريمة قتل. بطولة بوب هوب.',
    'A baby photographer who dreams of being a private eye is mistaken for one — and framed for murder. Starring Bob Hope.'),
  archive('the-flying-deuces', 'TheFlyingDeuces', 'The Flying Deuces', 'لوريل وهاردي في الفيلق', '1939', 'comedy',
    'لوريل وهاردي ينضمان إلى الفيلق الأجنبي الفرنسي هرباً من خيبة أمل عاطفية. من أشهر أفلام الثنائي.',
    'Laurel and Hardy join the French Foreign Legion to escape a broken heart. One of the duo’s best-loved features.'),
  archive('the-amazing-adventure', 'amazing_adventure', 'The Amazing Adventure', 'المغامرة المدهشة', '1936', 'comedy',
    'وريث ثري ملول يتحداه طبيبه أن يعيش سنة كاملة بعمله الخاص دون مال العائلة. مع كاري غرانت.',
    'A bored young heir is dared by his doctor to live a year earning his own keep. Starring Cary Grant.'),
  archive('the-pawnshop', 'CC_1916_10_02_ThePawnshop', 'The Pawnshop', 'محل الرهونات', '1916', 'comedy',
    'تشارلي شابلن موظف في محل رهونات يحوّل كل شيء إلى فوضى. فيلم قصير صامت من عصر السينما الأول.',
    'Charlie Chaplin works in a pawnshop and turns every transaction into chaos. A silent short from cinema’s first golden age.'),

  // ——— Film noir & mystery ———
  archive('scarlet-street', 'ScarletStreet', 'Scarlet Street', 'شارع القرمزي', '1945', 'noir',
    'موظف خجول وهاوي رسم يقع في حب امرأة تستغله، فتنهار حياته. من كلاسيكيات فيلم نوار بإخراج فريتز لانغ.',
    'A timid cashier and amateur painter falls for a woman who exploits him, and his life unravels. A Fritz Lang noir classic.'),
  archive('the-stranger', 'TheStranger_0', 'The Stranger', 'الغريب', '1946', 'noir',
    'محقق يطارد مجرم حرب نازياً اختبأ بهوية أستاذ في بلدة أمريكية هادئة. أخرجه وأدى بطولته أورسون ويلز.',
    'An investigator hunts a Nazi war criminal hiding as a professor in a quiet American town. Directed by and starring Orson Welles.'),
  archive('suddenly', 'suddenly', 'Suddenly', 'فجأة', '1954', 'noir',
    'قتلة محترفون يحتجزون عائلة في بلدة صغيرة استعداداً لاغتيال رئيس مارّ بالقطار. بطولة فرانك سيناترا.',
    'Professional gunmen take a family hostage in a small town to assassinate a president passing through by train. Starring Frank Sinatra.'),
  archive('impact', 'impact', 'Impact', 'الأثر', '1949', 'noir',
    'رجل أعمال ينجو من محاولة قتل دبّرتها زوجته، فيترك حياته ويبدأ من جديد باسم آخر.',
    'A businessman survives a murder plot arranged by his wife, abandons his old life and starts over under another name.'),
  archive('quicksand', 'Quicksand_clear', 'Quicksand', 'الرمال المتحركة', '1950', 'noir',
    'ميكانيكي يستدين مبلغاً صغيراً لإبهار فتاة، فتتدحرج الديون إلى جرائم متصاعدة. مع ميكي روني.',
    'A mechanic borrows a small sum to impress a girl and spirals into ever-worse crime. Starring Mickey Rooney.'),
  archive('dressed-to-kill', 'dressed_to_kill', 'Sherlock Holmes: Dressed to Kill', 'شرلوك هولمز: مستعد للقتل', '1946', 'noir',
    'شرلوك هولمز يتعقّب عصابة تستخدم علباً موسيقية لتمرير ألواح طباعة مزوّرة. مع باسل راثبون.',
    'Sherlock Holmes tracks a gang hiding forged banknote plates inside music boxes. Starring Basil Rathbone.'),
  archive('secret-weapon', 'secret_weapon', 'Sherlock Holmes and the Secret Weapon', 'شرلوك هولمز والسلاح السري', '1943', 'noir',
    'هولمز يهرّب مخترعاً من سويسرا لحمايته من موريارتي الذي يريد اختراعه العسكري.',
    'Holmes smuggles an inventor out of Switzerland to keep Moriarty from seizing his new bombsight.'),
  archive('secret-agent', 'Hitchcock_Secret_Agent', 'Secret Agent', 'العميل السري', '1936', 'noir',
    'كاتب بريطاني يُرسَل في مهمة تجسّس إلى سويسرا خلال الحرب العالمية الأولى. من إخراج ألفريد هيتشكوك.',
    'A British writer is sent on an espionage mission to Switzerland during the First World War. Directed by Alfred Hitchcock.'),

  // ——— Horror ———
  archive('house-on-haunted-hill', 'house_on_haunted_hill_ipod', 'House on Haunted Hill', 'البيت على التل المسكون', '1959', 'horror',
    'مليونير غريب الأطوار يعرض مبلغاً على خمسة غرباء إن قضوا ليلة كاملة في منزل مسكون. بطولة فنسنت برايس.',
    'An eccentric millionaire offers five strangers a fortune to survive one night in a haunted house. Starring Vincent Price.'),
  archive('carnival-of-souls', 'CarnivalofSouls', 'Carnival of Souls', 'كرنفال الأرواح', '1962', 'horror',
    'ناجية وحيدة من حادث غرق تنجذب إلى متنزه مهجور ومدينة أشباح. فيلم مؤثر أيقوني بميزانية ضئيلة.',
    'The sole survivor of a car crash is drawn to an abandoned pavilion and its ghostly visitors. A hugely influential low-budget horror film.'),
  archive('nosferatu', 'Nosferatu_most_complete_version_93_mins.', 'Nosferatu', 'نوسفيراتو', '1922', 'horror',
    'أول اقتباس سينمائي لـ«دراكولا»، صامت وألماني، وأحد أعظم أفلام الرعب في التاريخ.',
    'The first screen adaptation of Dracula — a German silent film and one of the most enduring horror works ever made.'),
  archive('the-ghoul', 'TheGhoul', 'The Ghoul', 'الغول', '1933', 'horror',
    'عالم مصريات بريطاني يعود من الموت ليطارد من سرق جوهرة دفن معه. من أوائل أفلام الرعب البريطانية.',
    'A British Egyptologist returns from the dead to hunt whoever stole the jewel buried with him. An early British horror film.'),
  archive('teenagers-from-outer-space', 'teenagers_from_outerspace', 'Teenagers from Outer Space', 'مراهقون من الفضاء', '1959', 'horror',
    'شاب فضائي يرفض استخدام الأرض مرعى لوحوش كوكبه، فيتمرد على رفاقه. خيال علمي كلاسيكي.',
    'A young alien refuses to let Earth become grazing land for his planet’s monsters, and turns on his crew.'),

  // ——— Westerns ———
  archive('mclintock', 'mclintok_widescreen', 'McLintock!', 'ماك لينتوك!', '1963', 'western',
    'مربي ماشية ثري في الغرب الأمريكي يصارع زوجته العائدة وابنته المتمردة. كوميديا غربية بطولة جون وين.',
    'A wealthy cattle baron battles his returning wife and headstrong daughter. A Western comedy starring John Wayne.'),
  archive('santa-fe-trail', 'Santa_Fe_Trail_movie', 'Santa Fe Trail', 'درب سانتا فيه', '1940', 'western',
    'ضباط جيش شباب — بينهم ستر وكاستر — يتورطون في صراع إلغاء العبودية قبل الحرب الأهلية. مع إرول فلين ورونالد ريغان.',
    'Young army officers, among them Stuart and Custer, are drawn into the abolitionist conflict before the Civil War. With Errol Flynn and Ronald Reagan.'),
  archive('only-the-valiant', 'OnlytheValaint', 'Only the Valiant', 'الشجعان فقط', '1951', 'western',
    'ضابط منبوذ يقود حفنة رجال في ممر جبلي لصدّ هجوم. بطولة غريغوري بيك.',
    'A disgraced officer leads a handful of men to hold a mountain pass against an attack. Starring Gregory Peck.'),

  // ——— Family & adventure ———
  archive('gullivers-travels', 'gullivers_travels1939', "Gulliver's Travels", 'رحلات غوليفر', '1939', 'family',
    'غوليفر يصل إلى جزيرة الأقزام ويساعد على إنهاء حرب بين مملكتين. ثاني فيلم رسوم متحركة طويل في تاريخ أمريكا.',
    'Gulliver washes ashore in Lilliput and helps end a war between two tiny kingdoms. America’s second animated feature.'),
  archive('the-little-princess', 'little_princess', 'The Little Princess', 'الأميرة الصغيرة', '1939', 'family',
    'فتاة تُترك في مدرسة داخلية قاسية وتصرّ على أن أباها المفقود في الحرب لا يزال حياً. بطولة شيرلي تمبل.',
    'A girl left in a harsh boarding school refuses to believe her father died at war. Starring Shirley Temple.'),
  archive('pied-piper', 'The_Pied_Piper_of_Hamelin', 'The Pied Piper of Hamelin', 'مزمار هاملين', '1957', 'family',
    'الحكاية الشعبية عن عازف يخلص بلدة من الجرذان ثم ينتقم حين يخلف أهلها وعدهم.',
    'The folk tale of a piper who rids a town of rats, then takes revenge when the townsfolk break their promise.'),
  archive('jungle-book', 'JungleBook', 'Jungle Book', 'كتاب الأدغال', '1942', 'adventure',
    'صبي ربّته الذئاب في أدغال الهند يعود إلى قرية البشر ويكتشف مؤامرة حول كنز مخفي.',
    'A boy raised by wolves in the Indian jungle returns to a human village and uncovers a plot over hidden treasure.'),
  archive('tarzans-revenge', 'tarzans_revenge', "Tarzan's Revenge", 'انتقام طرزان', '1938', 'adventure',
    'طرزان يحمي فتاة وخطيبها من صيّادين وعرّابين في أدغال أفريقيا.',
    'Tarzan protects a young woman and her fiancé from hunters and schemers in the African jungle.'),
  archive('the-iron-mask', 'iron_mask', 'The Iron Mask', 'القناع الحديدي', '1929', 'adventure',
    'الفرسان الثلاثة يواجهون مؤامرة على عرش فرنسا وسجيناً مجهولاً خلف قناع حديدي. بطولة دوغلاس فيربانكس.',
    'The Three Musketeers face a plot against the French throne and a prisoner hidden behind an iron mask. Starring Douglas Fairbanks.'),

  // ——— Classics & drama ———
  archive('royal-wedding', 'royal_wedding', 'Royal Wedding', 'زفاف ملكي', '1951', 'classic',
    'شقيقان يرقصان في لندن خلال زفاف الأميرة إليزابيث، ويقعان في الحب. بطولة فريد أستير.',
    'A brother-and-sister dance team performs in London during Princess Elizabeth’s wedding, and both fall in love. Starring Fred Astaire.'),
  archive('penny-serenade', 'penny_serenade', 'Penny Serenade', 'أنشودة البنس', '1941', 'classic',
    'زوجان يستعيدان قصة حبهما وتبنيهما طفلاً عبر أسطوانات موسيقية. من أكثر أدوار كاري غرانت إنسانية.',
    'A couple relive their romance and adoption through a stack of old records. One of Cary Grant’s most tender performances.'),
  archive('meet-john-doe', 'meet_john_doe', 'Meet John Doe', 'قابلوا جون دو', '1941', 'classic',
    'صحافية تخترع رسالة احتجاج من مواطن وهمي، فيتحول الاسم إلى حركة شعبية يصعب ضبطها. إخراج فرانك كابرا.',
    'A reporter invents a protest letter from a fictional everyman, and the name becomes a grassroots movement nobody can control. Directed by Frank Capra.'),
  archive('cyrano-de-bergerac', 'Cyrano_DeBergerac', 'Cyrano de Bergerac', 'سيرانو دي برجراك', '1950', 'classic',
    'شاعر مبارز يخفي حبه خلف أنف يراه قبيحاً، فيكتب رسائل الحب لصديق وسيم. نال خوسيه فيرير الأوسكار عنه.',
    'A poet and swordsman hides his love behind the nose he thinks ugly, writing letters for a handsome friend. José Ferrer won an Oscar for the role.'),
  archive('abraham-lincoln', 'abraham_lincoln', 'Abraham Lincoln', 'أبراهام لينكولن', '1930', 'classic',
    'سيرة الرئيس الأمريكي السادس عشر من شبابه في إلينوي إلى الحرب الأهلية. إخراج د. و. غريفيث.',
    'A biographical portrait of the sixteenth US president, from his youth in Illinois to the Civil War. Directed by D. W. Griffith.'),
  archive('battleship-potemkin', 'BattleshipPotemkin', 'Battleship Potemkin', 'المدرعة بوتمكين', '1925', 'classic',
    'بحّارة سفينة روسية يثورون على طعام فاسد فتتحول إلى انتفاضة في أوديسا. صامت، ومن أشهر أفلام المونتاج في التاريخ.',
    'Russian sailors mutiny over rotten food and spark the Odessa uprising. A silent landmark of film editing.'),

  // ——— Freely licensed modern animation ———
  {
    id: 'sita-sings-the-blues',
    archiveId: 'Sita_Sings_the_Blues',
    title: 'Sita Sings the Blues',
    titleAr: 'سيتا تغني البلوز',
    year: '2008',
    genre: 'animation',
    ar: 'إعادة سرد لملحمة رامايانا بأنماط رسوم متعددة وأغاني بلوز من العشرينيات. أطلقته صانعته للملك العام طوعاً.',
    en: 'A retelling of the Ramayana through multiple animation styles and 1920s blues songs, released into the public domain by its maker.',
    source: 'https://archive.org/details/Sita_Sings_the_Blues',
    license: 'public-domain',
    licenseLabel: 'CC0 — ملك عام',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    credit: 'Nina Paley',
  },
];

const BLENDER_FILMS: PublicFilm[] = [
  {
    id: 'bunny', archiveId: 'BigBuckBunny_328', still: '/art/films/big-buck-bunny-still.jpg',
    title: 'Big Buck Bunny', titleAr: 'الأرنب الكبير', year: '2008', genre: 'animation',
    ar: 'أرنب ضخم طيّب يواجه ثلاثة قوارض متنمّرة في يوم مشمس.',
    en: 'A gentle giant rabbit takes on three bullying rodents on a sunny day.',
    source: 'https://archive.org/details/BigBuckBunny_328', license: 'cc-by', licenseLabel: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', credit: '© Blender Foundation — peach.blender.org',
  },
  {
    id: 'sintel', archiveId: 'Sintel', still: '/art/films/sintel-still.jpg',
    title: 'Sintel', titleAr: 'سنتل', year: '2010', genre: 'animation',
    ar: 'فتاة تقطع أرضاً قاسية بحثاً عن تنّين صغير ربّته ثم فقدته.',
    en: 'A lonely girl crosses a harsh world searching for the baby dragon she once rescued.',
    source: 'https://archive.org/details/Sintel', license: 'cc-by', licenseLabel: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', credit: '© Blender Foundation — durian.blender.org',
  },
];

export const PUBLIC_FILMS: PublicFilm[] = [...BLENDER_FILMS, ...ARCHIVE_FILMS];

/** Poster art: a shipped still when we have one, else the Archive item thumbnail. */
export function filmPoster(film: PublicFilm): string {
  return film.still ?? `https://archive.org/services/img/${encodeURIComponent(film.archiveId)}`;
}

/**
 * Same-origin player URL. Every title is resolved server-side from its Archive
 * item, so no filename is ever hardcoded here.
 */
export function filmWatchUrl(film: PublicFilm): string {
  return `/api/movies/watch/${encodeURIComponent(film.id)}`;
}

/**
 * Casting requires an absolute, query-free HTTPS URL. The player only opens after
 * a user gesture, so `window` is always available at that point.
 */
export function absoluteWatchUrl(film: PublicFilm, origin?: string): string {
  const url = filmWatchUrl(film);
  if (!origin) return url;
  try { return new URL(url, origin).href; } catch { return url; }
}

export function getPublicFilm(id: string): PublicFilm | undefined {
  return PUBLIC_FILMS.find(film => film.id === id);
}
