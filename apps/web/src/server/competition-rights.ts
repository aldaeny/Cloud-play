/**
 * Where-to-watch guide — who legally holds Arabic-commentary rights for the
 * leagues people actually ask for, and what is genuinely free.
 *
 * Why this exists: visitors keep asking for "free beIN" or "free Premier
 * League". There is no legal free feed for those, and pointing at a restreamer
 * would put the whole platform at risk. Instead we publish the verified rights
 * map with official links, plus the free alternatives that DO exist — including
 * two already playable inside Cloud Play.
 *
 * Every entry carries the official source it was checked against and the date.
 * NOTHING here is a stream URL: this file must never become a channel list.
 *
 * Verified: 2026-11-08.
 */

export type Access = 'free' | 'freemium' | 'paid';

export type RightsPlatform = {
  id: string;
  nameAr: string;
  nameEn: string;
  officialUrl: string;
  access: Access;
  /** Plain-language cost reality — never just "free" without the catch. */
  accessAr: string;
  accessEn: string;
  arabicCommentary: boolean;
  /** What you actually get: full live matches, or only highlights/analysis. */
  scopeAr: string;
  scopeEn: string;
  /** If this platform's channel is already playable in-app, link it. */
  inAppChannelId?: string;
};

export type CompetitionRights = {
  id: string;
  nameAr: string;
  nameEn: string;
  /** The honest headline for this competition. */
  verdictAr: string;
  verdictEn: string;
  /** Territory the note applies to. */
  territoryAr: string;
  territoryEn: string;
  platforms: RightsPlatform[];
  /** Official announcement or rights-holder page this was checked against. */
  sourceUrl: string;
  sourceLabelAr: string;
  sourceLabelEn: string;
};

export const COMPETITION_RIGHTS: CompetitionRights[] = [
  {
    id: 'premier-league',
    nameAr: 'الدوري الإنجليزي الممتاز',
    nameEn: 'Premier League',
    verdictAr: 'ما فيه قناة مفتوحة تنقله مجاناً بالتعليق العربي. الحقوق حصرية ومشفّرة حتى نهاية موسم 2027–2028، وكل 380 مباراة تُنقل مباشرة عبر الناقل الرسمي فقط.',
    verdictEn: 'No free-to-air channel carries it with Arabic commentary. Rights are exclusive and encrypted through the end of 2027–28, and all 380 matches air live only on the official rights holder.',
    territoryAr: 'الشرق الأوسط وشمال أفريقيا (24 دولة، ومنها العراق)',
    territoryEn: 'Middle East & North Africa (24 countries, including Iraq)',
    platforms: [
      {
        id: 'bein-pl',
        nameAr: 'beIN SPORTS',
        nameEn: 'beIN SPORTS',
        officialUrl: 'https://www.bein.com/',
        access: 'paid',
        accessAr: 'اشتراك مدفوع عبر الرسيفر — باقة رياضية إلزامية.',
        accessEn: 'Paid receiver subscription — a sports package is required.',
        arabicCommentary: true,
        scopeAr: 'كل المباريات الـ380 مباشرة، بتعليق عربي وإنجليزي.',
        scopeEn: 'All 380 matches live, with Arabic and English commentary.',
      },
      {
        id: 'tod-pl',
        nameAr: 'TOD',
        nameEn: 'TOD',
        officialUrl: 'https://www.tod.tv/',
        access: 'paid',
        accessAr: 'اشتراك مدفوع — البث الرقمي الرسمي لنفس الحقوق، بدون رسيفر.',
        accessEn: 'Paid subscription — the official digital stream of the same rights, no receiver needed.',
        arabicCommentary: true,
        scopeAr: 'كل المباريات مباشرة على الهاتف والشاشة الذكية.',
        scopeEn: 'Every match live on phone and smart TV.',
      },
    ],
    sourceUrl: 'https://www.beinmediagroup.com/',
    sourceLabelAr: 'إعلان مجموعة beIN الإعلامية عن تجديد الحقوق حتى 2027–2028',
    sourceLabelEn: 'beIN Media Group announcement renewing rights through 2027–28',
  },
  {
    id: 'laliga',
    nameAr: 'الدوري الإسباني (لا ليغا)',
    nameEn: 'La Liga',
    verdictAr: 'الحقوق الإقليمية لـ beIN حتى 2027–2028، لكن الخبر المهم للعراق: الحقوق داخل العراق مشتركة رسمياً مع منصة «1001» العراقية التابعة لمجموعة الشرقية. يعني عندك طريق قانوني محلي أرخص من الرسيفر.',
    verdictEn: 'Regional rights sit with beIN through 2027–28, but the important part for Iraq: rights inside Iraq are officially shared with the Iraqi platform 1001, part of Al Sharqiya Group. That gives you a local legal route cheaper than a receiver package.',
    territoryAr: 'الشرق الأوسط وشمال أفريقيا — وداخل العراق مشتركة مع 1001',
    territoryEn: 'MENA — and inside Iraq, shared with 1001',
    platforms: [
      {
        id: '1001-laliga',
        nameAr: 'تطبيق 1001 (الشرقية)',
        nameEn: '1001 app (Al Sharqiya)',
        officialUrl: 'https://1001.tv/',
        access: 'freemium',
        accessAr: 'التطبيق مجاني التنزيل وفيه مشتريات داخلية. مباريات لا ليغا قُدّمت مجاناً برعاية مصرفية في مواسم سابقة — تحقّق داخل التطبيق هل الرعاية سارية هذا الموسم.',
        accessEn: 'The app is free to download with in-app purchases. La Liga matches were offered free under bank sponsorship in past seasons — check inside the app whether that sponsorship is active this season.',
        arabicCommentary: true,
        scopeAr: 'كل مباريات لا ليغا الـ380 داخل العراق بجودة عالية، مع استوديو تحليلي عراقي.',
        scopeEn: 'All 380 La Liga matches inside Iraq in high quality, with an Iraqi analysis studio.',
      },
      {
        id: 'alsharqiya-laliga',
        nameAr: 'الشرقية + الشرقية نيوز',
        nameEn: 'Al Sharqiya + Al Sharqiya News',
        officialUrl: 'https://www.alsharqiya.com/',
        access: 'free',
        accessAr: 'مجاني بالكامل — وموجود أصلاً داخل منصتنا يشتغل.',
        accessEn: 'Completely free — and already playable inside our platform.',
        arabicCommentary: true,
        scopeAr: 'ملخصات وأهداف لا ليغا وتحليل عربي مع مراسلين في إسبانيا — ليست مباريات كاملة مباشرة.',
        scopeEn: 'La Liga highlights, goals and Arabic analysis with reporters in Spain — not full live matches.',
        inAppChannelId: 'alsharqiya',
      },
      {
        id: 'bein-laliga',
        nameAr: 'beIN SPORTS',
        nameEn: 'beIN SPORTS',
        officialUrl: 'https://www.bein.com/',
        access: 'paid',
        accessAr: 'اشتراك مدفوع — الباقة الرياضية.',
        accessEn: 'Paid subscription — the sports package.',
        arabicCommentary: true,
        scopeAr: 'كل المباريات الـ380 مباشرة بتعليق عربي.',
        scopeEn: 'All 380 matches live with Arabic commentary.',
      },
    ],
    sourceUrl: 'https://www.beinmediagroup.com/ar/article/bein-%D8%AA%D9%85%D8%AF%D8%AF-%D8%AD%D9%82%D9%88%D9%82-%D8%A7%D9%84%D8%A8%D8%AB-%D8%A7%D9%84%D8%AD%D8%B5%D8%B1%D9%8A-%D9%84%D9%84%D8%AF%D9%88%D8%B1%D9%8A-%D8%A7%D9%84%D8%A5%D8%B3%D8%A8%D8%A7%D9%86',
    sourceLabelAr: 'بيان beIN الرسمي: «تتشارك beIN حقوق البث في العراق مع منصة 1001»',
    sourceLabelEn: 'Official beIN release: “beIN shares broadcast rights in Iraq with the 1001 platform”',
  },
  {
    id: 'roshn-league',
    nameAr: 'دوري روشن السعودي',
    nameEn: 'Saudi Roshn League',
    verdictAr: 'هذا الدوري مجاني فعلاً بالتعليق العربي. ثمانية هي الناقل الرسمي حتى 2031 وتعلن بث كل المباريات مجاناً عبر تطبيقها وقنواتها الفضائية.',
    verdictEn: 'This one really is free with Arabic commentary. Thmanyah is the official rights holder through 2031 and announces free coverage of every match through its app and satellite channels.',
    territoryAr: 'السعودية والمنطقة — البث الفضائي مفتوح',
    territoryEn: 'Saudi Arabia and the region — satellite broadcast is free-to-air',
    platforms: [
      {
        id: 'thmanyah-roshn',
        nameAr: 'ثمانية / Jako',
        nameEn: 'Thmanyah / Jako',
        officialUrl: 'https://thmanyah.com/',
        access: 'free',
        accessAr: 'مجاني لكل المباريات، مع باقة مدفوعة اختيارية للجودة والتحليلات.',
        accessEn: 'Free for every match, with an optional paid tier for quality and analytics.',
        arabicCommentary: true,
        scopeAr: 'كل مباريات الدوري وكأس الملك والسوبر ودوري يلو.',
        scopeEn: 'Every league, King Cup, Super Cup and Yelo League match.',
      },
    ],
    sourceUrl: 'https://company.thmanyah.com/2700',
    sourceLabelAr: 'إعلان ثمانية الرسمي عن حقوق البث حتى 2031',
    sourceLabelEn: 'Thmanyah official rights announcement through 2031',
  },
  {
    id: 'iraqi-league',
    nameAr: 'دوري نجوم العراق',
    nameEn: 'Iraqi Stars League',
    verdictAr: 'مجاني بالكامل وموجود داخل منصتنا — العراقية الرياضية تبثّ مباشرة من سيرفر شبكة الإعلام العراقي، وتحقّقنا منه فعلياً.',
    verdictEn: 'Completely free and already inside our platform — Al Iraqia Sport streams live from the Iraqi Media Network’s own server, and we verified it.',
    territoryAr: 'العراق والعالم — بث مفتوح',
    territoryEn: 'Iraq and worldwide — open stream',
    platforms: [
      {
        id: 'imn-iraqi-league',
        nameAr: 'العراقية الرياضية',
        nameEn: 'Al Iraqia Sport',
        officialUrl: 'https://imn.iq/',
        access: 'free',
        accessAr: 'مجاني بدون اشتراك ولا تسجيل دخول — يشتغل داخل المنصة الآن.',
        accessEn: 'Free with no subscription and no sign-in — plays inside the platform right now.',
        arabicCommentary: true,
        scopeAr: 'الدوري العراقي والمسابقات المحلية بتعليق عربي.',
        scopeEn: 'The Iraqi league and domestic competitions with Arabic commentary.',
        inAppChannelId: 'iraqia-sport',
      },
    ],
    sourceUrl: 'https://imn.iq/',
    sourceLabelAr: 'شبكة الإعلام العراقي — الناقل الرسمي المحلي',
    sourceLabelEn: 'Iraqi Media Network — the official domestic broadcaster',
  },
];

/** Defensive: a rights entry must be informational only, with real sources. */
export function getCompetitionRights(): CompetitionRights[] {
  const seen = new Set<string>();
  return COMPETITION_RIGHTS.filter(entry => {
    if (!entry.id || seen.has(entry.id)) return false;
    if (!entry.nameAr || !entry.nameEn || !entry.verdictAr || !entry.verdictEn) return false;
    if (entry.platforms.length === 0) return false;
    if (!isHttps(entry.sourceUrl)) return false;
    const ok = entry.platforms.every(p =>
      p.id && p.nameAr && p.nameEn && isHttps(p.officialUrl)
      && ['free', 'freemium', 'paid'].includes(p.access)
      && p.accessAr && p.accessEn && p.scopeAr && p.scopeEn,
    );
    if (!ok) return false;
    seen.add(entry.id);
    return true;
  });
}

function isHttps(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Platforms that cost nothing at all — the useful answer for a zero budget. */
export function getFreeOptions(): RightsPlatform[] {
  return getCompetitionRights().flatMap(entry => entry.platforms.filter(p => p.access === 'free'));
}
