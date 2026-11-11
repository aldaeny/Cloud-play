// CI-only real PostgreSQL custom archive -> separate database restore.
// No connection URL input, production environment, archive or row data exported.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import pg from 'pg';
const target='cloudplay_restore_fixture';
const docker=(args)=>execFileSync('docker',args,{timeout:120000,stdio:['ignore','pipe','pipe']});
let source,restored;
try{
 assert.equal(docker(['inspect','--format','{{.Config.Image}}','auth-db']).toString().trim(),'postgres:17');
 // Freeze disposable Auth only, never production. Fixture application has exited.
 docker(['stop','auth']);
 source=new pg.Pool({host:'127.0.0.1',port:5439,user:'postgres',password:'isolated-fixture-only',database:'postgres',max:1,connectionTimeoutMillis:3000});
 assert.match((await source.query('SHOW server_version')).rows[0].server_version,/^17\./);
 assert.equal((await source.query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n>0,true);
 await source.query(`CREATE DATABASE ${target}`);
 docker(['exec','auth-db','pg_dump','-U','postgres','-d','postgres','--format=custom','--no-owner','--file=/tmp/cloudplay-fixture.dump']);
 assert.ok(docker(['exec','auth-db','pg_restore','--list','/tmp/cloudplay-fixture.dump']).toString().includes('TABLE DATA'));
 docker(['exec','auth-db','pg_restore','-U','postgres','--dbname='+target,'--no-owner','--exit-on-error','--single-transaction','/tmp/cloudplay-fixture.dump']);
 restored=new pg.Pool({host:'127.0.0.1',port:5439,user:'postgres',password:'isolated-fixture-only',database:target,max:1,connectionTimeoutMillis:3000});
 const snapshot=async pool=>{
  const tables=(await pool.query(`SELECT schemaname,tablename,rowsecurity FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY schemaname,tablename`)).rows;
  const hash=createHash('sha256');let rows=0;
  for(const table of tables){
   const quote=s=>'"'+s.replaceAll('"','""')+'"';
   const data=(await pool.query(`SELECT row_to_json(t)::text AS value FROM ${quote(table.schemaname)}.${quote(table.tablename)} t ORDER BY row_to_json(t)::text`)).rows;
   rows+=data.length;hash.update(JSON.stringify([table,data]));
  }
  for(const query of [
   `SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','auth') ORDER BY 1,2,3`,
   `SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','auth') ORDER BY 1,2,3`,
   `SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges WHERE table_schema IN ('public','auth') ORDER BY 1,2,3,4`,
   `SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') ORDER BY 1,2,3`
  ])hash.update(JSON.stringify((await pool.query(query)).rows));
  return {tables:tables.length,rows,sha256:hash.digest('hex')};
 };
 const before=await snapshot(source),after=await snapshot(restored);assert.deepEqual(after,before);
 // Prove restored constraints execute, not merely names present.
 await assert.rejects(restored.query(`INSERT INTO "Profile"(id,"userId",name) VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','invalid fixture')`),e=>e.code==='23503');
 const result={status:'VERIFIED',scope:'disposable PostgreSQL17 custom archive to separate database on same isolated cluster; NOT managed Supabase/PITR',snapshot:before,checks:['custom archive readable','single transaction restore','all public/auth table row hashes equal','indexes constraints RLS policies grants equal','restored foreign key enforced'],production_accessed:false,archive_retained:false};
 await writeFile('logical-restore-evidence.json',JSON.stringify(result,null,2)+'\n');
 console.log('::notice title=Logical restore assertions::'+JSON.stringify(result));
} catch { console.error('ISOLATED_LOGICAL_RESTORE_FAILED (details suppressed to protect fixture Auth data)');process.exitCode=1;
} finally {
 await restored?.end();
 if(source){await source.query(`DROP DATABASE IF EXISTS ${target} WITH (FORCE)`);await source.end();}
 docker(['exec','auth-db','rm','-f','/tmp/cloudplay-fixture.dump']);
}
