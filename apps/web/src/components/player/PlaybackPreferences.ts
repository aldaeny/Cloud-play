import { createContext } from 'react';

export type PlaybackPreferences = {
  autoPlay: boolean;
  startMuted: boolean;
  scrollToPlayer: boolean;
};

export const PlaybackPreferencesContext = createContext<PlaybackPreferences>({
  autoPlay: true,
  startMuted: false,
  scrollToPlayer: true,
});
