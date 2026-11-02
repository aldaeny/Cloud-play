import Head from 'next/head';
import {readAppearance} from '../../lib/appearance';
import Link from 'next/link';
import CloudPlayBrand from '../brand/CloudPlayBrand';
import {useRouter} from 'next/router';
import {useEffect,useState,type ReactNode} from 'react';
export type Language='ar'|'en';
export default function SectionLayout({title,children,noIndex=false}:{title:{ar:string;en:string};children:(language:Language)=>ReactNode;noIndex?:boolean}){
 const router=useRouter();
 const [language,setLanguage]=useState<Language>('ar');const [theme,setTheme]=useState<'dark'|'light'>('dark');
 useEffect(()=>{Promise.resolve().then(()=>{try{if(localStorage.getItem('cloudplay-language')==='en')setLanguage('en');setTheme(readAppearance())}catch{/* Storage is optional. */}})},[]);
 useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr'},[language]);
 function setLang(){const next=language==='ar'?'en':'ar';setLanguage(next);try{localStorage.setItem('cloudplay-language',next)}catch{/* Storage is optional. */}}
 function setMode(){const next=theme==='dark'?'light':'dark';setTheme(next);try{localStorage.setItem('cloudplay-theme',next)}catch{/* Storage is optional. */}}
 const ar=language==='ar';const links=[['/movies','الأفلام','Movies'],['/series','المسلسلات','Series'],['/live','البث المباشر','Live TV'],['/search','البحث','Search'],['/favorites','المفضلة','Favorites'],['/continue','متابعة المشاهدة','Continue'],['/settings','الإعدادات','Settings']];
 return <div className={`site theme-${theme} section-site`} dir={ar?'rtl':'ltr'}><Head><title>{title[language]} | Cloud Play Iraq</title><meta name="description" content={ar?'اكتشف الأفلام المتاحة والبث المباشر على كلاود بلاي العراق.':'Explore available movies and live TV on Cloud Play Iraq.'}/><link rel="canonical" href={`https://cloud-play-iraq.vercel.app${router.asPath.split('?')[0]}`}/>{noIndex&&<meta name="robots" content="noindex,follow"/>}</Head>
 <header className="section-header shell"><Link href="/" className="section-brand" aria-label="Cloud Play Iraq"><CloudPlayBrand/></Link><div><button onClick={setLang} aria-label={ar?'Switch to English':'التبديل إلى العربية'}>{ar?'English':'العربية'}</button> <button onClick={setMode} aria-label={ar?'تغيير المظهر':'Change appearance'}>{theme==='dark'?(ar?'☀ فاتح':'☀ Light'):(ar?'☾ داكن':'☾ Dark')}</button></div></header>
 <nav className="section-nav shell" aria-label={ar?'التنقل الرئيسي':'Main navigation'}><Link href="/">{ar?'الرئيسية':'Home'}</Link>{links.map(([href,a,e])=><Link key={href} href={href}>{ar?a:e}</Link>)}</nav>
 <main className="section-main shell"><h1>{title[language]}</h1>{children(language)}</main><footer className="section-footer shell"><Link href="/">Cloud Play Iraq</Link> · {ar?'المفضلة والتقدم على هذا الجهاز فقط.':'Favorites and progress are stored on this device only.'}</footer></div>;
}
