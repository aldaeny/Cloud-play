import type {NextApiRequest,NextApiResponse} from 'next';
import {readLicensedPlaylist} from '../../../src/server/licensed-iptv';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 try{return res.status(200).json({data:await readLicensedPlaylist()});}
 catch{return res.status(503).json({error:'LICENSED_SOURCE_UNAVAILABLE'});}
}
