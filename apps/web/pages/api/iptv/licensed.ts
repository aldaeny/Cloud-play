import type {NextApiRequest,NextApiResponse} from 'next';
import {readLicensedPlaylist} from '../../../src/server/licensed-iptv';
import { enforceRateLimit } from '../../../src/server/rate-limit';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if (!enforceRateLimit(req, res, { bucket: 'catalog' })) return;
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 try{return res.status(200).json({data:await readLicensedPlaylist()});}
 catch(error){
  // An operator who has not connected a rights-reviewed playlist gets an honest
  // empty catalog, not a fake outage. Parse/read failures remain 503 + retry.
  if(error instanceof Error && error.message==='NOT_CONFIGURED')return res.status(200).json({data:[],configured:false});
  return res.status(503).json({error:'LICENSED_SOURCE_UNAVAILABLE'});
 }
}
