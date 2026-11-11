import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardAdminRequest } from '../../../lib/backend';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const action = req.query.action;
  const routes: Record<string, { path: string; methods: string[] }> = {
    branding: { path: 'branding', methods: ['GET', 'PUT'] },
    plans: { path: 'internal-plans', methods: ['POST'] },
    licenses: { path: 'licenses', methods: ['GET', 'POST'] },
  };
  if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(routes, action)) return res.status(400).json({ error: 'Invalid action' });
  const route = routes[action];
  if (!route.methods.includes(req.method || '')) { res.setHeader('Allow', route.methods.join(', ')); return res.status(405).end(); }
  return forwardAdminRequest(req, res, `/admin/tenant-settings/${route.path}`, true);
}
