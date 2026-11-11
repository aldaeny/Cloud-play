// Browser lifecycle unit contracts. Real GoTrue/browser evidence is separate.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=(fs.existsSync('apps/web')?'apps/web/':'')+'src/lib/media-session.ts';
const original={fetch:global.fetch,window:global.window,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
let passed=0;
function fixture(){
 const calls=[],timers=new Map();let next=0,event,failPut=false;const session={access_token:'original.fixture.access'};
 global.window=new EventTarget();global.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id};global.clearTimeout=id=>timers.delete(id);
 global.fetch=async(_url,options)=>{calls.push(options);return {ok:!(options.method==='PUT'&&failPut),status:403};};
 const auth={auth:{
  getSession:async()=>({data:{session},error:null}),
  onAuthStateChange:fn=>{event=fn;return {data:{subscription:{unsubscribe(){event=undefined;}}}};}
 }};
 const m=new Module(file,module);m.paths=module.paths;m.require=name=>name==='./supabase'?{getSupabase:()=>auth}:require(name);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
 return {api:m.exports,calls,timers,session,set failPut(value){failPut=value},event:name=>event?.(name),run(ms){const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,'scheduled timer '+ms);timers.delete(entry[0]);entry[1].fn();}};
}
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
const src='/api/external/a/manifest';
(async()=>{try{
 await check('non-protected media does not create a session',async()=>{const f=fixture();await f.api.prepareMediaSession('/movie.mp4');assert.equal(f.calls.length,0)});
 await check('simultaneous attaches serialize to one create and one renewal',async()=>{const f=fixture();await Promise.all([f.api.prepareMediaSession(src),f.api.prepareMediaSession(src)]);assert.deepEqual(f.calls.map(c=>c.method),['POST','PUT']);await f.api.releaseMediaSession();});
 await check('channel switch releases previous lease before creating new lease',async()=>{const f=fixture();await f.api.prepareMediaSession(src);await f.api.prepareMediaSession('/api/external/b/manifest');assert.deepEqual(f.calls.map(c=>c.method),['POST','DELETE','POST']);await f.api.releaseMediaSession();});
 await check('expired renewal clears local state; next explicit attach can create',async()=>{const f=fixture();await f.api.prepareMediaSession(src);f.failPut=true;await assert.rejects(f.api.prepareMediaSession(src),/MEDIA_SESSION_403/);assert.deepEqual(f.calls.map(c=>c.method),['POST','PUT','DELETE']);f.failPut=false;await f.api.prepareMediaSession(src);assert.equal(f.calls.at(-1).method,'POST');await f.api.releaseMediaSession();});
 await check('periodic renewal is scheduled at 45 seconds',async()=>{const f=fixture();await f.api.prepareMediaSession(src);f.run(45000);await f.api.releaseMediaSession();assert.deepEqual(f.calls.map(c=>c.method),['POST','PUT','DELETE']);});
 await check('auth refresh forwards only access token; logout releases lease',async()=>{const f=fixture();await f.api.prepareMediaSession(src);f.session.access_token='rotated.fixture.access';f.event('TOKEN_REFRESHED');f.run(0);await f.api.prepareMediaSession(src);assert.equal(f.calls[1].headers.Authorization,'Bearer rotated.fixture.access');assert.ok(f.calls.every(c=>!c.body.includes('refresh_token')));f.event('SIGNED_OUT');f.run(0);await f.api.releaseMediaSession();assert.equal(f.calls.at(-1).method,'DELETE');});
 await check('obsolete unmount cannot release the new channel',async()=>{const f=fixture();await f.api.prepareMediaSession('/api/external/b/manifest');await f.api.releaseMediaSession(src);assert.equal(f.calls.length,1);await f.api.releaseMediaSession();});
 console.log(`MEDIA SESSION CONTRACTS: ${passed} checks passed (unit fixtures, not Auth E2E).`);
}finally{Object.assign(global,original)}})().catch(error=>{console.error(error);process.exitCode=1});
