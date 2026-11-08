'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Router-neutral contract: Pages and App Router supply their own implementation. */
export type NavigationAdapter = {
  pathname: string;
  push: (href: string) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
};
const NavigationContext = createContext<NavigationAdapter | null>(null);

export function NavigationProvider({ value, children }: { value: NavigationAdapter; children: ReactNode }) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
export function useNavigation(): NavigationAdapter {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('Cloud Play navigation requires a router shell.');
  return value;
}

/** App Router owns /live; crossing router boundaries must be a document navigation. */
export function isAppRoute(pathname: string): boolean {
  return pathname === '/live' || pathname.startsWith('/live/');
}
