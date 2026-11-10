import type {NextApiRequest,NextApiResponse} from 'next';
/** Transport the existing Supabase token, never mint a second identity. */
export default function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
 if(!req.headers.origin || req.headers.origin!==`https://${req.headers.host}`)return res.status(403).end();
 const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]{20,8192})$/)?.[1];
 if(!token)return res.status(401).end();
 res.setHeader('Set-Cookie',`__Host-cloudplay-media=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`);
 return res.status(204).end();
}
