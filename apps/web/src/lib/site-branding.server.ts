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
    const text = await response.text();
    if (text.length > 4096) return null;
    return parseBranding(JSON.parse(text));
  } catch { return null; }
}
