const assert=require('node:assert/strict');const fs=require('node:fs');const Module=require('node:module');const ts=require('typescript');
function load(file,deps={}){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=name=>name in deps?deps[name]:require(name);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports;}
const root='apps/web/';const live=load(root+'src/server/protected-live.ts');
assert.equal(live.protectedLiveUrl('a/b'),'/api/external/a%2Fb/manifest');
assert.throws(()=>live.backendChannel('legacy'));assert.throws(()=>live.backendChannel('../x'));
process.env.EXTERNAL_CHANNEL_BINDINGS=JSON.stringify({legacy:'12345678-1234-1234-1234-123456789abc'});
assert.equal(live.backendChannel('legacy'),'12345678-1234-1234-1234-123456789abc');
assert.deepEqual(live.protectLiveRows([{id:'a',url:'https://secret',name:'Keep'}]),[{id:'a',url:'/api/external/a/manifest',name:'Keep'}]);
const handler=load(root+'pages/api/external/session.ts').default;
function response(){return {headers:{},code:0,setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},end(){return this}}}
for(const [req,code] of [[{method:'GET',headers:{}},405],[{method:'POST',headers:{origin:'https://evil',host:'good'}},403],[{method:'POST',headers:{origin:'https://good',host:'good'}},401]]){const res=response();handler(req,res);assert.equal(res.code,code)}
const res=response();handler({method:'POST',headers:{origin:'https://good',host:'good',authorization:'Bearer '+'a'.repeat(30)}},res);assert.equal(res.code,204);assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
const bridge=load(root+'pages/api/external/[id]/[action].ts',{'../../../../src/server/protected-live':live,'../../../../src/server/rate-limit':{enforceRateLimit:()=>true}}).default;
(async()=>{const res=response();res.json=()=>res;await bridge({method:'GET',headers:{},cookies:{},query:{id:'legacy',action:'manifest'}},res);assert.equal(res.code,401);console.log('PASS protected Live metadata, channel binding, cookie method/origin/auth gates, cookie attributes and media deny gate (9 groups). Not E2E or real Auth evidence.');})().catch(e=>{console.error(e);process.exitCode=1});
