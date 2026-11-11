// Local Supabase Auth configuration. Does not alter trust stores or print secrets.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnvironment } from './policy.mjs';
import { randomBytes, createHmac } from 'node:crypto';
if(existsSync('.env')||existsSync('.selfhost/tls'))throw new Error('Existing configuration left unchanged');
execFileSync(process.execPath,['scripts/setup-local-env.js'],{stdio:'inherit'});
mkdirSync('.selfhost/tls',{recursive:true,mode:0o700});
execFileSync('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-keyout','.selfhost/tls/key.pem','-out','.selfhost/tls/cert.pem','-days','365','-subj','/CN=Cloud Play local Auth','-addext','subjectAltName=DNS:auth-gateway,IP:127.0.0.1,DNS:localhost'],{stdio:'ignore'});
const secret=randomBytes(32).toString('hex');
const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const body=Buffer.from(JSON.stringify({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+365*86400})).toString('base64url');
const anon=`${head}.${body}.`+createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url');
const config={PUBLIC_BRANDING_TENANT_ID:parseEnvironment(readFileSync('.env','utf8')).DEFAULT_TENANT_ID,SUPABASE_URL:'https://auth-gateway',SUPABASE_ANON_KEY:anon,SUPABASE_JWT_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:'https://localhost:8443',NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,VOD_SIGNING_KEY:randomBytes(32).toString('hex'),EXTERNAL_GEO_SIGNING_KEY:randomBytes(32).toString('hex')};
let text=readFileSync('.env','utf8');
for(const [key,value]of Object.entries(config)){const expression=new RegExp(`^${key}=.*$`,'m');text=expression.test(text)?text.replace(expression,`${key}="${value}"`):text+`\n${key}="${value}"\n`;}
writeFileSync('.env',text,{mode:0o600});
console.log('Local config ready. Import .selfhost/tls/cert.pem into your browser trust store yourself before Auth login. Never share the private key or .env. No trust bypass enabled.');
