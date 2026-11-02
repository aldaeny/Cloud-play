// Deterministic unit smoke test: no real provider or credentials.
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../apps/web/src/server/firebase-public.ts');
function fresh() {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = new Module(file, module); m.filename = file; m.paths = module.paths; m._compile(js, file); return m.exports;
}
async function main() {
  let {publicHls, getPublicChannels} = fresh();
  const good = 'https://partneta.cdn.mgmlcdn.com/test/channel.m3u8';
  assert.equal(publicHls(good),good);
  for (const value of [null, '', 'http://partneta.cdn.mgmlcdn.com/test.m3u8', 'https://evil.example/test.m3u8', 'https://partneta.cdn.mgmlcdn.com.evil.example/test.m3u8', 'https://user:password@partneta.cdn.mgmlcdn.com/test.m3u8', good+'?token=example',good+'#frag','https://partneta.cdn.mgmlcdn.com:444/test.m3u8','https://partneta.cdn.mgmlcdn.com/test.mpd']) assert.equal(publicHls(value),undefined);
  console.log('PASS URL host, protocol, port, query, credentials and format filtering');
  const original=global.fetch;let calls=0;
  try {
    global.fetch=async (_url, options)=>{calls++;assert.equal(options.redirect,'error');return new Response(JSON.stringify([{id:'a',name:'One',streamUrl:good,secret:'fake-secret'}, {id:'b',name:'Two',streamUrl:good+'?token=fake-secret'}]),{status:200,headers:{'Content-Type':'application/json'}})};
    const a=await getPublicChannels(), b=await getPublicChannels(); assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.length,2);assert.equal(a[0].playable,true);assert.equal(a[1].playable,false);assert(!('streamUrl' in a[1]));assert(!JSON.stringify(a).includes('fake-secret'));console.log('PASS sanitized catalog and in-memory cache');
    ({getPublicChannels}=fresh());global.fetch=async()=>new Response('{}',{headers:{'Content-Length':String(2*1024*1024)}});await assert.rejects(getPublicChannels);console.log('PASS oversized response rejected');
    ({getPublicChannels}=fresh());global.fetch=async()=>{throw new Error('simulated redirect')};await assert.rejects(getPublicChannels);console.log('PASS fetch failures closed');
  } finally {global.fetch=original}
}
main().catch(e=>{console.error(e);process.exitCode=1});
