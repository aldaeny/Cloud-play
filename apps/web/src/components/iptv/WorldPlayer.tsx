import { useEffect, useRef, useState } from 'react';
import MediaViewer from '../player/MediaViewer';
type Language='ar'|'en';
type Channel={id:string;name:string;playable:boolean;streamUrl?:string};
type Result={data:Channel[];total:number;page:number;pageSize:number};
export default function WorldPlayer({language}:{language:Language}){
 const ar=language==='ar';const [results,setResults]=useState<Result|null>(null);const [query,setQuery]=useState('');const [committed,setCommitted]=useState('');const [loading,setLoading]=useState(false);const [failed,setFailed]=useState(false);const [selected,setSelected]=useState<Channel|null>(null);const requestRef=useRef<AbortController|null>(null);
 useEffect(()=>()=>requestRef.current?.abort(),[]);
 async function load(page:number,term:string){
  requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;setLoading(true);setFailed(false);
  try{const params=new URLSearchParams({page:String(page),q:term.trim()});const r=await fetch(`/api/iptv/world?${params}`,{cache:'no-store',signal:controller.signal});const x=await r.json();if(!r.ok||!Array.isArray(x.data)||typeof x.total!=='number')throw new Error();setResults(x);setCommitted(term.trim())}catch{if(!controller.signal.aborted)setFailed(true)}finally{if(!controller.signal.aborted)setLoading(false)}
 }
 return <div className="firebase-player playlist-player world-player"><div className="firebase-heading"><div><h3>{ar?'قنوات العالم':'World channels'}</h3><p>{ar?'قائمة iptv-org العالمية، مع بحث وتقسيم للنتائج.':'The global iptv-org playlist, searchable and paginated.'}</p></div><button className="iptv-load" disabled={loading} onClick={()=>{setQuery('');void load(1,'')}}>{loading?(ar?'جاري التحميل…':'Loading…'):(ar?'عرض قنوات العالم':'Load world channels')}</button></div>
 {results&&<><form className="playlist-search world-search" onSubmit={e=>{e.preventDefault();void load(1,query)}}><label htmlFor="world-search">{ar?'بحث في قنوات العالم':'Search world channels'}</label><input id="world-search" type="search" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'اكتب اسم القناة':'Enter a channel name'}/><button type="submit" disabled={loading}>{ar?'بحث':'Search'}</button></form>
 <p className="iptv-label" aria-live="polite">{results.total} {ar?'نتيجة':'results'} {committed?` · ${committed}`:''}</p>
 {results.data.length?<div className="firebase-list">{results.data.map(c=><button key={c.id} disabled={!c.playable} onClick={()=>setSelected(c)} className={selected?.id===c.id?'selected':''}><span className="firebase-play">{c.playable?'▶':'—'}</span><span className="firebase-channel-name"><strong>{c.name}</strong></span><span className="firebase-channel-status">{c.playable?(ar?'جرّب التشغيل':'Try playing'):(ar?'غير متاح':'Unavailable')}</span></button>)}</div>:<p className="firebase-note">{ar?'لا توجد قنوات مطابقة.':'No matching channels.'}</p>}
 <div className="world-pagination"><button disabled={loading||results.page<=1} onClick={()=>load(results.page-1,committed)}>{ar?'السابق':'Previous'}</button><span>{ar?'صفحة':'Page'} {results.page} / {Math.max(1,Math.ceil(results.total/results.pageSize))}</span><button disabled={loading||results.page*results.pageSize>=results.total} onClick={()=>load(results.page+1,committed)}>{ar?'التالي':'Next'}</button></div>
 <p className="firebase-note">{ar?'القنوات غير المتاحة تستخدم روابط أو إعدادات غير مدعومة هنا. إتاحة الزر لا تضمن نجاح التشغيل.':'Unavailable entries use unsupported URLs or settings. An enabled button does not guarantee playback.'}</p></>}
 {failed&&<p className="firebase-error" role="status">{ar?'تعذّر جلب القائمة الآن. حاول مرة أخرى.':'Could not load the list. Please try again.'}</p>}
 {selected?.streamUrl&&<MediaViewer key={selected.id} language={language} title={selected.name} url={selected.streamUrl} kind="hls" onClose={()=>setSelected(null)}/>}
 <p className="firebase-note">{ar?'البث يتصل مباشرة بمصدره الخارجي. تأكّد من حقك في استخدام المحتوى.':'Playback connects directly to the external provider. Ensure you have permission to use the content.'}</p></div>
}
