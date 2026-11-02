import {useState} from 'react';
import Link from 'next/link';
import type {GetStaticPaths,GetStaticProps} from 'next';
import SectionLayout,{type Language} from '../src/components/layout/SectionLayout';
import OpenMovies from '../src/components/movies/OpenMovies';
import LicensedTv from '../src/components/iptv/LicensedTv';
type Section='movies'|'series'|'live'|'favorites'|'continue'|'search'|'settings'|'login';
const titles:Record<Section,{ar:string;en:string}>={movies:{ar:'الأفلام',en:'Movies'},series:{ar:'المسلسلات',en:'Series'},live:{ar:'البث المباشر',en:'Live TV'},favorites:{ar:'المفضلة',en:'Favorites'},continue:{ar:'متابعة المشاهدة',en:'Continue watching'},search:{ar:'البحث',en:'Search'},settings:{ar:'الإعدادات',en:'Settings'},login:{ar:'تسجيل الدخول',en:'Sign in'}};
export const getStaticPaths:GetStaticPaths=async()=>({paths:Object.keys(titles).map(section=>({params:{section}})),fallback:false});
export const getStaticProps:GetStaticProps=async ctx=>({props:{section:ctx.params?.section}});
function Settings({language}:{language:Language}){const ar=language==='ar';return <div className="section-empty"><p>{ar?'استخدم زري اللغة والمظهر أعلى الصفحة. تتوفر إعدادات الحركة والمشغّل الإضافية من الصفحة الرئيسية.':'Use the language and appearance buttons above. More motion and player preferences are available on the home page.'}</p><Link href="/">{ar?'العودة إلى الرئيسية والإعدادات':'Return to home and settings'}</Link></div>}
export default function Section({section}:{section:Section}){const [query,setQuery]=useState('');return <SectionLayout title={titles[section]} noIndex={['favorites','continue','search','settings','login'].includes(section)}>{language=>{
 const ar=language==='ar';
 if(section==='live')return <LicensedTv language={language}/>;
 if(section==='series')return <div className="section-empty" role="status"><h2>{ar?'لا توجد مسلسلات متاحة حالياً':'No series are available yet'}</h2><p>{ar?'ستظهر الأعمال هنا بعد توفير محتوى مرخّص وربطه بالمكتبة.':'Series will appear here after licensed content is connected to the library.'}</p></div>;
 if(section==='login')return <div className="section-empty" role="status"><h2>{ar?'الحسابات غير متصلة بعد':'Accounts are not connected yet'}</h2><p>{ar?'لا يمكن تسجيل الدخول حالياً؛ لا تدخل بياناتك في أي نموذج غير موثوق.':'Sign-in is not available yet. Do not enter credentials into an untrusted form.'}</p></div>;
 if(section==='settings')return <Settings language={language}/>;
 return <>{section==='search'&&<label className="section-search">{ar?'ابحث في الأفلام المتاحة':'Search available movies'}<input value={query} onChange={e=>setQuery(e.target.value)} type="search" maxLength={200}/></label>}<OpenMovies key={section} language={language} query={query} initialFilter={section==='favorites'?'favorites':section==='continue'?'continue':'all'}/></>;
 }}</SectionLayout>}
