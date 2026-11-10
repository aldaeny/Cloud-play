// Actual PostgreSQL policy tests; auth schema/roles are fixtures, not hosted Auth.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function testRls(pool, root, check) {
  await pool.query(`CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    CREATE ROLE authenticated NOLOGIN NOBYPASSRLS; CREATE ROLE anon NOLOGIN NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;`);
  await pool.query(await readFile(path.join(root, 'supabase/migrations/20261105000000_cloudplay_free_account_sync.sql'), 'utf8'));
  await pool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON cloudplay_favorites, cloudplay_progress TO authenticated, anon');
  const owner = randomUUID(), stranger = randomUUID();
  await pool.query('INSERT INTO auth.users VALUES ($1), ($2)', [owner, stranger]);
  async function asRole(role, id, fn) {
    assert.ok(['authenticated', 'anon'].includes(role));
    const conn = await pool.connect();
    try {
      await conn.query('BEGIN');
      await conn.query(`SET LOCAL ROLE ${role}`);
      await conn.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [id]);
      const result = await fn(conn);
      await conn.query('COMMIT'); return result;
    } catch (error) { await conn.query('ROLLBACK'); throw error; }
    finally { conn.release(); }
  }
  const tables = ['cloudplay_favorites', 'cloudplay_progress'];
  await check('real RLS: owners insert/select/update their favorites and progress', async () => {
    await asRole('authenticated', owner, async conn => {
      await conn.query("INSERT INTO cloudplay_favorites (user_id,item_type,item_id) VALUES ($1,'movie','fixture')", [owner]);
      await conn.query("INSERT INTO cloudplay_progress (user_id,item_id,position_sec,duration_sec) VALUES ($1,'fixture',1,10)", [owner]);
      for (const table of tables) assert.equal((await conn.query(`SELECT * FROM ${table}`)).rowCount, 1);
      assert.equal((await conn.query('UPDATE cloudplay_progress SET position_sec = 2')).rowCount, 1);
      assert.equal((await conn.query("UPDATE cloudplay_favorites SET item_id = 'updated'")).rowCount, 1);
    });
  });
  await check('real RLS: cross-user select/update/delete/insert and owner transfer denied', async () => {
    await asRole('authenticated', stranger, async conn => {
      for (const table of tables) {
        assert.equal((await conn.query(`SELECT * FROM ${table}`)).rowCount, 0);
        assert.equal((await conn.query(`UPDATE ${table} SET item_id = 'stolen'`)).rowCount, 0);
        assert.equal((await conn.query(`DELETE FROM ${table}`)).rowCount, 0);
      }
    });
    for (const sql of [
      "INSERT INTO cloudplay_favorites (user_id,item_type,item_id) VALUES ($1,'movie','forged')",
      "INSERT INTO cloudplay_progress (user_id,item_id,position_sec,duration_sec) VALUES ($1,'forged',1,10)",
    ]) await assert.rejects(asRole('authenticated', stranger, conn => conn.query(sql, [owner])), { code: '42501' });
    for (const table of tables) {
      await assert.rejects(asRole('authenticated', owner, conn => conn.query(`UPDATE ${table} SET user_id = $1`, [stranger])), { code: '42501' });
    }
  });
  await check('real RLS: anonymous denied; owner deletes their rows', async () => {
    await asRole('anon', '', async conn => {
      for (const table of tables) assert.equal((await conn.query(`SELECT * FROM ${table}`)).rowCount, 0);
    });
    await assert.rejects(asRole('anon', '', conn => conn.query("INSERT INTO cloudplay_favorites VALUES ($1,'movie','anon',now())", [owner])), { code: '42501' });
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(asRole(role, owner, conn => conn.query('SELECT * FROM "XtreamCatalogSnapshot"')), { code: '42501' });
    }
    await asRole('authenticated', owner, async conn => {
      for (const table of tables) assert.equal((await conn.query(`DELETE FROM ${table}`)).rowCount, 1);
    });
  });
  await check('all application tables: browser roles denied SELECT INSERT UPDATE DELETE', async () => {
    const result = await pool.query(`SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE 'cloudplay_%' ORDER BY tablename`);
    assert.equal(result.rows.length, 35, 'all33 models plus two implicit relationship tables inventoried');
    let assertions = 0;
    for (const { tablename } of result.rows) {
      const table = '"' + tablename.replaceAll('"', '""') + '"';
      const columns = await pool.query(`SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position LIMIT 1`, [tablename]);
      const column = '"' + columns.rows[0].column_name.replaceAll('"', '""') + '"';
      for (const role of ['anon', 'authenticated']) {
        for (const sql of [`SELECT * FROM ${table}`, `INSERT INTO ${table} DEFAULT VALUES`,
          `UPDATE ${table} SET ${column}=${column} WHERE false`, `DELETE FROM ${table} WHERE false`]) {
          await assert.rejects(asRole(role, stranger, conn => conn.query(sql)), { code: '42501' });
          assertions++;
        }
      }
    }
    console.log(`  ${assertions} real SQL denials across35 backend tables; browser roles have no table privileges`);
  });

}
