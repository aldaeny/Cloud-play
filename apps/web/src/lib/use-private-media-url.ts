import {useEffect,useState} from 'react';
import {getSupabase} from './supabase';
/** Keep the existing players. Exchange non-playable selection descriptors for
 * short media grants; no refresh token/provider credential ever enters a URL.
 * No renewal after original selection cap, logout or backend denial. */
export function usePrivateMediaUrl(input:string):string{
 const bound=/^\/api\/(playlist|xtream)\/stream\?t=[A-Za-z0-9_-]+&session=1$/.test(input);
 const [state,setState]=useState({input:'',url:''});
 useEffect(()=>{
  if(!bound)return;
  let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const auth=getSupabase();
  const renew=async()=>{
   try{
    if(!auth)throw new Error();
    const {data,error}=await auth.auth.getSession();if(error||!data.session)throw new Error();
    const response=await fetch('/api/private-media/renew',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({url:input}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error();const result=await response.json();
    if(typeof result.url!=='string'||!/^\/api\/(playlist|xtream)\/stream\?t=[A-Za-z0-9_-]+$/.test(result.url)||!Number.isSafeInteger(result.expiresAt)||result.expiresAt<=Date.now())throw new Error();
    if(cancelled)return;setState({input,url:result.url});timer=setTimeout(()=>void renew(),Math.min(45000,Math.max(1,result.expiresAt-Date.now()-1000)));
   }catch{if(!cancelled)setState({input,url:''});}
  };
  void renew();const subscription=auth?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearTimeout(timer);if(!cancelled)setState({input,url:''});}});
  return()=>{cancelled=true;clearTimeout(timer);subscription?.data.subscription.unsubscribe();};
 },[input,bound]);
 return bound?(state.input===input?state.url:''):input;
}
