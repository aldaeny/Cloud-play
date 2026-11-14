import type { NextApiRequest, NextApiResponse } from 'next';
import { AccessError, ownerConfigured, requireOwner } from '../../../src/server/xtream-access';
import { accountStatus, PrivateError } from '../../../src/server/xtream-private';

/**
 * GET /api/xtream/session
 * Tells the UI whether THIS account may open the private player.
 * Always 200 so the page can render a sign-in / not-authorized state instead of
 * an error. Never reveals which emails are on the allow-list.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  if (process.env.FREE_ACCESS !== 'false') {
    let account = null;
    try {
      account = await accountStatus();
    } catch {
      account = null;
    }
    return res.status(200).json({ owner: true, configured: true, email: 'public@cloudplay.tv', account });
  }

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) return res.status(200).json({ owner: false, reason: 'ACCOUNTS_OFF', configured: false });
  if (!ownerConfigured()) return res.status(200).json({ owner: false, reason: 'OWNER_NOT_SET', configured: true });

  try {
    const { email } = await requireOwner(req,res);
    let account = null;
    try {
      account = await accountStatus();
    } catch {
      // The player still works if the summary call fails; don't block on it.
      account = null;
    }
    return res.status(200).json({ owner: true, configured: true, email, account });
  } catch (error) {
    const reason = error instanceof AccessError ? error.code : error instanceof PrivateError ? error.code : 'AUTH_UNAVAILABLE';
    return res.status(200).json({ owner: false, configured: true, reason });
  }
}
