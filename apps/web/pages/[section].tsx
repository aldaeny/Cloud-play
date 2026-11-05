import {useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import Link from 'next/link';
import type {GetStaticPaths,GetStaticProps} from 'next';
import SectionLayout,{type Language} from '../src/components/layout/SectionLayout';
import OpenMovies from '../src/components/movies/OpenMovies';
import LicensedTv from '../src/components/iptv/LicensedTv';
import SettingsCards from '../src/components/settings/SettingsCards';
import SearchField from '../src/components/search/SearchField';
import AccountPanel from '../src/components/account/AccountPanel';
type Section='exclusive'|'latest'|'about'|'movies'|'series'|'live'|'favorites'|'continue'|'search'|'settings'|'login';
const titles:Record<Section,{ar:string;en:string}>={exclusive:{ar:'الحصريات',en:'Exclusives'},latest:{ar:'الأفلام الحديثة',en:'New films'},about:{ar:'عن المنصة',en:'About the platform'},movies:{ar:'الأفلام',en:'Movies'},series:{ar:'المسلسلات',en:'Series'},live:{ar:'البث المباشر',en:'Live TV'},favorites:{ar:'المفضلة',en:'Favorites'},continue:{ar:'متابعة المشاهدة',en:'Continue watching'},search:{ar:'البحث',en:'Search'},settings:{ar:'الإعدادات',en:'Settings'},login:{ar:'تسجيل الدخول',en:'Sign in'}};
export const getStaticPaths:GetStaticPaths=async()=>({paths:Object.keys(titles).map(section=>({params:{section}})),fallback:false});
export const getStaticProps:GetStaticProps=async ctx=>({props:{section:ctx.params?.section}});

export default function Section({section}:{section:Section}){const [query,setQuery]=useState('');const router=useRouter();useEffect(()=>{if(section==='search'&&typeof router.query.q==='string'){const q=router.query.q.slice(0,200);Promise.resolve().then(()=>setQuery(q))}},[section,router.query.q]);return <SectionLayout title={titles[section]} noIndex={['favorites','continue','search','settings','login'].includes(section)}>{language=>{
 const ar=language==='ar';
 if(section==='exclusive'||section==='latest')return <div className="section-empty" role="status"><h2>{section==='exclusive'?(ar?'لا توجد أعمال حصرية مؤكدة حالياً':'No confirmed exclusives yet'):(ar?'لا توجد أفلام حديثة مرخّصة حالياً':'No recently released licensed films yet')}</h2><p>{ar?'ستظهر الأعمال هنا بعد توفير المحتوى المرخّص والتحقق منه.':'Titles will appear here once licensed content is available and verified.'}</p><Link href="/movies">{ar?'تصفّح الأفلام المتاحة':'Browse available films'} ↗</Link></div>;
 if(section==='about')return <div className="section-empty platform-details"><h2>{ar?'كلاود بلاي العراق':'Cloud Play Iraq'}</h2><p>{ar?'منصة مجانية بالكامل. تتوفر حالياً أفلام قصيرة مرخّصة مجاناً تُشغّل من Internet Archive. أنشئ حساباً مجانياً لحفظ مفضلتك وتقدم المشاهدة عبر أجهزتك.':'A completely free platform. Freely licensed short films are currently available and play from Internet Archive. Create a free account to keep your favorites and watch progress across devices.'}</p><p>{ar?'المسلسلات والبث المباشر غير متاحين دون مصادر مرخّصة. لا توجد اشتراكات أو مدفوعات.':'Series and live TV require licensed sources. There are no subscriptions or payments.'}</p><Link href="/movies">{ar?'تصفّح الأفلام المتاحة':'Browse available films'} ↗</Link></div>;
 if(section==='live')return <LicensedTv language={language}/>;
 if(section==='series')return <div className="section-empty" role="status"><h2>{ar?'لا توجد مسلسلات متاحة حالياً':'No series are available yet'}</h2><p>{ar?'ستظهر الأعمال هنا بعد توفير محتوى مرخّص وربطه بالمكتبة.':'Series will appear here after licensed content is connected to the library.'}</p></div>;
 if(section==='login')return <AccountPanel language={language}/>;
 if(section==='settings')return <SettingsCards language={language}/>;
 return <>{section==='search'&&<div className="section-search-wrap"><SearchField value={query} onChange={setQuery} onClear={()=>setQuery('')} placeholder={ar?'ابحث عن فيلم، مسلسل، أو عرض حصري...':'Search movies, series, or exclusives...'} label={ar?'ابحث في الأفلام المتاحة':'Search available movies'} autoFocus/></div>}<OpenMovies key={section} language={language} query={query} initialFilter={section==='favorites'?'favorites':section==='continue'?'continue':'all'}/></>;
 }}</SectionLayout>}
