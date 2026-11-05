import type { GetStaticPaths, GetStaticProps } from 'next';
import SectionLayout from '../../src/components/layout/SectionLayout';
import OpenMovies from '../../src/components/movies/OpenMovies';
import { PUBLIC_FILMS } from '../../src/server/public-films';

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: PUBLIC_FILMS.map(film => ({ params: { id: film.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async context => ({ props: { id: context.params?.id } });

export default function MovieDetails({ id }: { id: string }) {
  const film = PUBLIC_FILMS.find(item => item.id === id);
  if (!film) return null;
  return (
    <SectionLayout title={{ ar: film.titleAr, en: film.title }}>
      {language => <OpenMovies language={language} onlyId={id} />}
    </SectionLayout>
  );
}
