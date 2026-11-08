import { getCompetitionRights, type Access } from '../../server/competition-rights';

type Language = 'ar' | 'en';

const T = {
  ar: {
    heading: 'وين أشاهد؟ — دليل الحقوق الرسمي',
    intro: 'بدل ما ندور على روابط مقرصنة تتوقف بعد يوم، هذا دليل بالجهات التي تملك الحقوق فعلاً، مع تعليق عربي، ومَن منها مجاني.',
    free: 'مجاني', freemium: 'مجاني جزئياً', paid: 'مدفوع',
    arabic: 'تعليق عربي', noArabic: 'بدون تعليق عربي',
    territory: 'النطاق', cost: 'التكلفة', scope: 'ماذا يشمل',
    watchHere: 'شاهد داخل المنصة', official: 'الموقع الرسمي',
    source: 'المصدر',
    freeSummary: 'الخيارات المجانية بالكامل',
    caution: 'أي موقع يعرض لك الدوري الإنجليزي أو الإسباني «مجاناً» خارج هؤلاء فهو إعادة بث غير مرخّصة: يتوقف بسرعة، ويعرّض المنصة للحجب. لذلك لا نضمّنه.',
    checked: 'تم التحقق: 8 نوفمبر 2026',
  },
  en: {
    heading: 'Where to watch — official rights guide',
    intro: 'Instead of hunting pirated links that die within a day, here is who actually holds the rights, with Arabic commentary, and which of them are free.',
    free: 'Free', freemium: 'Partly free', paid: 'Paid',
    arabic: 'Arabic commentary', noArabic: 'No Arabic commentary',
    territory: 'Territory', cost: 'Cost', scope: 'What it covers',
    watchHere: 'Watch inside the platform', official: 'Official site',
    source: 'Source',
    freeSummary: 'Completely free options',
    caution: 'Any site offering the Premier League or La Liga “free” outside these holders is an unlicensed restream: it dies quickly and gets platforms blocked. That is why we do not embed one.',
    checked: 'Verified: 8 November 2026',
  },
};

const ACCESS_CLASS: Record<Access, string> = {
  free: 'rg-badge free',
  freemium: 'rg-badge partly',
  paid: 'rg-badge paid',
};

/**
 * Informational rights guide. Renders NO player and NO stream URL — only who
 * holds the rights, what it costs, and official links. Entries whose channel is
 * already in the curated list link to it instead of pretending to be a stream.
 */
export default function RightsGuide({ language }: { language: Language }) {
  const t = T[language];
  const competitions = getCompetitionRights();
  if (competitions.length === 0) return null;
  const label: Record<Access, string> = { free: t.free, freemium: t.freemium, paid: t.paid };

  return (
    <section className="rg" aria-labelledby="rg-heading">
      <div className="rg-head">
        <h2 id="rg-heading">{t.heading}</h2>
        <p>{t.intro}</p>
      </div>

      <div className="rg-list">
        {competitions.map(comp => (
          <article className="rg-comp" key={comp.id}>
            <header className="rg-comp-head">
              <h3>{language === 'ar' ? comp.nameAr : comp.nameEn}</h3>
              <small>{language === 'ar' ? comp.territoryAr : comp.territoryEn}</small>
            </header>
            <p className="rg-verdict">{language === 'ar' ? comp.verdictAr : comp.verdictEn}</p>

            <ul className="rg-platforms">
              {comp.platforms.map(p => (
                <li className="rg-platform" key={p.id}>
                  <div className="rg-platform-head">
                    <strong>{language === 'ar' ? p.nameAr : p.nameEn}</strong>
                    <span className={ACCESS_CLASS[p.access]}>{label[p.access]}</span>
                    {p.arabicCommentary && <span className="rg-badge commentary">{t.arabic}</span>}
                  </div>
                  <p className="rg-scope">{language === 'ar' ? p.scopeAr : p.scopeEn}</p>
                  <p className="rg-cost">{language === 'ar' ? p.accessAr : p.accessEn}</p>
                  <div className="rg-actions">
                    {p.inAppChannelId
                      ? <a className="rg-watch" href={`/tv-sources#${p.inAppChannelId}`}>{t.watchHere} ▶</a>
                      : null}
                    <a className="rg-official" href={p.officialUrl} target="_blank" rel="noopener noreferrer">{t.official} ↗</a>
                  </div>
                </li>
              ))}
            </ul>

            <p className="rg-source">
              {t.source}:{' '}
              <a href={comp.sourceUrl} target="_blank" rel="noopener noreferrer">
                {language === 'ar' ? comp.sourceLabelAr : comp.sourceLabelEn}
              </a>
            </p>
          </article>
        ))}
      </div>

      <p className="rg-caution">{t.caution} <span>{t.checked}</span></p>
    </section>
  );
}
