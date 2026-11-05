import {useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import Link from 'next/link';
import type {GetStaticPaths,GetStaticProps} from 'next';
import SectionLayout,{type Language} from '../src/components/layout/SectionLayout';
import OpenMovies from '../src/components/movies/OpenMovies';
import PublicTv from '../src/components/iptv/PublicTv';
import {getPublicChannels,type PublicChannel} from '../src/server/public-tv';
import SettingsCards from '../src/components/settings/SettingsCards';
import SearchField from '../src/components/search/SearchField';
import AccountPanel from '../src/components/account/AccountPanel';
type Section='exclusive'|'latest'|'about'|'movies'|'series'|'live'|'favorites'|'continue'|'search'|'settings'|'login';
const titles:Record<Section,{ar:string;en:string}>={exclusive:{ar:'الحصريات',en:'Exclusives'},latest:{ar:'الأفلام الحديثة',en:'New films'},about:{ar:'عن المنصة',en:'About the platform'},movies:{ar:'الأفلام',en:'Movies'},series:{ar:'المسلسلات',en:'Series'},live:{ar:'البث المباشر',en:'Live TV'},favorites:{ar:'المفضلة',en:'Favorites'},continue:{ar:'متابعة المشاهدة',en:'Continue watching'},search:{ar:'البحث',en:'Search'},settings:{ar:'الإعدادات',en:'Settings'},login:{ar:'تسجيل الدخول',en:'Sign in'}};
export const getStaticPaths:GetStaticPaths=async()=>({paths:Object.keys(titles).map(section=>({params:{section}})),fallback:false});
export const getStaticProps:GetStaticProps=async ctx=>{const section=ctx.params?.section;
 // The public live list is static curated data: render it into the HTML so the
 // channels are visible immediately and indexable, with no loading round-trip.
 return {props:{section,...(section==='live'?{channels:getPublicChannels()}:{})}};
};

export default function Section({section,channels}:{section:Section;channels?:PublicChannel[]}){const [query,setQuery]=useState('');const router=useRouter();useEffect(()=>{if(section==='search'&&typeof router.query.q==='string'){const q=router.query.q.slice(0,200);Promise.resolve().then(()=>setQuery(q))}},[section,router.query.q]);return <SectionLayout title={titles[section]} noIndex={['favorites','continue','search','settings','login'].includes(section)}>{language=>{
 const ar=language==='ar';
 if(section==='exclusive'||section==='latest')return <div className="section-empty" role="status"><h2>{section==='exclusive'?(ar?'لا توجد أعمال حصرية مؤكدة حالياً':'No confirmed exclusives yet'):(ar?'لا توجد أفلام حديثة مرخّصة حالياً':'No recently released licensed films yet')}</h2><p>{ar?'ستظهر الأعمال هنا بعد توفير المحتوى المرخّص والتحقق منه.':'Titles will appear here once licensed content is available and verified.'}</p><Link href="/movies">{ar?'تصفّح الأفلام المتاحة':'Browse available films'} ↗</Link></div>;
 if(section==='about')return <div className="section-empty platform-details"><h2>{ar?'كلاود بلاي العراق':'Cloud Play Iraq'}</h2><p>{ar?'منصة مجانية بالكامل. تتوفر أفلام قصيرة مرخّصة مجاناً تُشغّل من Internet Archive، وقنوات بث مباشر مجانية يبثّها أصحابها رسمياً — بدون تسجيل دخول. أنشئ حساباً مجانياً لحفظ مفضلتك وتقدم المشاهدة عبر أجهزتك.':'A completely free platform. Freely licensed short films play from Internet Archive, plus free live channels the broadcasters publish themselves — no sign-in needed. Create a free account to keep your favorites and watch progress across devices.'}</p><p>{ar?'لا توجد اشتراكات أو مدفوعات. القنوات المعروضة تُبثّ من سيرفرات أصحابها ومتاحة مجاناً للعموم.':'There are no subscriptions or payments. The channels shown are streamed from their owners’ own servers and published free to the public.'}</p><Link href="/live">{ar?'شاهد البث المباشر':'Watch live TV'} ↗</Link></div>;
 if(section==='live')return <PublicTv language={language} initialChannels={channels}/>;
 if(section==='series')return <div className="section-empty" role="status"><h2>{ar?'لا توجد مسلسلات متاحة حالياً':'No series are available yet'}</h2><p>{ar?'ستظهر الأعمال هنا بعد توفير محتوى مرخّص وربطه بالمكتبة.':'Series will appear here after licensed content is connected to the library.'}</p></div>;
 if(section==='login')return <AccountPanel language={language}/>;
 if(section==='settings')return <SettingsCards language={language}/>;
 return <>{section==='search'&&<div className="section-search-wrap"><SearchField value={query} onChange={setQuery} onClear={()=>setQuery('')} placeholder={ar?'ابحث عن فيلم، مسلسل، أو عرض حصري...':'Search movies, series, or exclusives...'} label={ar?'ابحث في الأفلام المتاحة':'Search available movies'} autoFocus/></div>}<OpenMovies key={section} language={language} query={query} initialFilter={section==='favorites'?'favorites':section==='continue'?'continue':'all'}/></>;
 }}</SectionLayout>}
