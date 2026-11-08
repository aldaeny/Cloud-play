import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import AppShell from '../src/components/navigation/AppShell';
import '../src/styles';

export const metadata: Metadata = {
  title: { default: 'Cloud Play Iraq', template: '%s | Cloud Play Iraq' },
  description: 'أفلام وقنوات بث مباشر على كلاود بلاي العراق.',
  icons: { icon: '/cloudplay-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ar" dir="rtl"><body><AppShell>{children}</AppShell></body></html>;
}
