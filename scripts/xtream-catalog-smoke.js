// Local integration smoke test; uses fake credentials and a fake Xtream server only.
const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');
const fakeUser = 'FAKE_USER_8391';
const fakePass = 'FAKE_PASSWORD_8391';
let mode = 'normal'; let requests = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost'); requests++;
  assert.equal(url.pathname, '/player_api.php');
  assert.equal(url.searchParams.get('username'), fakeUser);
  assert.equal(url.searchParams.get('password'), fakePass);
  if (mode === 'blocked') { res.writeHead(403); return res.end('blocked'); }
  if (mode === 'redirect') { res.writeHead(302, {Location:'http://127.0.0.1:1/'}); return res.end(); }
  if (mode === 'oversize') { res.writeHead(200, {'Content-Type':'application/json', 'Content-Length':String(3*1024*1024)}); return res.end('{}'); }
  res.setHeader('Content-Type', 'application/json');
  if (url.searchParams.get('action') === 'get_live_categories') return res.end(JSON.stringify([{category_id:'8',category_name:'Sports', secret:fakePass},{category_id:'9',category_name:`News ${fakeUser}`} ]));
  if (url.searchParams.get('action') === 'get_live_streams' && url.searchParams.get('category_id') === '8') return res.end(JSON.stringify([{stream_id:123,name:'Sample Channel',stream_icon:`http://example/${fakePass}`,stream_url:`http://${fakeUser}:${fakePass}@example/`}]));
  res.writeHead(400); return res.end('{}');
});
const sleep = ms => new Promise(r => setTimeout(r,ms));
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const mockBase=`http://127.0.0.1:${server.address().port}`;
  const baseEnv={...process.env,XTREAM_CATALOG_ENABLED:'true',XTREAM_BASE_URL:mockBase,XTREAM_ALLOW_HTTP:'true',XTREAM_USERNAME:fakeUser,XTREAM_PASSWORD:fakePass};
  let port=3110;
  async function run(env,test){
    const p=port++;
    const proc=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p',String(p),'--hostname','127.0.0.1'],{cwd:path.join(__dirname,'../apps/web'),env:{...baseEnv,...env},stdio:'ignore'});
    try {
      let ready=false;
      for(let i=0;i<90;i++){if(proc.exitCode!==null)throw new Error('Next exited early');try{await fetch(`http://127.0.0.1:${p}/`);ready=true;break}catch{await sleep(100)}}
      if(!ready) throw new Error('Next failed to start');
      await test(`http://127.0.0.1:${p}`);
    } finally {proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(2000)]);if(proc.exitCode===null)proc.kill('SIGKILL');}
  }
  async function read(url,opts){const response=await fetch(url,opts);return {status:response.status,headers:response.headers,body:await response.json()}}
  // The public API is intentionally blocked regardless of local Xtream settings.
  // Adapter tests below call the retained module directly using this fake server only.
  const fs=require('fs');const Module=require('module');const ts=require('typescript');
  const file=path.join(__dirname,'../apps/web/src/server/xtream.ts');
  function fresh(){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(code,file);return m.exports;}
  Object.assign(process.env,baseEnv);
  async function errorCode(p,code){await assert.rejects(p,e=>e.code===code)}
  try {
    await run({},async b=>{for(const route of ['categories','channels']){const r=await read(`${b}/api/iptv/${route}`);assert.equal(r.status,503);assert.equal(r.body.error,'SOURCE_NOT_APPROVED');}const post=await read(`${b}/api/iptv/categories`,{method:'POST'});assert.equal(post.status,405);assert.equal(requests,0);console.log('PASS legacy API blocked, including configured provider');});
    process.env.XTREAM_CATALOG_ENABLED='false';await errorCode(fresh().categories(),'DISABLED');process.env.XTREAM_CATALOG_ENABLED='true';
    process.env.XTREAM_ALLOW_HTTP='false';await errorCode(fresh().categories(),'HTTP_DISABLED');process.env.XTREAM_ALLOW_HTTP='true';
    process.env.XTREAM_USERNAME='';await errorCode(fresh().categories(),'NOT_CONFIGURED');process.env.XTREAM_USERNAME=fakeUser;
    const adapter=fresh();const groups=await adapter.categories();assert.deepEqual(groups.map(x=>x.id),['8','9']);const stream=await adapter.channels('8');assert.deepEqual(stream,[{id:'123',name:'Sample Channel'}]);
    assert(!JSON.stringify(groups).includes(fakeUser));assert(!JSON.stringify(groups).includes(fakePass));assert(!JSON.stringify(stream).includes(fakePass));assert(!JSON.stringify(stream).includes('http'));await errorCode(adapter.channels('99'),'INVALID_CATEGORY');await errorCode(adapter.channels('abc'),'INVALID_CATEGORY');assert.equal(requests,2);console.log('PASS adapter sanitization, whitelist, cache and opt-ins');
    mode='blocked';await errorCode(fresh().categories(),'UPSTREAM_BLOCKED');mode='redirect';await errorCode(fresh().categories(),'UPSTREAM_ERROR');mode='oversize';await errorCode(fresh().categories(),'UPSTREAM_ERROR');console.log('PASS adapter rejects blocked, redirect and oversized upstream');
  } finally { server.close(); }
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1});
