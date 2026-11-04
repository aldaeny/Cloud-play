// Shared icon set — single source for the home page and the global navigation.
export type IconName = 'search' | 'arrow' | 'play' | 'close' | 'tv' | 'globe' | 'settings' | 'home' | 'film' | 'user' | 'sun' | 'moon' | 'text' | 'sparkle' | 'rotate' | 'star' | 'clock' | 'trash';

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 4.2 4.2"/></svg>;
  if (name === 'arrow') return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
  if (name === 'play') return <svg {...common} fill="currentColor" stroke="none"><path d="M8 4.8v14.4L19 12 8 4.8Z"/></svg>;
  if (name === 'close') return <svg {...common}><path d="M5 5l14 14M19 5 5 19"/></svg>;
  if (name === 'home') return <svg {...common}><path d="m3 11 9-7 9 7M5.5 10v9.5h13V10M9.5 19.5v-6h5v6"/></svg>;
  if (name === 'film') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>;
  if (name === 'text') return <svg {...common}><path d="M3 19 8.5 5 14 19M5 14h7M15 11h6M18 8v11"/></svg>;
  if (name === 'sparkle') return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>;
  if (name === 'rotate') return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5M5 9a7.5 7.5 0 0 1 12.8-2L20 12M4 12l2.2 5A7.5 7.5 0 0 0 19 15"/></svg>;
  if (name === 'user') return <svg {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.4-4 3-6 7-6s6.6 2 7 6"/></svg>;
  if (name === 'sun') return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>;
  if (name === 'moon') return <svg {...common}><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z"/></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l1.5-1.1-1.5-2.6-1.8.6a8 8 0 0 0-2.6-1.5L14.7 4h-3l-.3 1.9a8 8 0 0 0-2.6 1.5L7 6.8 5.5 9.4 7 10.5a7.8 7.8 0 0 0 0 3l-1.5 1.1L7 17.2l1.8-.6a8 8 0 0 0 2.6 1.5l.3 1.9h3l.3-1.9a8 8 0 0 0 2.6-1.5l1.8.6 1.5-2.6-1.5-1.1Z"/></svg>;
  if (name === 'tv') return <svg {...common}><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></svg>;
  if (name === 'star') return <svg {...common}><path d="m12 3.6 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.6Z"/></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
  if (name === 'trash') return <svg {...common}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12M10 11v6M14 11v6"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9C9.5 18.5 8.5 15.5 8.5 12s1-6.5 3.5-9Z"/></svg>;
}
