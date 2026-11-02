import { useEffect, useState } from 'react';
import MediaViewer from '../player/MediaViewer';

type Language = 'ar' | 'en';
const movies = [
  {id:'bunny',title:'Big Buck Bunny',year:'2008', ar:'فيلم رسوم متحركة قصير عن أرنب لطيف يواجه ثلاثة مشاغبين.', en:'An animated short about a gentle rabbit and three mischievous woodland creatures.',url:'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4', source:'https://archive.org/details/BigBuckBunny_328', license:'https://creativecommons.org/licenses/by/3.0/us/',licenseLabel:'CC BY 3.0 US',credit:'© 2008 Blender Foundation / www.bigbuckbunny.org'},
  {id:'sintel',title:'Sintel',year:'2010', ar:'مغامرة رسوم متحركة قصيرة عن فتاة تبحث عن تنينها الصغير.', en:'An animated fantasy short about a young woman searching for her dragon.',url:'https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4', source:'https://archive.org/details/Sintel', license:'https://creativecommons.org/licenses/by/3.0/',licenseLabel:'CC BY 3.0',credit:'© Blender Foundation · Director: Colin Levy'},
] as const;
export default function OpenMovies({language,query=''}:{language:Language;query?:string}) {
 const [chosen,setChosen]=useState<(typeof movies)[number]|null>(null);
 const [progress,setProgress]=useState<Record<string,number>>({});
 function refreshProgress(){const result:Record<string,number>={};try{for(const m of movies){const p=JSON.parse(localStorage.getItem(`cloudplay-progress-v1-${m.id}`)||'null');if(p&&Number.isFinite(p.position)&&p.position>=5)result[m.id]=p.position;}}catch{/* Storage unavailable. */}setProgress(result)}
 useEffect(()=>{Promise.resolve().then(refreshProgress)},[]);
 const ar=language==='ar';const filtered=movies.filter(m=>`${m.title} ${m.ar} ${m.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <section className="open-movies shell reveal-on-scroll" id="movies-library" aria-labelledby="open-movies-title">
  <div className="section-head"><div><div className="eyebrow"><span className="tiny-line"/>{ar?'مشاهدة مجانية':'FREE TO WATCH'}</div><h2 id="open-movies-title">{ar?'أفلام قصيرة مفتوحة':'Open short films'}</h2><p>{ar?'فيلمان مرخّصان مجاناً للتجربة؛ التشغيل يتصل مباشرة بـ Internet Archive.':'Two freely licensed short films; playback connects directly to Internet Archive.'}</p></div></div>
  <div className="open-movies-grid">{filtered.map(m=><article className="open-movie-card" key={m.id}><div className="open-movie-badge">{m.year} · {m.licenseLabel}</div><h3>{m.title}</h3><p>{m[language]}</p><button onClick={()=>setChosen(m)}>{progress[m.id]?(ar?'▶ استكمال المشاهدة':'▶ Resume watching'):(ar?'▶ شاهد الفيلم':'▶ Watch film')}</button><small>{m.credit} · <a href={m.license} target="_blank" rel="noreferrer">{m.licenseLabel}</a> · <a href={m.source} target="_blank" rel="noreferrer">{ar?'المصدر':'Source'}</a></small></article>)}{filtered.length===0&&<p>{ar?'لا توجد أفلام مطابقة.':'No matching films.'}</p>}</div><p className="firebase-note">{ar?'يُحفظ التقدم على هذا الجهاز فقط.':'Progress is saved on this device only.'}</p>
  {chosen&&<MediaViewer key={chosen.id} className="open-movie-viewer" language={language} title={chosen.title} url={chosen.url} kind="mp4" progressKey={chosen.id} onClose={()=>{setChosen(null);refreshProgress()}} footer={<small>{chosen.credit} · <a href={chosen.license} target="_blank" rel="noreferrer">{chosen.licenseLabel}</a> · <a href={chosen.source} target="_blank" rel="noreferrer">{ar?'المصدر':'Source'}</a></small>}/>}
 </section>;
}
