import { FormEvent, useCallback, useEffect, useState } from 'react';
type Group={id:string;name:string};
type Source={id:string;serverId:string;priority:number;role:string;enabled:boolean;consecutiveFailures:number;healthySince:string|null};
type Channel={id:string;name:string;groupId:string;country:string;platform:string;enabled:boolean;autoFailover:boolean;failureThreshold:number;retrySeconds:number;holdDownSeconds:number;stabilitySeconds:number;freshnessSeconds:number;activeSourceId:string|null;sources:Source[]};
const input='block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15';
export default function ExternalChannelsPanel({token}:{token:string}){
 const [groups,setGroups]=useState<Group[]>([]),[channels,setChannels]=useState<Channel[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[history,setHistory]=useState<unknown>(null);
 const api=useCallback(async(path:string,method='GET',body?:unknown)=>{const response=await fetch(`/api/admin/external-channels${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('تعذر تنفيذ عملية القناة؛ تحقق من الصلاحيات والحقوق وصحة البيانات.');return response.json();},[token]);
 const load=useCallback(async()=>{setLoading(true);try{const [g,c]=await Promise.all([api('/groups'),api('')]);if(!Array.isArray(g)||!Array.isArray(c))throw new Error('استجابة قنوات غير صالحة');setGroups(g);setChannels(c);}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[api]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return load();});return()=>{active=false;};},[load]);
 async function action(fn:()=>Promise<unknown>){setBusy(true);setError('');setNotice('');try{await fn();await load();setNotice('حُفظت العملية. الاتصال لا يثبت الحقوق ولا ينشر المصدر تلقائياً.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function form(event:FormEvent<HTMLFormElement>,path:string,method='POST',transform=(body:Record<string,FormDataEntryValue>)=>body as unknown){event.preventDefault();const el=event.currentTarget;void action(async()=>{await api(path,method,transform(Object.fromEntries(new FormData(el))));});}
 return <section aria-label="Provider Groups and Channels" className="mt-8 pt-6 border-t border-white/10 space-y-4">
 <h2 className="text-xl font-bold text-[#00e5ff]">مجموعات المزودين والقنوات — Primary / Secondary</h2>
 <p className="text-sm text-gray-400">القنوات والمصادر تبدأ معطلة. اعتماد المصدر وتفعيل القناة عمليتان صريحتان تتطلبان external:publish وrights:manage. لا تتجاوز سياسة التحويل الحقوق حتى أثناء الانقطاع.</p>
 {error&&<p role="alert" className="text-red-400">{error}</p>}{notice&&<p role="status" className="text-emerald-400">{notice}</p>}
 <button disabled={busy} onClick={()=>void load()}>تحديث المجموعات والقنوات</button>
 <form className="flex flex-wrap gap-3" onSubmit={e=>form(e,'/groups')}><label>اسم مجموعة المزودين<input name="name" className={input} required maxLength={120}/></label><button disabled={busy}>إنشاء مجموعة</button></form>
 <form onSubmit={e=>form(e,'')} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl bg-[#0a0a0c] p-4">
 <label>اسم القناة<input name="name" className={input} required maxLength={120}/></label><label>مجموعة القناة<select name="groupId" className={input} required>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
 <label>دولة التشغيل<input name="country" className={input} defaultValue="IQ" minLength={2} maxLength={2} required/></label><label>منصة التشغيل<select name="platform" className={input}>{['web','android','ios','tv'].map(p=><option key={p}>{p}</option>)}</select></label><button disabled={busy||!groups.length}>إنشاء قناة معطلة</button></form>
 {loading&&<p role="status">جاري تحميل القنوات…</p>}{!loading&&!channels.length&&<p>لا توجد قنوات خارجية.</p>}
 {channels.map(channel=><article className="border border-white/15 p-4 rounded-xl space-y-3 min-w-0" key={channel.id}>
 <h3 className="font-bold break-words">{channel.name} · {channel.country} / {channel.platform} · {channel.enabled?'مفعلة بإقرار صريح':'معطلة'}</h3>
 <p className="text-xs text-gray-400 break-all">المصدر المختار: {channel.activeSourceId||'لا يوجد'} — الاختيار لا يضمن اجتياز الحقوق عند الطلب.</p>
 <form onSubmit={e=>form(e,`/${channel.id}/sources`,'POST',body=>({...body,priority:Number(body.priority)}))} className="grid grid-cols-1 md:grid-cols-3 gap-2"><label>معرّف السيرفر المرشح<input className={input} name="serverId" required/></label><label>ترتيب المصدر (1 أساسي)<input className={input} name="priority" type="number" min={1} max={1000} required/></label><button disabled={busy}>ربط مصدر معطل</button></form>
 <div className="space-y-2">{channel.sources.map((s,i)=><div className="p-3 bg-[#171820] rounded min-w-0" key={s.id}><p className="text-xs break-all">{s.role} #{s.priority} · {s.serverId} · {s.enabled?'معتمد صراحةً':'غير معتمد'} · إخفاقات: {s.consecutiveFailures}</p><div className="flex flex-wrap gap-3">
 <button disabled={busy||i===0} onClick={()=>void action(()=>{const ids=channel.sources.map(s=>s.id);[ids[i-1],ids[i]]=[ids[i],ids[i-1]];return api(`/${channel.id}/order`,'PUT',{sourceIds:ids});})}>رفع أولوية المصدر</button>
 <button disabled={busy} onClick={()=>{if(confirm('اعتماد مصدر للنشر؟ يجب مراجعة الحقوق واجتياز فحص المقطع أولاً. هذه ليست موافقة قانونية تلقائية.'))void action(()=>api(`/${channel.id}/sources/${s.id}/approve`,'POST',{publicationApproved:true}));}}>اعتماد المصدر صراحةً</button>
 </div></div>)}</div>
 <details><summary>سياسة Retry / Failover / منع Flapping</summary><form className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3" onSubmit={e=>form(e,`/${channel.id}/policy`,'PUT',body=>({autoFailover:body.autoFailover==='on',...Object.fromEntries(['failureThreshold','retrySeconds','holdDownSeconds','stabilitySeconds','freshnessSeconds'].map(k=>[k,Number(body[k])]))}))}>
 <label><input type="checkbox" name="autoFailover" defaultChecked={channel.autoFailover}/> تحويل تلقائي لهذه القناة</label>
 {([['failureThreshold','عدد الإخفاقات',1,10],['retrySeconds','إعادة المحاولة بالثواني',5,3600],['holdDownSeconds','حد التثبيت بالثواني',0,86400],['stabilitySeconds','استقرار الأساسي بالثواني',0,86400],['freshnessSeconds','صلاحية الفحص بالثواني',60,3600]] as const).map(([key,label,min,max])=><label key={key}>{label}<input className={input} name={key} type="number" min={min} max={max} defaultValue={channel[key]} required/></label>)}<button disabled={busy}>حفظ سياسة القناة</button></form></details>
 <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>{if(confirm(channel.enabled?'إيقاف القناة؟':'تفعيل القناة بإقرار نشر صريح؟ لا يسمح إلا بالمصادر المؤهلة.'))void action(()=>api(`/${channel.id}/activation`,'POST',{enabled:!channel.enabled,publicationApproved:!channel.enabled}));}}>{channel.enabled?'إيقاف القناة':'تفعيل القناة صراحةً'}</button>
 <button disabled={busy} onClick={()=>void action(async()=>setHistory(await api(`/${channel.id}/evaluate`,'POST',{})))}>تقييم الأهلية والتحويل</button><button disabled={busy} onClick={()=>void action(async()=>setHistory(await api(`/${channel.id}/history`)))}>سجل التحويلات والأولوية</button></div>
 </article>)}
 {history!==null&&<pre dir="ltr" className="text-xs overflow-auto max-h-80 p-3 bg-black rounded">{JSON.stringify(history,null,2)}</pre>}
 </section>;
}
