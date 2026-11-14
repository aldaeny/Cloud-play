import { config } from 'dotenv';
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get default tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000000' }
  });

  if (!tenant) {
    console.log('Default tenant not found!');
    return;
  }

  console.log('Adding test content...');

  // Add test movies
  const movies = [
    {
      tenantId: tenant.id,
      kind: 'MOVIE',
      state: 'PUBLISHED',
      titleAr: 'The Great Adventure',
      titleEn: 'The Great Adventure',
      synopsisAr: 'A young explorer discovers ancient secrets.',
      synopsisEn: 'A young explorer discovers ancient secrets.',
      releaseYear: 2023,
      runtimeSec: 7200,
      maturityRating: 'PG-13',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/movie1/300/450',
      backdropUrl: 'https://picsum.photos/seed/movie1-bg/1920/1080',
      genres: ['Adventure', 'Action'],
      keywords: ['epic', 'journey'],
    },
    {
      tenantId: tenant.id,
      kind: 'MOVIE',
      state: 'PUBLISHED',
      titleAr: 'Space Odyssey 2024',
      titleEn: 'Space Odyssey 2024',
      synopsisAr: 'Humanity first journey to Mars.',
      synopsisEn: 'Humanity first journey to Mars.',
      releaseYear: 2024,
      runtimeSec: 8100,
      maturityRating: 'PG-13',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/movie2/300/450',
      backdropUrl: 'https://picsum.photos/seed/movie2-bg/1920/1080',
      genres: ['Sci-Fi', 'Thriller'],
      keywords: ['space', 'mars', 'future'],
    },
    {
      tenantId: tenant.id,
      kind: 'MOVIE',
      state: 'PUBLISHED',
      titleAr: 'The Last Library',
      titleEn: 'The Last Library',
      synopsisAr: 'In a world without books, one library remains.',
      synopsisEn: 'In a world without books, one library remains.',
      releaseYear: 2022,
      runtimeSec: 5700,
      maturityRating: 'PG',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/movie3/300/450',
      backdropUrl: 'https://picsum.photos/seed/movie3-bg/1920/1080',
      genres: ['Drama', 'Mystery'],
      keywords: ['books', 'knowledge', 'post-apocalyptic'],
    },
    {
      tenantId: tenant.id,
      kind: 'MOVIE',
      state: 'PUBLISHED',
      titleAr: 'Arabian Nights Tale',
      titleEn: 'Arabian Nights Tale',
      synopsisAr: 'Magical tales from Arab heritage.',
      synopsisEn: 'Magical tales from Arab heritage.',
      releaseYear: 2023,
      runtimeSec: 6600,
      maturityRating: 'PG',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/movie4/300/450',
      backdropUrl: 'https://picsum.photos/seed/movie4-bg/1920/1080',
      genres: ['Fantasy', 'Family'],
      keywords: ['arabic', 'folklore', 'magic'],
    },
    {
      tenantId: tenant.id,
      kind: 'MOVIE',
      state: 'PUBLISHED',
      titleAr: 'Desert Rose',
      titleEn: 'Desert Rose',
      synopsisAr: 'A story of love and resilience in the desert.',
      synopsisEn: 'A story of love and resilience in the desert.',
      releaseYear: 2024,
      runtimeSec: 6300,
      maturityRating: 'PG-13',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/movie5/300/450',
      backdropUrl: 'https://picsum.photos/seed/movie5-bg/1920/1080',
      genres: ['Drama', 'Romance'],
      keywords: ['desert', 'romance'],
    },
  ];

  const createdMovies = [];
  for (const movie of movies) {
    const created = await prisma.title.create({
      data: movie,
    });
    createdMovies.push(created);
    console.log(`Added movie: ${movie.titleEn}`);
  }

  // Add test series
  const series = await prisma.title.create({
    data: {
      tenantId: tenant.id,
      kind: 'SERIES',
      state: 'PUBLISHED',
      titleAr: 'Mystery Files',
      titleEn: 'Mystery Files',
      synopsisAr: 'Detectives uncover secrets in a small town.',
      synopsisEn: 'Detectives uncover secrets in a small town.',
      releaseYear: 2023,
      maturityRating: 'TV-14',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/series1/300/450',
      backdropUrl: 'https://picsum.photos/seed/series1-bg/1920/1080',
      genres: ['Mystery', 'Crime'],
      keywords: ['detective', 'mystery', 'investigation'],
    },
  });
  console.log(`Added series: ${series.titleEn}`);

  // Add seasons and episodes
  const season1 = await prisma.season.create({
    data: {
      titleId: series.id,
      number: 1,
    },
  });

  const episodes = [
    {
      seasonId: season1.id,
      titleId: series.id,
      number: 1,
      titleAr: 'The First Clue',
      titleEn: 'The First Clue',
      runtimeSec: 2700,
      state: 'PUBLISHED',
    },
    {
      seasonId: season1.id,
      titleId: series.id,
      number: 2,
      titleAr: 'Hidden Secrets',
      titleEn: 'Hidden Secrets',
      runtimeSec: 2880,
      state: 'PUBLISHED',
    },
    {
      seasonId: season1.id,
      titleId: series.id,
      number: 3,
      titleAr: 'The Truth Revealed',
      titleEn: 'The Truth Revealed',
      runtimeSec: 3120,
      state: 'PUBLISHED',
    },
  ];

  for (const ep of episodes) {
    const created = await prisma.episode.create({
      data: ep,
    });
    console.log(`Added episode: ${ep.titleEn} (${created.id})`);
  }

  // Add second series
  const arabicSeries = await prisma.title.create({
    data: {
      tenantId: tenant.id,
      kind: 'SERIES',
      state: 'PUBLISHED',
      titleAr: 'Days of Beautiful Times',
      titleEn: 'Days of Beautiful Times',
      synopsisAr: 'Family stories from the good old days.',
      synopsisEn: 'Family stories from the good old days.',
      releaseYear: 2024,
      maturityRating: 'TV-PG',
      originalLanguage: 'en',
      posterUrl: 'https://picsum.photos/seed/arseries/300/450',
      backdropUrl: 'https://picsum.photos/seed/arseries-bg/1920/1080',
      genres: ['Drama', 'Family'],
      keywords: ['family', 'nostalgia'],
    },
  });
  console.log(`Added series: ${arabicSeries.titleEn}`);

  const arSeason = await prisma.season.create({
    data: {
      titleId: arabicSeries.id,
      number: 1,
    },
  });

  const arEpisodes = [
    {
      seasonId: arSeason.id,
      titleId: arabicSeries.id,
      number: 1,
      titleAr: 'Episode 1',
      titleEn: 'Episode 1',
      runtimeSec: 2400,
      state: 'PUBLISHED',
    },
    {
      seasonId: arSeason.id,
      titleId: arabicSeries.id,
      number: 2,
      titleAr: 'Episode 2',
      titleEn: 'Episode 2',
      runtimeSec: 2520,
      state: 'PUBLISHED',
    },
  ];

  for (const ep of arEpisodes) {
    const created = await prisma.episode.create({
      data: ep,
    });
    console.log(`Added episode: ${ep.titleEn} (${created.id})`);
  }

  // Add home rows for the homepage
  const movieTitles = await prisma.title.findMany({
    where: { tenantId: tenant.id, kind: 'MOVIE', state: 'PUBLISHED' },
    take: 5,
  });

  const seriesTitles = await prisma.title.findMany({
    where: { tenantId: tenant.id, kind: 'SERIES', state: 'PUBLISHED' },
    take: 2,
  });

  // Create home rows (let Prisma generate UUIDs)
  const continueRow = await prisma.homeRow.create({
    data: {
      tenantId: tenant.id,
      name: 'Continue Watching',
      order: 0,
    },
  });

  const moviesRow = await prisma.homeRow.create({
    data: {
      tenantId: tenant.id,
      name: 'Suggested Movies',
      order: 1,
    },
  });

  const seriesRow = await prisma.homeRow.create({
    data: {
      tenantId: tenant.id,
      name: 'Suggested Series',
      order: 2,
    },
  });

  // Add row items
  for (let i = 0; i < movieTitles.length; i++) {
    await prisma.homeRowItem.create({
      data: {
        homeRowId: moviesRow.id,
        titleId: movieTitles[i].id,
        order: i,
      },
    });
  }

  for (let i = 0; i < seriesTitles.length; i++) {
    await prisma.homeRowItem.create({
      data: {
        homeRowId: seriesRow.id,
        titleId: seriesTitles[i].id,
        order: i,
      },
    });
  }

  console.log('Added home rows');

  console.log('\nAll test content added successfully!');
  console.log(`   Movies: ${movies.length}`);
  console.log(`   Series: 2`);
  console.log(`   Episodes: ${episodes.length + arEpisodes.length}`);
  console.log(`   Home rows: 3`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });