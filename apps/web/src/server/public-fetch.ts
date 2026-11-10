import { safeFetch } from './safe-fetch';

/** Public internet GET/HEAD entry point. Internal business API bridges are NOT
 * public traffic: their operator-selected private origin is an explicit exception.
 * Never use this with a privileged Authorization header to an arbitrary URL. */
export async function publicFetch(input: string | URL, init: RequestInit = {}, maxBytes = 24 * 1024 * 1024): Promise<Response> {
  if (init.method && !['GET', 'HEAD'].includes(init.method)) throw new Error('UNSUPPORTED_METHOD');
  const result = await safeFetch(String(input), {
    method: init.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    signal: init.signal || undefined,
    maxBytes, timeoutMs: 20_000, pinOrigin: true,
    redirect: init.redirect || 'error',
    acceptStatus: true,
  });
  return result.response;
}
