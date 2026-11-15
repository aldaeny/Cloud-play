'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import Icon from '../icons/Icon';
import { filmPoster, type FilmGenre, type PublicFilm } from '../../server/public-films';
import { useI18n } from '../../lib/i18n';

const GENRE: Record<FilmGenre, { ar: string; en: string }> = {
  classic: { ar: 'كلاسيكيات', en: 'Classics' },
  noir: { ar: 'نوار وغموض', en: 'Noir & mystery' },
  comedy: { ar: 'كوميديا', en: 'Comedy' },
  horror: { ar: 'رعب وخيال علمي', en: 'Horror & sci-fi' },
  western: { ar: 'غربي', en: 'Western' },
  family: { ar: 'عائلي', en: 'Family' },
  adventure: { ar: 'مغامرة', en: 'Adventure' },
  animation: { ar: 'رسوم متحركة', en: 'Animation' },
};

/** One poster card for every film rail. Shared by Home, Favorites and Continue. */
const ART_HUES = [232, 268, 292, 318, 344, 24, 62, 148, 172, 198];

export default function FilmCard({
  film, progress, className,
}: { film: PublicFilm; progress?: number; className?: string }) {
  const { lang, t, n } = useI18n();
  const [broken, setBroken] = useState(false);
  const title = lang === 'ar' ? film.titleAr : film.title;
  // Deterministic art direction for films whose poster cannot load: every title
  // gets its own hue so the rail never looks like repeated placeholders.
  let hash = 0;
  for (let index = 0; index < film.id.length; index += 1) hash = (hash * 31 + film.id.charCodeAt(index)) % 360;
  // Curated hues keep generated poster art inside the brand gamut (no muddy greens).
  const artHue = ART_HUES[hash % ART_HUES.length];

  return (
    <Link
      href={`/movies/${film.id}`}
      className={['cp-film-card', className ?? ''].filter(Boolean).join(' ')}
      aria-label={`${title} — ${t('common.details')}`}
    >
      <span className="cp-film-card__art">
        {broken ? (
          <span
            className="cp-film-card__fallback"
            style={{ ['--cp-art-hue' as string]: artHue }}
            aria-hidden="true"
          >
            <span className="cp-film-card__fallback-letter">{title.slice(0, 1)}</span>
            <span className="cp-film-card__fallback-foot">
              <span className="cp-film-card__fallback-title">{title}</span>
              <span className="cp-film-card__fallback-year">{film.year}</span>
            </span>
          </span>
        ) : (
          <Image
            src={filmPoster(film)}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 700px) 46vw, (max-width: 1100px) 24vw, 220px"
            onError={() => setBroken(true)}
          />
        )}
        <span className="cp-film-card__scrim" aria-hidden="true" />
        <span className="cp-film-card__badge cp-num">{film.year}</span>
        <span className="cp-film-card__play" aria-hidden="true"><Icon name="play" size={16} /></span>
        {progress !== undefined && progress > 0 && (
          <span className="cp-film-card__progress" aria-hidden="true">
            <i style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
          </span>
        )}
      </span>
      <span className="cp-film-card__meta">
        <strong>{title}</strong>
        <small>{GENRE[film.genre][lang]} · <span className="cp-num">{n(Number(film.year))}</span></small>
      </span>
    </Link>
  );
}
