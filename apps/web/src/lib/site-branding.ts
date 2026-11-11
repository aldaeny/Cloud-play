export type SiteBranding = { displayName: string; logoUrl: string | null; brandDark: string; brandCard: string; cyanGlow: string; magentaGlow: string; violetGlow: string; amberGlow: string };
export function parseBranding(input: unknown): SiteBranding | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  if (typeof b.displayName !== 'string' || !b.displayName.trim() || b.displayName.length > 80) return null;
  if (b.logoUrl !== null && (typeof b.logoUrl !== 'string' || !/^\/brand-assets\/[a-zA-Z0-9_-]+\.(png|webp|jpg)$/.test(b.logoUrl))) return null;
  const colors = ['brandDark','brandCard','cyanGlow','magentaGlow','violetGlow','amberGlow'];
  if (!colors.every(key => typeof b[key] === 'string' && /^#[a-f0-9]{6}$/i.test(b[key] as string))) return null;
  return Object.fromEntries(['displayName','logoUrl',...colors].map(k => [k,b[k]])) as SiteBranding;
}
