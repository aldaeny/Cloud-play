// Compatibility smoke tests for the pinned transitive dependency overrides.
// Not a substitute for a security audit or exhaustive framework testing.
const { createRequire } = require('module');
const nestRequire = createRequire(require.resolve('@nestjs/platform-express/package.json'));
const express = nestRequire('express');
const multer = nestRequire('multer');
const { FileTypeValidator } = require('@nestjs/common');
const assert = require('assert/strict');

(async () => {
  const validator = new FileTypeValidator({fileType: /image\/png/});
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  assert.equal(await validator.isValid({mimetype:'image/png',buffer:png}), true);
  assert.equal(await validator.isValid({mimetype:'image/png',buffer:Buffer.from('not a PNG')}), false);
  console.log('PASS overridden file-type validates PNG magic bytes');
  const app = express();
  app.use(nestRequire('body-parser').json({limit:'1kb'}));
  app.post('/json', (req,res)=>res.json(req.body));
  app.post('/multipart', multer({storage:multer.memoryStorage()}).single('file'), (req,res)=>res.json({field:req.body.field,file:req.file.buffer.toString()}));
  const server = await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    let r=await fetch(base+'/json',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ok:true})});
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
    const form=new FormData();form.set('field','test');form.set('file',new Blob(['bytes'],{type:'text/plain'}),'test.txt');
    r=await fetch(base+'/multipart',{method:'POST',body:form});
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{field:'test',file:'bytes'});
    console.log('PASS overridden body-parser and multer handle JSON and multipart locally');
  } finally { await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
})().catch(error=>{console.error(error);process.exitCode=1});
