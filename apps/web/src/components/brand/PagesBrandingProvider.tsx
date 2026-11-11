import { useEffect, useState, type ReactNode } from 'react';
import BrandingProvider from './BrandingProvider';
import { parseBranding, type SiteBranding } from '../../lib/site-branding';
export default function PagesBrandingProvider({children}:{children:ReactNode}) {
  const [brand,setBrand]=useState<SiteBranding|null>(null);
  useEffect(()=>{
    const abort=new AbortController();
    fetch('/api/site-branding',{cache:'no-store',signal:abort.signal}).then(async res=>{
      if(res.status===200)setBrand(parseBranding(await res.json()));
    }).catch(()=>{});
    return()=>abort.abort();
  },[]);
  return <BrandingProvider value={brand}>{children}</BrandingProvider>;
}
