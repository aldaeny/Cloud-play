/**
 * Turns a stored snapshot channel into the only shape the browser ever sees.
 *
 * This is the single choke point between "a provider URL we can fetch" and "a
 * stream id the player can request", which is where all token stripping happens.
 */
import type { LiveSnapshot, PublicChannel } from './types';
import { encodeStreamTarget } from './url-policy';

export function publicChannel(channel: LiveSnapshot['channels'][number]): PublicChannel | null {
  // Names flow straight into the DOM, so re-sanitise on the way out. A snapshot
  // written by an older build must not be able to inject markup.
  const name = channel.name.replace(/[<>&"'`]/g, '').slice(0, 120).trim();
  if (!name) return null;
  const playable = channel.playable && Boolean(channel.url);
  return {
    id: channel.id,
    name,
    group: (channel.group ?? '').slice(0, 80),
    epgId: (channel.epgId ?? '').slice(0, 80),
    language: (channel.language ?? '').slice(0, 40),
    ...(channel.logo && /^https:\/\//i.test(channel.logo) ? { logo: channel.logo } : {}),
    playable,
    ...(playable && channel.url ? { stream: `/api/stream/${encodeStreamTarget(channel.url)}` } : {}),
  };
}
