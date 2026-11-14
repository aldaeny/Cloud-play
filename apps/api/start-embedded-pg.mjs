import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';

const apiDir = 'C:/Users/aldae/Cloud-play/apps/api';
const temp = await mkdtemp(path.join(tmpdir(), 'cloudplay-pg-dev-'));

const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const password = randomUUID();

console.log(`Starting embedded PostgreSQL on port ${port}...`);

const database = new EmbeddedPostgres({
  databaseDir: path.join(temp, 'data'),
  port,
  user: 'cloudplay_dev',
  password,
  persistent: true,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: msg => console.log('[postgres]', msg),
  onError: msg => console.error('[postgres]', msg)
});

await database.initialise();
await database.start();
console.log('PostgreSQL started!');

const pool = new pg.Pool({
  host: '127.0.0.1',
  port,
  user: 'cloudplay_dev',
  password,
  database: 'postgres',
  connectionTimeoutMillis: 2000
});

// Run migrations
console.log('Running migrations...');
const migrationsDir = path.join(apiDir, 'prisma/migrations');
for (const dir of (await readdir(migrationsDir)).sort()) {
  if (dir === 'migration_lock.toml') continue;
  const sql = await readFile(path.join(migrationsDir, dir, 'migration.sql'), 'utf8');
  await pool.query(sql);
}
console.log('Migrations done!');

// Keep running
process.env.DATABASE_URL = `postgresql://cloudplay_dev:${password}@127.0.0.1:${port}/postgres`;
console.log(`DATABASE_URL=${process.env.DATABASE_URL}`);

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await pool.end();
  await database.stop();
  await rm(temp, { recursive: true, force: true });
  process.exit(0);
});

console.log('Press Ctrl+C to stop');
