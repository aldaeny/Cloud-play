'use client';

import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tv } from 'lucide-react';
import type { Channel } from '../../types/channel';
import { CHANNEL_ROW_HEIGHT, ChannelRowCompact } from './ChannelRowCompact';

type Props = {
  channels: Channel[];
  favorites: readonly string[];
  language: 'ar' | 'en';
  activeId?: string;
  onPlay: (channel: Channel) => void;
  onFavoriteToggle: (id: string) => void;
};

/**
 * Virtualized compact list.
 *
 * Only the visible window (+ a small overscan) is mounted, so a 7,500-channel
 * playlist keeps a ~30-node DOM instead of 7,500 rows. The scroll container has
 * its own height so the page keeps its normal vertical rhythm and the fixed
 * bottom dock never sits on top of the list.
 */
export function ChannelList({ channels, favorites, language, activeId, onPlay, onFavoriteToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CHANNEL_ROW_HEIGHT,
    getItemKey: index => channels[index]?.id ?? index,
    overscan: 6,
  });

  if (channels.length === 0) {
    return (
      <div role="status" className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-border-line tw-bg-panel tw-px-6 tw-py-10 tw-text-center tw-text-muted">
        <Tv size={28} aria-hidden="true" />
        <p className="tw-text-sm">{language === 'ar' ? 'لا توجد قنوات مطابقة للفلاتر الحالية.' : 'No channels match the current filters.'}</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      data-testid="channel-scroll"
      role="region"
      aria-label={language === 'ar' ? 'قائمة القنوات' : 'Channel list'}
      tabIndex={0}
      className="tw-overflow-y-auto tw-overscroll-contain tw-rounded-xl tw-border tw-border-line tw-bg-ink tw-p-1 focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet"
      style={{ height: 'min(62vh, 620px)', contain: 'strict' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map(item => {
          const channel = channels[item.index];
          if (!channel) return null;
          return (
            <div
              key={item.key}
              data-index={item.index}
              style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: '100%', height: item.size, transform: `translateY(${item.start}px)` }}
            >
              <ChannelRowCompact
                channel={channel}
                favorite={favoriteSet.has(channel.id)}
                language={language}
                active={activeId === channel.id}
                onPlay={onPlay}
                onFavoriteToggle={onFavoriteToggle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
