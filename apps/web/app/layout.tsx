import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import AppShell from '../src/components/navigation/AppShell';
import '../src/styles';
import BrandingProvider from '../src/components/brand/BrandingProvider';
import { loadSiteBranding } from '../src/lib/site-branding.server';

const stockMetadata: Metadata = {
  title: { default: 'Cloud Play Iraq', template: '%s | Cloud Play Iraq' },
  description: 'أفلام وقنوات بث مباشر على كلاود بلاي العراق.',
  icons: { icon: '/cloudplay-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export async function generateMetadata(): Promise<Metadata> {
  const brand = await loadSiteBranding();
  return brand ? { ...stockMetadata, title: { default: brand.displayName, template: `%s | ${brand.displayName}` } } : stockMetadata;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const brand = await loadSiteBranding();
  return <html lang="ar" dir="rtl"><body><BrandingProvider value={brand}><AppShell>{children}</AppShell></BrandingProvider></body></html>;
}
