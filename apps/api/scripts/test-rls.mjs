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
    assert.equal(result.rows.length, 48, 'all46 models plus two implicit relationship tables inventoried');
    let assertions = 0;
    for (const { tablename, rowsecurity } of result.rows) {
      assert.equal(rowsecurity, true, `${tablename} must enable RLS`);
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
    console.log(`  ${assertions} real SQL denials across48 backend tables; browser roles have no table privileges`);
  });

  await check('all backend tables: default-deny RLS survives accidental browser CRUD grants', async () => {
    const tables = (await pool.query(`SELECT t.tablename, (SELECT a.attname FROM pg_attribute a
      WHERE a.attrelid = format('%I.%I',t.schemaname,t.tablename)::regclass
      AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum LIMIT 1) AS first_column
      FROM pg_tables t WHERE t.schemaname='public'
      AND t.tablename NOT LIKE 'cloudplay_%' ORDER BY t.tablename`)).rows;
    const conn = await pool.connect();
    try {
      await conn.query('BEGIN');
      // Owned fixture data makes SELECT denial meaningful, not an empty-table pass.
      const tenant = randomUUID();
      await conn.query('INSERT INTO "Tenant" (id) VALUES ($1)', [tenant]);
      for (const { tablename } of tables) {
        const name = '"' + tablename.replaceAll('"', '""') + '"';
        await conn.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${name} TO anon,authenticated`);
      }
      for (const role of ['anon','authenticated']) {
        await conn.query(`SET LOCAL ROLE ${role}`);
        await conn.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [stranger]);
        for (const { tablename, first_column } of tables) {
          const name = '"' + tablename.replaceAll('"', '""') + '"';
          assert.equal((await conn.query(`SELECT * FROM ${name}`)).rowCount, 0);
          assert.equal((await conn.query(`DELETE FROM ${name}`)).rowCount, 0);
          const column = '"' + first_column.replaceAll('"', '""') + '"';
          assert.equal((await conn.query(`UPDATE ${name} SET ${column}=${column}`)).rowCount, 0);
          // A harmless self-assignment still must not see any rows.
          await conn.query('SAVEPOINT denied_insert');
          await assert.rejects(conn.query(`INSERT INTO ${name} DEFAULT VALUES`), { code: '42501' });
          await conn.query('ROLLBACK TO SAVEPOINT denied_insert');
        }
        await conn.query('RESET ROLE');
      }
      assert.equal((await conn.query('SELECT * FROM "Tenant" WHERE id=$1', [tenant])).rowCount, 1,
        'backend owner retains access; never browser-role context');
    } finally { await conn.query('ROLLBACK'); conn.release(); }
  });

  await check('backend RLS migration isolated rollback and reapply restores all flags', async () => {
    const migration = path.join(root, 'apps/api/prisma/migrations/20261110010000_backend_rls_default_deny');
    await pool.query(await readFile(path.join(migration, 'rollback.sql'), 'utf8'));
    const flags = await pool.query(`SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public'
      AND tablename NOT LIKE 'cloudplay_%'`);
    for (const row of flags.rows) assert.equal(row.rowsecurity, ['XtreamCatalogSnapshot','ExternalServer','ContentLicense','LicenseReview','LicenseDocument','ProviderGroup','ExternalChannel','ChannelSource','ExternalFailoverEvent','ExternalReportSchedule','ExternalReportDelivery','ServerSchedule','ServerHealthCheck','ServerAuditLog'].includes(row.tablename));
    await pool.query(await readFile(path.join(migration, 'migration.sql'), 'utf8'));
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'
      AND tablename NOT LIKE 'cloudplay_%' AND rowsecurity`)).rows[0].n, 48);
  });

}
