import { legacySourcesAllowed } from '../../../src/server/legacy-source-policy';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getWorldChannels } from '../../../src/server/iraq-playlist';
const PAGE_SIZE=60;
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'})}
 const q=typeof req.query.q==='string'?req.query.q.trim():'';
 const p=typeof req.query.page==='string'?req.query.page:'1';
 if(q.length>100||!/^\d{1,5}$/.test(p)||Number(p)<1)return res.status(400).json({error:'INVALID_QUERY'});
 if (!legacySourcesAllowed()) return res.status(503).json({error:'SOURCE_NOT_APPROVED'});
 try{
  const all=await getWorldChannels();const term=q.toLocaleLowerCase();const matches=term?all.filter(x=>x.name.toLocaleLowerCase().includes(term)):all;const page=Number(p);
  return res.status(200).json({data:matches.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),total:matches.length,page,pageSize:PAGE_SIZE});
 }catch(e){const limit=e instanceof Error&&e.message==='RATE_LIMIT';return res.status(limit?429:503).json({error:limit?'RATE_LIMIT':'SOURCE_UNAVAILABLE'})}
}
