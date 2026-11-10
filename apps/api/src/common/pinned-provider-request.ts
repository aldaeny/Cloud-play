import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request } from 'node:https';
import { publicProviderAddress } from './provider-address';

export class ProviderTransportError extends Error {
  constructor(public readonly code: 'INVALID_URL' | 'ORIGIN_UNREACHABLE' | 'UNEXPECTED_RESPONSE') {
    super(code); // Never include a URL, credential, response or socket error.
  }
}

type Dependencies = { lookup: typeof lookup; request: typeof request };

/** HTTPS-only, no redirects, no proxy env, no reused socket. The socket lookup
 * returns the previously validated IP, while the original hostname remains the
 * HTTP Host, TLS verification name and SNI. No second DNS lookup can rebind it.
 * Optional dependencies are a test seam; production calls use only Node APIs. */
export async function pinnedProviderRequest(url: URL, init: RequestInit,
  deps: Dependencies = { lookup, request }, maxBytes = 64 * 1024): Promise<Response> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 8 * 1024 * 1024) throw new ProviderTransportError('INVALID_URL');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || !host ||
      ['localhost', 'metadata', 'instance-data'].includes(host) ||
      /\.(localhost|local|internal|lan|home|corp|intranet|localdomain)$/.test(host) ||
      (!host.includes('.') && !host.includes(':'))) throw new ProviderTransportError('INVALID_URL');
  if (init.method !== 'POST' || typeof init.body !== 'string') throw new ProviderTransportError('INVALID_URL');
  const signal = init.signal || AbortSignal.timeout(8000);
  let records: Array<{ address: string; family: number }>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    records = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
      deps.lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ProviderTransportError('ORIGIN_UNREACHABLE')), 2000); }),
    ]);
  } catch { throw new ProviderTransportError('ORIGIN_UNREACHABLE'); }
  finally { clearTimeout(timer); }
  if (!records.length || records.some(row => !publicProviderAddress(row.address) || row.family !== isIP(row.address))) throw new ProviderTransportError('INVALID_URL');
  if (signal.aborted) throw new ProviderTransportError('ORIGIN_UNREACHABLE');
  const selected = records[0];
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const fail = (code: 'ORIGIN_UNREACHABLE' | 'UNEXPECTED_RESPONSE') => {
      if (!settled) { settled = true; reject(new ProviderTransportError(code)); }
    };
    const req = deps.request(url, {
      method: 'POST', agent: false, rejectUnauthorized: true,
      ...(isIP(host) ? {} : { servername: host }),
      // Native TLS still verifies the original URL hostname, NOT this IP.
      lookup: (_hostname, options, callback) => {
        if (typeof options === 'object' && options.all) callback(null, [selected]);
        else callback(null, selected.address, selected.family);
      },
      signal, maxHeaderSize: 16 * 1024,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json',
        'Content-Length': Buffer.byteLength(init.body as string) },
    }, response => {
      const rawStatus = response.statusCode || 502;
      const status = rawStatus >= 200 && rawStatus <= 599 ? rawStatus : 502;
      // Native https never follows redirects. Do not read or disclose an error
      // body; preserving 401/403 is enough for an honest credential verdict.
      if (status < 200 || status >= 300) {
        settled = true;
        resolve(new Response(null, { status }));
        response.destroy();
        return;
      }
      if (Number(response.headers['content-length']) > maxBytes) {
        fail('UNEXPECTED_RESPONSE'); response.destroy(); req.destroy(); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.byteLength;
        if (size > maxBytes) { fail('UNEXPECTED_RESPONSE'); response.destroy(); req.destroy(); }
        else chunks.push(chunk);
      });
      response.on('aborted', () => fail('UNEXPECTED_RESPONSE'));
      response.on('error', () => fail('UNEXPECTED_RESPONSE'));
      response.on('end', () => {
        if (!settled) {
          settled = true;
          resolve(new Response(status === 204 ? null : Buffer.concat(chunks), { status }));
        }
      });
    });
    req.on('error', () => fail('ORIGIN_UNREACHABLE'));
    req.end(init.body);
  }).catch(error => {
    if (error instanceof ProviderTransportError) throw error;
    throw new ProviderTransportError('ORIGIN_UNREACHABLE');
  });
}
