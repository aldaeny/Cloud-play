import type { ReactNode } from 'react';

// Cloud Play — shared line-icon set (24px grid, 1.7 stroke, optical sizing).
// One source for the header, dock, home page, settings, player and empty states.
export type IconName =
  | 'search' | 'arrow' | 'play' | 'pause' | 'close' | 'tv' | 'globe' | 'settings'
  | 'home' | 'film' | 'user' | 'sun' | 'moon' | 'auto' | 'text' | 'sparkle'
  | 'rotate' | 'star' | 'clock' | 'trash' | 'check' | 'chevron' | 'menu'
  | 'volume' | 'mute' | 'expand' | 'info' | 'share' | 'download' | 'library'
  | 'lock' | 'wifi' | 'airplay' | 'speed' | 'subtitles' | 'contrast' | 'copy' | 'sound' | 'devices';

const PATHS: Record<IconName, ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.2 4.2" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M8 4.8v14.4L19 12 8 4.8Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" /></>,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  home: <path d="m3 11 9-7 9 7M5.5 10v9.5h13V10M9.5 19.5v-6h5v6" />,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  tv: <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M8 21h8M12 18v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9C9.5 18.5 8.5 15.5 8.5 12s1-6.5 3.5-9Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l1.5-1.1-1.5-2.6-1.8.6a8 8 0 0 0-2.6-1.5L14.7 4h-3l-.3 1.9a8 8 0 0 0-2.6 1.5L7 6.8 5.5 9.4 7 10.5a7.8 7.8 0 0 0 0 3l-1.5 1.1L7 17.2l1.8-.6a8 8 0 0 0 2.6 1.5l.3 1.9h3l.3-1.9a8 8 0 0 0 2.6-1.5l1.8.6 1.5-2.6-1.5-1.1Z" /></>,
  user: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20c.4-4 3-6 7-6s6.6 2 7 6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" />,
  auto: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M9.5 13l1.6-4.4h.4l1.6 4.4M10.2 11.6h2.2" /></>,
  text: <path d="M3 19 8.5 5 14 19M5 14h7M15 11h6M18 8v11" />,
  sparkle: <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
  rotate: <path d="M20 7v5h-5M4 17v-5h5M5 9a7.5 7.5 0 0 1 12.8-2L20 12M4 12l2.2 5A7.5 7.5 0 0 0 19 15" />,
  star: <path d="m12 3.6 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.6Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  trash: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12M10 11v6M14 11v6" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  volume: <><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /></>,
  mute: <><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  expand: <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.6v.6" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" /></>,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />,
  library: <><rect x="3" y="4" width="4" height="16" rx="1" /><rect x="10" y="4" width="4" height="16" rx="1" /><path d="m17.4 5.6 3 13.8" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  wifi: <path d="M2.5 8.5a15 15 0 0 1 19 0M6 12.2a10 10 0 0 1 12 0M9.5 15.9a5 5 0 0 1 5 0M12 19.5h.01" />,
  airplay: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="m12 13 5 7H7l5-7Z" fill="currentColor" stroke="none" /></>,
  speed: <><circle cx="12" cy="13" r="8" /><path d="M12 13l4-4M9 3h6" /></>,
  subtitles: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 14h4M13 14h4M7 10.5h2M11 10.5h6" /></>,
  contrast: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18V3Z" fill="currentColor" stroke="none" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2.4" /><path d="M15 6.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1.4" /></>,
  sound: <><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /></>,
  devices: <><rect x="2.5" y="5" width="12" height="9" rx="1.6" /><path d="M6 18h5" /><rect x="16" y="9" width="5.5" height="10" rx="1.4" /></>,
};

export default function Icon({
  name, size = 20, strokeWidth = 1.7,
}: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
