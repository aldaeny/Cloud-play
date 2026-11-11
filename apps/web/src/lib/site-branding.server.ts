import 'server-only';
import { parseBranding, type SiteBranding } from './site-branding';
export async function loadSiteBranding(): Promise<SiteBranding | null> {
  const raw = process.env.API_INTERNAL_URL;
  if (!raw) return null; // Stock design preserved when white label is unconfigured.
  try {
    const origin = new URL(raw);
    if (!['http:','https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;
    const response = await fetch(new URL('/branding/public', origin), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const reader=response.body?.getReader();if(!reader)return null;
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096)return null;chunks.push(value);}}finally{await reader.cancel();}
    const text=Buffer.concat(chunks).toString('utf8');
    return parseBranding(JSON.parse(text));
  } catch { return null; }
}
