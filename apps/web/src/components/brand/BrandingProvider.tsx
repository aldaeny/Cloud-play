'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { SiteBranding } from '../../lib/site-branding';
const Branding = createContext<SiteBranding | null>(null);
export const useBranding = () => useContext(Branding);
export default function BrandingProvider({ value, children }: { value: SiteBranding | null; children: ReactNode }) {
  return <Branding.Provider value={value}>{children}</Branding.Provider>;
}
