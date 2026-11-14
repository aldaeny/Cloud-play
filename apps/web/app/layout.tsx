import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../src/styles';
import BrandingProvider from '../src/components/brand/BrandingProvider';
import { loadSiteBranding } from '../src/lib/site-branding.server';
import { AppProviders } from '../src/lib/use-appearance';
import { BOOT_SCRIPT } from '../src/lib/boot';
import AppShell from '../src/components/navigation/AppShell';

const stockMetadata: Metadata = {
  title: { default: 'Cloud Play Iraq', template: '%s | Cloud Play Iraq' },
  description: 'أفلام وقنوات بث مباشر على كلاود بلاي العراق.',
  icons: { icon: '/cloudplay-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#05060A' },
    { media: '(prefers-color-scheme: light)', color: '#EEF1F7' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await loadSiteBranding();
  return brand ? { ...stockMetadata, title: { default: brand.displayName, template: `%s | ${brand.displayName}` } } : stockMetadata;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const brand = await loadSiteBranding();
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body>
        <BrandingProvider value={brand}>
          <AppProviders>
            <AppShell>{children}</AppShell>
          </AppProviders>
        </BrandingProvider>
      </body>
    </html>
  );
}
