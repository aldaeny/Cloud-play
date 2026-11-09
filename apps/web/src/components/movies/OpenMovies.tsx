import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import MediaViewer from '../player/MediaViewer';
import { LIBRARY_EVENT, notifyLibraryChanged } from '../../lib/preferences';
import { matchesSearch } from '../../lib/search-normalize';
import { PUBLIC_FILMS, absoluteWatchUrl, filmPoster, type FilmGenre, type PublicFilm } from '../../server/public-films';

type Language = 'ar' | 'en';
type LibraryFilter = 'all' | 'favorites' | 'continue';
type GenreFilter = 'all' | FilmGenre;

const GENRES: { key: GenreFilter; ar: string; en: string }[] = [
  { key: 'all', ar: 'كل الأنواع', en: 'All genres' },
  { key: 'classic', ar: 'كلاسيكيات', en: 'Classics' },
  { key: 'noir', ar: 'نوار وغموض', en: 'Noir & mystery' },
  { key: 'comedy', ar: 'كوميديا', en: 'Comedy' },
  { key: 'horror', ar: 'رعب وخيال علمي', en: 'Horror & sci-fi' },
  { key: 'western', ar: 'غربي', en: 'Western' },
  { key: 'adventure', ar: 'مغامرة', en: 'Adventure' },
  { key: 'family', ar: 'عائلي', en: 'Family' },
  { key: 'animation', ar: 'رسوم متحركة', en: 'Animation' },
];

const T = {
  ar: {
    eyebrow: 'مشاهدة مجانية · بدون تسجيل دخول',
    heading: 'مكتبة الأفلام',
    intro: 'أفلام كاملة من الملك العام وأعمال مرخّصة بحرية. شغّل أي فيلم مباشرة — لا حساب ولا اشتراك ولا دفع.',
    all: 'الكل', continue: 'متابعة المشاهدة', favorites: 'المفضلة',
    search: 'ابحث عن فيلم…', count: 'فيلم', empty: 'لا توجد أفلام مطابقة.',
    watch: '▶ شاهد الفيلم', resume: '▶ استكمال المشاهدة', details: 'التفاصيل',
    addFav: 'إضافة إلى المفضلة', removeFav: 'إزالة من المفضلة',
    source: 'المصدر', license: 'الترخيص', back: 'كل الأفلام',
    note: 'يُحفظ التقدم والمفضلة على هذا الجهاز، وتُزامَن مع حسابك المجاني عند تسجيل الدخول.',
    attribution: 'الأفلام من مجموعة الملك العام في Internet Archive ومن أفلام Blender المفتوحة. التشغيل يتصل بالمصدر مباشرة ويعتمد على توفره.',
    playbackHelp: 'إذا لم يبدأ الفيلم فوراً فالمصدر بطيء أو غير متاح حالياً — جرّب مرة أخرى أو افتح صفحة المصدر.',
    clear: 'مسح',
  },
  en: {
    eyebrow: 'FREE TO WATCH · NO SIGN-IN',
    heading: 'Film library',
    intro: 'Full public-domain features and openly licensed films. Play any title instantly — no account, no subscription, no payment.',
    all: 'All', continue: 'Continue watching', favorites: 'Favorites',
    search: 'Search films…', count: 'films', empty: 'No matching films.',
    watch: '▶ Watch film', resume: '▶ Resume watching', details: 'Details',
    addFav: 'Add to favorites', removeFav: 'Remove favorite',
    source: 'Source', license: 'License', back: 'All films',
    note: 'Progress and favorites are saved on this device and synced to your free account when you sign in.',
    attribution: 'Films come from the Internet Archive public-domain collection and the Blender open movies. Playback connects directly to the source and depends on its availability.',
    playbackHelp: 'If a film does not start right away the source is slow or temporarily unavailable — retry, or open its source page.',
    clear: 'Clear',
  },
};

function readProgress(): Record<string, number> {
  const result: Record<string, number> = {};
  try {
    for (const film of PUBLIC_FILMS) {
      const raw = JSON.parse(localStorage.getItem(`cloudplay-progress-v1-${film.id}`) || 'null');
      if (raw && Number.isFinite(raw.position) && raw.position >= 5) result[film.id] = raw.position;
    }
  } catch { /* Storage unavailable. */ }
  return result;
}

function readFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('cloudplay-movie-favorites-v1') || '[]');
    if (Array.isArray(raw)) return raw.filter(x => typeof x === 'string' && PUBLIC_FILMS.some(f => f.id === x));
  } catch { /* Storage unavailable. */ }
  return [];
}

export default function OpenMovies({
  language, query = '', initialFilter = 'all', onlyId,
}: { language: Language; query?: string; initialFilter?: LibraryFilter; onlyId?: string }) {
  const t = T[language];
  const ar = language === 'ar';
  const [chosen, setChosen] = useState<PublicFilm | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>(initialFilter);
  const [genre, setGenre] = useState<GenreFilter>('all');
  const [search, setSearch] = useState('');
  const [brokenPosters, setBrokenPosters] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => { setProgress(readProgress()); setFavorites(readFavorites()); };
    Promise.resolve().then(refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(LIBRARY_EVENT, refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener(LIBRARY_EVENT, refresh); };
  }, []);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem('cloudplay-movie-favorites-v1', JSON.stringify(next)); } catch { /* Works in this session. */ }
    notifyLibraryChanged();
  }

  const needle = `${query} ${search}`.trim();
  const filtered = useMemo(() => PUBLIC_FILMS.filter(film => {
    if (onlyId && film.id !== onlyId) return false;
    if (genre !== 'all' && film.genre !== genre) return false;
    if (filter === 'favorites' && !favorites.includes(film.id)) return false;
    if (filter === 'continue' && !progress[film.id]) return false;
    if (!matchesSearch(`${film.title} ${film.titleAr} ${film.ar} ${film.en} ${film.year}`, needle)) return false;
    return true;
  }), [onlyId, genre, filter, favorites, progress, needle]);

  const genreLabel = (key: FilmGenre) => GENRES.find(g => g.key === key)?.[language] ?? key;

  function poster(film: PublicFilm) {
    const broken = brokenPosters.includes(film.id);
    return (
      <div className="film-poster">
        {broken
          ? <span className="film-poster-fallback" aria-hidden="true">{film.title.slice(0, 1)}</span>
          : <Image
              src={filmPoster(film)}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 700px) 45vw, (max-width: 1100px) 22vw, 200px"
              onError={() => setBrokenPosters(prev => prev.includes(film.id) ? prev : [...prev, film.id])}
            />}
        <span className="film-poster-shade" aria-hidden="true" />
        <span className="film-year">{film.year}</span>
        {progress[film.id] && <span className="film-resume-dot" aria-hidden="true" />}
      </div>
    );
  }

  function viewer(film: PublicFilm) {
    return (
      <MediaViewer
        key={film.id}
        className="open-movie-viewer"
        language={language}
        title={ar ? film.titleAr : film.title}
        url={absoluteWatchUrl(film, typeof window === 'undefined' ? undefined : window.location.origin)}
        kind="mp4"
        progressKey={film.id}
        onClose={() => { setChosen(null); setProgress(readProgress()); }}
        footer={(
          <small>
            {film.credit} · <a href={film.licenseUrl} target="_blank" rel="noreferrer">{film.licenseLabel}</a> ·{' '}
            <a href={film.source} target="_blank" rel="noreferrer">{t.source}</a>
            <br />{t.playbackHelp}
          </small>
        )}
      />
    );
  }

  // ——— Single-film detail page ———
  if (onlyId) {
    const film = PUBLIC_FILMS.find(f => f.id === onlyId);
    if (!film) return null;
    const isFavorite = favorites.includes(film.id);
    return (
      <section className="open-movies shell reveal-on-scroll" id="movies-library" aria-labelledby="open-movies-title">
        <div className="film-detail">
          <div className="film-detail-art">{poster(film)}</div>
          <div className="film-detail-copy">
            <div className="eyebrow"><span className="tiny-line" />{t.eyebrow}</div>
            <h1 id="open-movies-title">{ar ? film.titleAr : film.title}</h1>
            <p className="film-detail-meta">{film.title} · {film.year} · {genreLabel(film.genre)} · {film.licenseLabel}</p>
            <p className="film-detail-desc">{film[language]}</p>
            <div className="film-detail-actions">
              <button className="film-play" onClick={() => setChosen(film)}>{progress[film.id] ? t.resume : t.watch}</button>
              <button className="film-star" aria-pressed={isFavorite} onClick={() => toggleFavorite(film.id)}>
                {isFavorite ? '★' : '☆'} {isFavorite ? t.removeFav : t.addFav}
              </button>
            </div>
            <small className="film-credit">
              {film.credit} · <a href={film.licenseUrl} target="_blank" rel="noreferrer">{film.licenseLabel}</a> ·{' '}
              <a href={film.source} target="_blank" rel="noreferrer">{t.source}</a>
            </small>
            <Link className="film-back" href="/movies">← {t.back}</Link>
          </div>
        </div>
        {chosen && viewer(chosen)}
        <p className="firebase-note">{t.attribution}</p>
      </section>
    );
  }

  // ——— Library grid ———
  return (
    <section className="open-movies shell reveal-on-scroll" id="movies-library" aria-labelledby="open-movies-title">
      <div className="section-head">
        <div>
          <div className="eyebrow"><span className="tiny-line" />{t.eyebrow}</div>
          <h2 id="open-movies-title">{t.heading}</h2>
          <p>{t.intro}</p>
        </div>
      </div>

      <div className="film-toolbar">
        <div className="movie-filters" role="group" aria-label={ar ? 'تصفية المكتبة' : 'Filter library'}>
          {(['all', 'continue', 'favorites'] as const).map(key => (
            <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{t[key]}</button>
          ))}
        </div>
        <input
          className="film-search"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value.slice(0, 120))}
          placeholder={t.search}
          aria-label={t.search}
        />
      </div>

      <div className="film-genres" role="group" aria-label={ar ? 'تصفية حسب النوع' : 'Filter by genre'}>
        {GENRES.map(item => (
          <button key={item.key} aria-pressed={genre === item.key} onClick={() => setGenre(item.key)}>{item[language]}</button>
        ))}
      </div>

      <p className="film-count" aria-live="polite">{filtered.length} {t.count}</p>

      <div className="film-grid cp-filter-swap" key={`${filter}-${genre}`}>
        {filtered.map(film => {
          const isFavorite = favorites.includes(film.id);
          return (
            <article className="film-card" key={film.id}>
              <button className="film-open" onClick={() => setChosen(film)} aria-label={`${t.watch}: ${ar ? film.titleAr : film.title}`}>
                {poster(film)}
                <strong className="film-title">{ar ? film.titleAr : film.title}</strong>
                <small className="film-genre">{genreLabel(film.genre)}</small>
                <span className="film-play-cue">{progress[film.id] ? t.resume : t.watch}</span>
              </button>
              <div className="film-card-foot">
                <a className="movie-details-link" href={`/movies/${film.id}`}>{t.details}</a>
                <button
                  className="film-star-sm"
                  aria-pressed={isFavorite}
                  aria-label={`${isFavorite ? t.removeFav : t.addFav}: ${film.title}`}
                  onClick={() => toggleFavorite(film.id)}
                >{isFavorite ? '★' : '☆'}</button>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="film-empty">{t.empty}</p>}

      <p className="firebase-note">{t.note}</p>
      <p className="firebase-note">{t.attribution}</p>

      {chosen && viewer(chosen)}
    </section>
  );
}
