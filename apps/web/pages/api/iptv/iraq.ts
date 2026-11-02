import { legacySourcesAllowed } from '../../../src/server/legacy-source-policy';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getIraqChannels } from '../../../src/server/iraq-playlist';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'})}
 if (!legacySourcesAllowed()) return res.status(503).json({error:'SOURCE_NOT_APPROVED'});
 try{return res.status(200).json({data:await getIraqChannels()})}
 catch(e){const limit=e instanceof Error&&e.message==='RATE_LIMIT';return res.status(limit?429:503).json({error:limit?'RATE_LIMIT':'SOURCE_UNAVAILABLE'})}
}
