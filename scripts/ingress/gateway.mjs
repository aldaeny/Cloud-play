// Private mTLS hop. A GeoIP-enabled public edge is the authenticated client.
// Never use this gateway as a public TLS terminator or accept country from browsers.
import https from 'node:https';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
export function createGateway({key,cert,ca,secret,upstream,publicOrigin}) {
  const target=new URL(upstream),origin=new URL(publicOrigin);
  if(secret.length<32||!['http:','https:'].includes(target.protocol)||target.pathname!=='/'||target.username||target.password||target.search||target.hash||origin.protocol!=='https:'||origin.origin!==publicOrigin)throw new Error('INVALID_INGRESS_CONFIGURATION');
  const transport=target.protocol==='https:'?https:http;
  const server=https.createServer({key,cert,ca,requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.2',maxHeaderSize:16384},(req,res)=>{
    if(!req.socket.authorized){res.writeHead(403).end();return;}
    const country=req.headers['x-cloudplay-country'],ip=req.headers['x-cloudplay-client-ip'];
    if(typeof country!=='string'||!/^[A-Z]{2}$/.test(country)||typeof ip!=='string'||!isIP(ip)||ip.includes('%')||!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\')||req.url.length>8192){res.writeHead(403).end();return;}
    const headers={};
    const hop=new Set(['connection','keep-alive','transfer-encoding','te','trailer','upgrade','proxy-authorization','proxy-authenticate',...(req.headers.connection||'').toLowerCase().split(',').map(s=>s.trim())]);
    for(const [name,value] of Object.entries(req.headers)){
      if(!hop.has(name)&&!name.startsWith('x-forwarded-')&&!name.startsWith('x-vercel-')&&!name.startsWith('x-cloudplay-')&&!['forwarded','x-real-ip','x-external-geo','x-api-geo','host'].includes(name))headers[name]=value;
    }
    const issuedAt=Date.now();
    const credentialHash=createHash('sha256').update((headers.authorization||'')+'\0'+(headers.cookie||'')).digest('hex');
    const payload=Buffer.from(JSON.stringify({method:req.method,url:req.url,country,ip,credentialHash,issuedAt,expiresAt:issuedAt+5000,nonce:randomUUID()})).toString('base64url');
    headers['x-cloudplay-edge']=payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
    headers.host=origin.host;
    // These are routing metadata only; Geo is taken exclusively from the envelope.
    headers['x-forwarded-proto']='https';headers['x-forwarded-host']=origin.host;
    const request=transport.request(target,{path:req.url,method:req.method,headers,timeout:30000},response=>{
      const outgoing={...response.headers};delete outgoing['transfer-encoding'];delete outgoing.connection;
      res.writeHead(response.statusCode||502,outgoing);response.pipe(res);
    });
    request.on('timeout',()=>request.destroy());request.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
    req.on('aborted',()=>request.destroy());res.on('close',()=>{if(!res.writableEnded)request.destroy();});req.pipe(request);
  });
  server.headersTimeout=10000;server.requestTimeout=30000;server.keepAliveTimeout=5000;
  return server;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
  const server=createGateway({key:readFileSync(process.env.INGRESS_KEY_FILE),cert:readFileSync(process.env.INGRESS_CERT_FILE),ca:readFileSync(process.env.INGRESS_CLIENT_CA_FILE),secret:process.env.SELFHOST_EDGE_SECRET||'',upstream:process.env.INGRESS_UPSTREAM||'http://web:3001',publicOrigin:process.env.VOD_PUBLIC_ORIGIN||''});
  server.listen(Number(process.env.PORT||8443),'0.0.0.0');
  process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
}
