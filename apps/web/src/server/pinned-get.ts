/** Native streaming transport. DNS answers are supplied by the caller's socket
 * lookup, never resolved again by fetch. No redirects, proxies or shared agent. */
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { Readable } from 'node:stream';

export function pinnedGet(url: URL, options: {
  method: 'GET' | 'HEAD'; headers: Record<string, string>; signal: AbortSignal;
  lookup: LookupFunction; maxBytes?: number;
}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, {
      method: options.method, signal: options.signal, lookup: options.lookup,
      agent: false, rejectUnauthorized: true, maxHeaderSize: 16 * 1024,
      // Keep the URL hostname for TLS certificate checking and SNI.
      headers: { ...options.headers, 'Accept-Encoding': 'identity' },
    }, upstream => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(upstream.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const status = upstream.statusCode || 502;
      if (options.method === 'HEAD' || [204, 205, 304].includes(status)) {
        upstream.resume(); resolve(new Response(null, { status, headers })); return;
      }
      let total = 0;
      const limited = Readable.from((async function* () {
        try {
          for await (const chunk of upstream) {
            total += chunk.length;
            if (options.maxBytes && total > options.maxBytes) throw new Error('TOO_LARGE');
            yield chunk;
          }
        } finally { upstream.destroy(); }
      })());
      const body = Readable.toWeb(limited) as ReadableStream<Uint8Array>;
      resolve(new Response(body, { status, headers }));
    });
    // Return only a stable error; raw errors can contain sensitive upstream data.
    req.on('error', () => reject(new Error('UPSTREAM_UNREACHABLE')));
    req.end();
  });
}
