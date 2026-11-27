import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://cloudplay_dev:67e7e23d-143f-427b-9a02-68c0f9f21cf8@127.0.0.1:60896/postgres";

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    const sql = await readFile(join(__dirname, '../prisma/migrations/20261127000000_add_refresh_token/migration.sql'), 'utf8');
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();