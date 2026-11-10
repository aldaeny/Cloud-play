import {getSupabase} from './supabase';
/** Refresh through Supabase; the bridge cookie is merely its transport. */
export async function prepareMediaSession(src:string):Promise<void>{
 if(!src.startsWith('/api/external/'))return;
 const auth=getSupabase();if(!auth)throw new Error('SIGN_IN_REQUIRED');
 const {data,error}=await auth.auth.getSession();
 if(error||!data.session)throw new Error('SIGN_IN_REQUIRED');
 const response=await fetch('/api/external/session',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`},credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw new Error('MEDIA_SESSION_UNAVAILABLE');
}
