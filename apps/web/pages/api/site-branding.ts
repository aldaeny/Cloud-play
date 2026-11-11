import type { NextApiRequest, NextApiResponse } from 'next';
import { loadSiteBranding } from '../../src/lib/site-branding.server';
export default async function handler(req: NextApiRequest,res: NextApiResponse) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
  const brand=await loadSiteBranding();
  if(!brand)return res.status(204).end();
  return res.status(200).json(brand);
}
