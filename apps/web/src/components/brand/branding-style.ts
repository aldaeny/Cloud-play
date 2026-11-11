import type { CSSProperties } from 'react';
import type { SiteBranding } from '../../lib/site-branding';
export function brandingStyle(brand:SiteBranding|null,theme:string):CSSProperties|undefined {
  return brand?({'--bg':brand.brandDark,'--panel':brand.brandCard,'--cyan':brand.cyanGlow,'--pink':brand.magentaGlow,'--purple':brand.violetGlow,backgroundColor:theme==='dark'?brand.brandDark:undefined} as CSSProperties):undefined;
}
