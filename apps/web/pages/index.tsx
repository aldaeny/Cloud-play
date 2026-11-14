import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { GetStaticProps } from 'next';
import IntroLayer from '../src/components/intro/IntroLayer';
import CloudPlayBrand from '../src/components/brand/CloudPlayBrand';
import AppHeader from '../src/components/layout/AppHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import SearchField from '../src/components/search/SearchField';
import FilmCard from '../src/components/movies/FilmCard';
import Rail from '../src/components/ui/Rail';
import Icon from '../src/components/icons/Icon';
import { useBranding } from '../src/components/brand/BrandingProvider';
import { brandingStyle } from '../src/components/brand/branding-style';
import { useI18n } from '../src/lib/i18n';
import { useAppearance } from '../src/lib/use-appearance';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs, LIBRARY_EVENT } from '../src/lib/preferences';
import { PUBLIC_FILMS, filmPoster, getPublicFilm } from '../src/server/public-films';
import { getPublicChannels } from '../src/server/public-tv';

type Progress = Record<string, { position: number; duration: number }>;

function readProgress(): Progress {
  const result: Progress = {};
  try {
    for (const film of PUBLIC_FILMS) {
      const raw = JSON.parse(localStorage.getItem(`cloudplay-progress-v1-${film.id}`) || 'null');
      if (raw && Number.isFinite(raw.position) && raw.position >= 5) {
        result[film.id] = {
          position: raw.position,
          duration: Number.isFinite(raw.duration) && raw.duration > raw.position ? raw.duration : raw.position + 1,
        };
      }
    }
  } catch { /* Storage is optional. */ }
  return result;
}

function readFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('cloudplay-movie-favorites-v1') || '[]');
    if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === 'string' && Boolean(getPublicFilm(id)));
  } catch { /* Storage is optional. */ }
  return [];
}

export const getStaticProps: GetStaticProps = async () => ({
  props: { curatedChannelCount: getPublicChannels().length },
});

export default function Home({ curatedChannelCount }: { curatedChannelCount: number }) {
  const brand = useBranding();
  const brandName = brand?.displayName || 'Cloud Play';
  const router = useRouter();
  const { t, n, lang } = useI18n();
  const appearance = useAppearance();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);

  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState<Progress>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => { setProgress(readProgress()); setFavorites(readFavorites()); };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(LIBRARY_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(LIBRARY_EVENT, refresh);
    };
  }, []);

  const featured = PUBLIC_FILMS.slice(0, 12);
  const spotlight = getPublicFilm('bunny') ?? PUBLIC_FILMS[0];
  const continueWatching = useMemo(
    () => PUBLIC_FILMS.filter(film => progress[film.id]).slice(0, 10),
    [progress],
  );
  const favoriteFilms = useMemo(
    () => favorites.map(id => getPublicFilm(id)).filter(Boolean).slice(0, 10) as typeof PUBLIC_FILMS,
    [favorites],
  );
  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length < 2) return [];
    return PUBLIC_FILMS.filter(film =>
      `${film.title} ${film.titleAr} ${film.ar} ${film.en} ${film.year}`
        .toLocaleLowerCase().includes(needle),
    ).slice(0, 6);
  }, [query]);

  const classes = [
    'site', `theme-${appearance.theme === 'black' ? 'dark' : appearance.theme}`,
    appearance.reduceMotion ? 'motion-off' : '',
    !prefs.glow ? 'no-glow' : '',
    prefs.solidPanels ? 'solid-panels' : '',
    prefs.textSize === 'large' ? 'text-large' : '',
    prefs.highContrast ? 'high-contrast' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} id="top" style={brandingStyle(brand, appearance.theme)} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <IntroLayer />
      <Head>
        <title>{brand ? `${brandName} — ${t('home.kicker')}` : `Cloud Play Iraq | ${t('home.title').replace('\n', ' ')}`}</title>
        <meta name="description" content={t('home.subtitle')} />
        {!brand && <link rel="canonical" href="https://cloud-play-iraq.vercel.app/" />}
        <meta name="color-scheme" content="dark light" />
      </Head>

      <AppHeader onSearchClick={() => searchRef.current?.focus()} hasQuery={Boolean(query.trim())} />
      <main id="main">

        {/* ---- Hero ------------------------------------------------------- */}
        <section className="cp-hero" aria-labelledby="hero-title">
          <div className="cp-hero__scene" aria-hidden="true">
            <Image src="/art/cloud-city-hero.jpg" alt="" fill priority sizes="100vw" />
            <span className="cp-hero-scrim" />
            <span className="cp-orb cp-orb--violet" style={{ insetBlockStart: '-10%', insetInlineEnd: '8%' }} />
          </div>

          <div className="cp-hero__inner shell">
            <div className="cp-hero__copy cp-on-media">
              <span className="cp-hero__kicker">
                <span className="cp-badge cp-badge--live"><span className="cp-badge__dot" />{t('common.live')}</span>
                <span className="cp-type-micro">{t('home.kicker')}</span>
              </span>
              <h1 id="hero-title" className="cp-type-display">
                {t('home.title').split('\n').map((line, index) => <span key={line}>{line}{index === 0 && <br />}</span>)}
              </h1>
              <p className="cp-hero__sub">{t('home.subtitle')}</p>
              <div className="cp-hero__actions">
                <Link href="/movies" className="cp-btn" data-variant="primary" data-size="lg">
                  <span className="cp-btn__glyph"><Icon name="play" size={13} /></span>
                  {t('home.browseFilms')}
                </Link>
                <Link href="/live" className="cp-btn" data-size="lg">
                  <Icon name="tv" size={18} />
                  {t('home.exploreLive')}
                </Link>
              </div>
              <dl className="cp-hero__stats">
                <div><dt>{t('home.stat.films')}</dt><dd className="cp-num">{n(PUBLIC_FILMS.length)}</dd></div>
                <div><dt>{t('home.stat.channels')}</dt><dd className="cp-num">{n(curatedChannelCount)}</dd></div>
                <div><dt>{t('home.stat.free')}</dt><dd>{t('common.free')}</dd></div>
              </dl>
            </div>

            <aside className="cp-spotlight" aria-label={t('home.featured')}>
              <div className="cp-spotlight__art">
                <Image src={filmPoster(spotlight)} alt="" fill priority unoptimized sizes="360px" />
                <span className="cp-media__scrim" aria-hidden="true" />
                <span className="cp-badge cp-spotlight__badge">{t('home.featured')}</span>
              </div>
              <div className="cp-spotlight__body">
                <span className="cp-type-micro">{t('common.new')}</span>
                <h2>{lang === 'ar' ? spotlight.titleAr : spotlight.title}</h2>
                <p>{lang === 'ar' ? spotlight.ar : spotlight.en}</p>
                <div className="cp-spotlight__actions">
                  <Link href={`/movies/${spotlight.id}`} className="cp-btn" data-variant="primary">
                    <Icon name="play" size={15} />{t('home.watchNow')}
                  </Link>
                  <span className="cp-badge cp-num">{spotlight.year}</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* ---- Search + quick destinations -------------------------------- */}
        <section className="cp-quick shell" aria-label={t('common.search')}>
          <div className="cp-quick__search">
            <SearchField
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
              placeholder={t('search.placeholder')}
              label={t('header.search')}
              inputRef={searchRef}
              onSubmit={() => {
                const value = query.trim();
                void router.push(value ? { pathname: '/search', query: { q: value } } : '/search');
              }}
              shortcut="/"
            />
            {suggestions.length > 0 && (
              <div className="cp-suggest cp-glass cp-glass--thick" role="listbox" aria-label={t('search.results')}>
                {suggestions.map(film => (
                  <Link key={film.id} href={`/movies/${film.id}`} className="cp-suggest__item" role="option" aria-selected={false}>
                    <span className="cp-suggest__art">
                      <Image src={filmPoster(film)} alt="" fill unoptimized sizes="44px" />
                    </span>
                    <span className="cp-suggest__copy">
                      <strong>{lang === 'ar' ? film.titleAr : film.title}</strong>
                      <small>{film.year}</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="cp-quick__chips">
            <Link href="/live" className="cp-chip"><span className="ptv-dot" aria-hidden="true" />{t('home.liveNow')}</Link>
            <Link href="/movies" className="cp-chip">{t('nav.movies')}</Link>
            <Link href="/series" className="cp-chip">{t('nav.series')}</Link>
            <Link href="/favorites" className="cp-chip">{t('nav.favorites')}</Link>
          </div>
        </section>

        {/* ---- Continue watching ------------------------------------------ */}
        {continueWatching.length > 0 && (
          <Rail
            id="rail-continue"
            title={t('home.continue')}
            subtitle={t('home.continueSub')}
            action={t('common.viewAll')}
            actionHref="/continue"
          >
            {continueWatching.map(film => (
              <FilmCard
                key={film.id}
                film={film}
                progress={progress[film.id] ? progress[film.id].position / progress[film.id].duration : undefined}
              />
            ))}
          </Rail>
        )}

        {/* ---- Featured --------------------------------------------------- */}
        <Rail
          id="rail-featured"
          title={t('home.featured')}
          subtitle={t('home.featuredSub')}
          action={t('common.seeAll')}
          actionHref="/movies"
        >
          {featured.map(film => <FilmCard key={film.id} film={film} />)}
        </Rail>

        {/* ---- Destinations ----------------------------------------------- */}
        <section className="cp-destinations shell" aria-labelledby="destinations-title">
          <div className="cp-destinations__head">
            <h2 id="destinations-title">{t('home.library')}</h2>
            <p>{t('home.librarySub')}</p>
          </div>
          <div className="cp-destinations__grid">
            <Link href="/live" className="cp-dest cp-glass cp-glass--interactive cp-glass--thick">
              <span className="cp-dest__icon"><Icon name="tv" size={22} /></span>
              <span className="cp-badge cp-badge--live"><span className="cp-badge__dot" />{t('common.live')}</span>
              <strong>{t('home.liveNow')}</strong>
              <p>{t('home.liveSub')}</p>
              <span className="cp-dest__meta cp-num">{n(curatedChannelCount)} {t('live.channels')}</span>
              <span className="cp-dest__go">{t('common.watchNow')} <Icon name="arrow" size={15} /></span>
            </Link>
            <Link href="/movies" className="cp-dest cp-glass cp-glass--interactive cp-glass--thick">
              <span className="cp-dest__icon"><Icon name="film" size={22} /></span>
              <span className="cp-badge">{t('nav.movies')}</span>
              <strong>{t('home.library')}</strong>
              <p>{t('home.librarySub')}</p>
              <span className="cp-dest__meta cp-num">{n(PUBLIC_FILMS.length)} {t('home.stat.films')}</span>
              <span className="cp-dest__go">{t('common.seeAll')} <Icon name="arrow" size={15} /></span>
            </Link>
            <Link href="/series" className="cp-dest cp-glass cp-glass--interactive cp-glass--thick">
              <span className="cp-dest__icon"><Icon name="play" size={22} /></span>
              <span className="cp-badge">{t('nav.series')}</span>
              <strong>{t('nav.series')}</strong>
              <p>{t('nav.series.desc')}</p>
              <span className="cp-dest__meta">{t('common.free')}</span>
              <span className="cp-dest__go">{t('common.more')} <Icon name="arrow" size={15} /></span>
            </Link>
          </div>
        </section>

        {/* ---- Favorites --------------------------------------------------- */}
        <Rail
          id="rail-favorites"
          title={t('home.favorites')}
          subtitle={t('home.favoritesSub')}
          action={t('common.viewAll')}
          actionHref="/favorites"
        >
          {favoriteFilms.length > 0 ? favoriteFilms.map(film => <FilmCard key={film.id} film={film} />) : (
            <div className="cp-rail-empty cp-glass cp-glass--thin">
              <Icon name="star" size={20} />
              <p>{t('home.noFavorites')}</p>
              <Link href="/movies" className="cp-btn" data-size="sm">{t('home.browseFilms')}</Link>
            </div>
          )}
        </Rail>

        {/* ---- Platform ---------------------------------------------------- */}
        <section className="cp-about shell" aria-labelledby="about-title">
          <div className="cp-about__panel cp-glass cp-glass--thick">
            <div className="cp-about__copy">
              <span className="cp-type-micro">{brand ? brandName : t('home.kicker')}</span>
              <h2 id="about-title">{t('home.platform')}</h2>
              <p>{t('home.platformBody')}</p>
              <div className="cp-about__badges">
                <span className="cp-badge">{t('language.arabic')} / {t('language.english')}</span>
                <span className="cp-badge">{t('theme.dark')} · {t('theme.light')}</span>
                <span className="cp-badge">{t('common.free')}</span>
              </div>
            </div>
            <div className="cp-about__actions">
              <Link href="/about" className="cp-btn" data-variant="primary">{t('home.platformCta')} <Icon name="arrow" size={15} /></Link>
              <Link href="/settings" className="cp-btn" data-variant="ghost">{t('common.settings')}</Link>
            </div>
            <span className="cp-orb cp-orb--blue" aria-hidden="true" style={{ insetBlockEnd: '-40%', insetInlineStart: '-10%' }} />
          </div>
        </section>

        <div className="cp-brand-strip shell" aria-hidden="true">
          <CloudPlayBrand />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
