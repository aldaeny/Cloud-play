import { getFreeToAir } from '../../server/free-to-air';
import { countryFlag } from '../../lib/country-flag';

type Language = 'ar' | 'en';

const T = {
  ar: {
    heading: 'قنوات مفتوحة على القمر الصناعي',
    intro: 'هذه الشبكات تبثّ مجاناً بالفضائيات، لكن لم نتحقق من بث ويب مفتوح لها يصلح للتشغيل هنا — لذلك نعرض ترددها ورابطها الرسمي بدل اختراع رابط لا يعمل.',
    notPlayable: 'لا تُشغّل داخل المنصة',
    coverage: 'ماذا تنقل',
    why: 'وضع البث على الإنترنت',
    tuning: 'الترددات المفتوحة (مجانية)',
    satellite: 'القمر', frequency: 'التردد', polarization: 'الاستقطاب', symbolRate: 'معدل الترميز', fec: 'FEC', standard: 'النظام',
    horizontal: 'أفقي H', vertical: 'عمودي V',
    official: 'الموقع الرسمي',
    disclaimer: 'الترددات منقولة من قوائم رصد الأقمار وقد تتغيّر — تحقّق منها على الموقع الرسمي أو أعد البحث في الرسيفر.',
    collected: 'تاريخ الجمع: 8 نوفمبر 2026',
  },
  en: {
    heading: 'Free-to-air sports on satellite',
    intro: 'These networks broadcast free over satellite, but no open web stream could be verified for playback here — so we publish their tuning details and official page instead of inventing a link that does not work.',
    notPlayable: 'Not playable inside the platform',
    coverage: 'What it carries',
    why: 'Online streaming status',
    tuning: 'Free-to-air transponders',
    satellite: 'Satellite', frequency: 'Frequency', polarization: 'Polarization', symbolRate: 'Symbol rate', fec: 'FEC', standard: 'Standard',
    horizontal: 'Horizontal H', vertical: 'Vertical V',
    official: 'Official site',
    disclaimer: 'Tuning details come from public satellite-monitoring listings and may change — confirm on the official site or rescan your receiver.',
    collected: 'Collected: 8 November 2026',
  },
};

/**
 * Honest fallback for free-to-air networks with no verifiable open web stream.
 * Deliberately renders NO player and NO stream URL — only tuning data and the
 * broadcaster's own page, so nothing here can be mistaken for a working channel.
 */
export default function FtaReference({ language }: { language: Language }) {
  const t = T[language];
  const entries = getFreeToAir();
  if (entries.length === 0) return null;

  return (
    <section className="fta" aria-labelledby="fta-heading">
      <div className="fta-head">
        <h2 id="fta-heading">{t.heading}</h2>
        <p>{t.intro}</p>
      </div>
      <div className="fta-grid">
        {entries.map(entry => (
          <article className="fta-card" key={entry.id}>
            <header className="fta-card-head">
              <span className="fta-flag" aria-hidden="true">{countryFlag(entry.country)}</span>
              <div className="fta-names">
                <h3>{language === 'ar' ? entry.nameAr : entry.nameEn}</h3>
                <small>{entry.broadcaster}</small>
              </div>
              <span className="fta-badge">{t.notPlayable}</span>
            </header>

            <p className="fta-line"><strong>{t.coverage}:</strong> {language === 'ar' ? entry.coverageAr : entry.coverageEn}</p>
            <p className="fta-note">{language === 'ar' ? entry.webStatusAr : entry.webStatusEn}</p>

            <h4 className="fta-sub">{t.tuning}</h4>
            <div className="fta-table-wrap">
              <table className="fta-table">
                <thead>
                  <tr>
                    <th scope="col">{t.satellite}</th>
                    <th scope="col">{t.frequency}</th>
                    <th scope="col">{t.polarization}</th>
                    <th scope="col">{t.symbolRate}</th>
                    <th scope="col">{t.fec}</th>
                    <th scope="col">{t.standard}</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.bands.map(band => (
                    <tr key={`${entry.id}-${band.satellite}-${band.frequency}`}>
                      <td>{band.satellite}</td>
                      <td className="fta-num">{band.frequency}</td>
                      <td>{band.polarization === 'H' ? t.horizontal : t.vertical}</td>
                      <td className="fta-num">{band.symbolRate}</td>
                      <td>{band.fec}</td>
                      <td>{band.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <a className="fta-link" href={entry.officialUrl} target="_blank" rel="noopener noreferrer">
              {t.official} ↗
            </a>
          </article>
        ))}
      </div>
      <p className="fta-foot">{t.disclaimer} <span>{t.collected}</span></p>
    </section>
  );
}
