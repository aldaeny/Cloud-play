import type {NextApiRequest,NextApiResponse} from 'next';
import {readLicensedGuide} from '../../../src/server/licensed-epg';
import { enforceRateLimit } from '../../../src/server/rate-limit';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if (!enforceRateLimit(req, res, { bucket: 'catalog' })) return;
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 try{return res.status(200).json({data:await readLicensedGuide()});}catch{return res.status(503).json({error:'GUIDE_UNAVAILABLE'});}
}
