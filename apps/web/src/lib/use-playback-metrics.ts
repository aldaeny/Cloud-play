import {useEffect,type RefObject} from 'react';
/** Observations only, never an authorization or provider-health authority. */
export function usePlaybackMetrics(src:string,ref:RefObject<HTMLVideoElement|null>){
 useEffect(()=>{
  if(!src.startsWith('/api/external/'))return;
  const video=ref.current;if(!video)return;
  const endpoint=src.replace(/\/manifest(?:\.mpd)?$/, '/metrics');let start=performance.now(),waiting=0,started=false,count=0;
  const send=(event:string,value:number)=>{if(count++>=30)return;void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,value}),credentials:'same-origin',cache:'no-store'}).catch(()=>{});};
  const load=()=>{start=performance.now();started=false;};
  const playing=()=>{if(!started){started=true;send('startup',performance.now()-start);}if(waiting){send('buffering',performance.now()-waiting);waiting=0;}};
  const wait=()=>{if(!waiting)waiting=performance.now();};const error=()=>send('failure',1);
  video.addEventListener('loadstart',load);video.addEventListener('playing',playing);video.addEventListener('waiting',wait);video.addEventListener('error',error);
  return()=>{video.removeEventListener('loadstart',load);video.removeEventListener('playing',playing);video.removeEventListener('waiting',wait);video.removeEventListener('error',error);};
 },[src,ref]);
}
