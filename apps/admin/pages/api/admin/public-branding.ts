import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardAdminRequest } from '../../../lib/backend';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  return forwardAdminRequest(req,res,'/branding/public',false);
}
