import type {Server} from 'node:http';
const active=new WeakMap<Server,{count:number}>();
export function trackHttpServer(server:Server):()=>number{
 const existing=active.get(server);if(existing)return ()=>existing.count;
 const state={count:0};active.set(server,state);
 server.prependListener('request',(_req,res)=>{
  state.count++;let finished=false;const done=()=>{if(!finished){finished=true;state.count--;}};
  res.once('finish',done);res.once('close',done);
 });return ()=>state.count;
}
/** Stop admission first, preserve active responses, then permit DB teardown.
 * A deadline failure is an explicit failed shutdown, never a false exit0. */
export async function drainHttpServer(server:Server,timeoutMs=30000):Promise<void>{
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('INVALID_HTTP_DRAIN_TIMEOUT');
 if(!server.listening)return;
 await new Promise<void>((resolve,reject)=>{
  const idle=setInterval(()=>server.closeIdleConnections(),25);
  const timer=setTimeout(()=>{clearInterval(idle);server.closeAllConnections();reject(new Error('HTTP_DRAIN_TIMEOUT'));},timeoutMs);
  server.close(error=>{clearTimeout(timer);clearInterval(idle);if(error)reject(error);else resolve();});
  // Node22+ closes idle keep-alive connections, not active responses.
  server.closeIdleConnections();
 });
}
