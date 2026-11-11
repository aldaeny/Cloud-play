import {createServer,get,Server} from 'node:http';
import {drainHttpServer} from './http-drain';
describe('real HTTP drain before database teardown',()=>{
 let server:Server;
 afterEach(()=>server?.closeAllConnections());
 it('waits for all admitted responses; then refuses new connections',async()=>{
  const pending:Array<()=>void>=[];
  server=createServer((_req,res)=>pending.push(()=>res.end('committed')));
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
  const reads=Array.from({length:12},()=>new Promise<string>((resolve,reject)=>get(`http://127.0.0.1:${port}`,r=>{let body='';r.on('data',b=>body+=b);r.on('end',()=>resolve(body));}).on('error',reject)));
  while(pending.length<12)await new Promise(r=>setImmediate(r));
  let closed=false;const closing=drainHttpServer(server,3000).then(()=>{closed=true;});
  await new Promise(r=>setImmediate(r));expect(closed).toBe(false);
  pending.forEach(end=>end());expect(await Promise.all(reads)).toEqual(Array(12).fill('committed'));await closing;expect(closed).toBe(true);
  await expect(new Promise((resolve,reject)=>get(`http://127.0.0.1:${port}`,resolve).on('error',reject))).rejects.toThrow();
 });
 it('reports timeout rather than claiming a forced disconnect was lossless',async()=>{
  let admitted!:()=>void;const ready=new Promise<void>(r=>{admitted=r;});server=createServer(()=>admitted());
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
  const read=new Promise(resolve=>get(`http://127.0.0.1:${port}`,()=>resolve('unexpected')).on('error',()=>resolve('aborted')));
  await ready;await expect(drainHttpServer(server,20)).rejects.toThrow('HTTP_DRAIN_TIMEOUT');expect(await read).toBe('aborted');
 });
 it('permits already-closed server and rejects invalid budgets',async()=>{server=createServer();await drainHttpServer(server);await expect(drainHttpServer(server,0)).rejects.toThrow('INVALID_HTTP_DRAIN_TIMEOUT');});
});
