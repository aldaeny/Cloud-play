import type { NextApiRequest, NextApiResponse } from 'next';

// The URL is server-side only; browsers always call the same-origin /api routes.
export async function forwardAdminRequest(req: NextApiRequest, res: NextApiResponse, path: string, authorized: boolean) {
  const origin = process.env.API_INTERNAL_URL || 'http://127.0.0.1:3000';
  const authorization = req.headers.authorization;
  if (authorized && (!authorization || !/^Bearer \S+$/.test(authorization))) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  try {
    const base = new URL(origin);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
      throw new Error('Invalid backend origin');
    }
    const response = await fetch(new URL(path, base), {
      method: req.method,
      headers: { ...(authorization ? { authorization } : {}), ...(['POST', 'PATCH', 'PUT'].includes(req.method || '') ? { 'content-type': 'application/json' } : {}) },
      ...(['POST', 'PATCH', 'PUT'].includes(req.method || '') ? { body: JSON.stringify(req.body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(/^\/admin\/xtream-servers\/[a-f0-9-]{36}\/catalog-sync\/pull$/i.test(path) ? 65000 : 10000),
    });
    const body: unknown = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(response.status).json(body);
  } catch {
    return res.status(503).json({ error: 'Admin backend is unavailable' });
  }
}
