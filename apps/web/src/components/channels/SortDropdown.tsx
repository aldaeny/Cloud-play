'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownWideNarrow, Check, ChevronDown } from 'lucide-react';
import { CHANNEL_SORTS, type ChannelSortKey } from '../../lib/channel-sort';

type Props = {
  value: ChannelSortKey;
  onChange: (value: ChannelSortKey) => void;
  language: 'ar' | 'en';
};

/** Accessible listbox: keyboard navigation, outside-click and Escape to close. */
export function SortDropdown({ value, onChange, language }: Props) {
  const ar = language === 'ar';
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => Math.max(0, CHANNEL_SORTS.findIndex(item => item.key === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = CHANNEL_SORTS.find(item => item.key === value) ?? CHANNEL_SORTS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const commit = (index: number) => {
    const option = CHANNEL_SORTS[index];
    if (option) onChange(option.key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="tw-relative tw-min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { setCursor(Math.max(0, CHANNEL_SORTS.findIndex(item => item.key === value))); setOpen(state => !state); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setCursor(Math.max(0, CHANNEL_SORTS.findIndex(item => item.key === value))); setOpen(true); }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ar ? 'ترتيب القنوات' : 'Sort channels'}
        className="tw-flex tw-h-11 tw-w-full tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-border-line tw-bg-panel tw-px-3 tw-text-sm tw-text-white tw-transition-colors hover:tw-bg-panelHover focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet"
      >
        <ArrowDownWideNarrow size={16} className="tw-shrink-0 tw-text-violet" aria-hidden="true" />
        <span className="tw-hidden tw-shrink-0 tw-text-muted sm:tw-inline">{ar ? 'ترتيب' : 'Sort'}</span>
        <span className="tw-truncate tw-font-semibold">{current[language]}</span>
        <ChevronDown size={16} className={`tw-ms-auto tw-shrink-0 tw-text-muted tw-transition-transform ${open ? 'tw-rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${cursor}`}
          aria-label={ar ? 'خيارات الترتيب' : 'Sort options'}
          ref={node => { node?.focus(); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
            else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(index => (index + 1) % CHANNEL_SORTS.length); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(index => (index - 1 + CHANNEL_SORTS.length) % CHANNEL_SORTS.length); }
            else if (event.key === 'Home') { event.preventDefault(); setCursor(0); }
            else if (event.key === 'End') { event.preventDefault(); setCursor(CHANNEL_SORTS.length - 1); }
            else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(cursor); }
            else if (event.key === 'Tab') setOpen(false);
          }}
          className="tw-absolute tw-z-30 tw-mt-1 tw-w-full tw-min-w-[200px] tw-overflow-hidden tw-rounded-xl tw-border tw-border-line tw-bg-panel tw-p-1 tw-shadow-2xl focus:tw-outline-none"
        >
          {CHANNEL_SORTS.map((option, index) => {
            const selected = option.key === value;
            return (
              <li
                key={option.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setCursor(index)}
                onClick={() => commit(index)}
                className={`tw-flex tw-cursor-pointer tw-items-center tw-gap-2 tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm ${index === cursor ? 'tw-bg-panelHover' : ''} ${selected ? 'tw-font-bold tw-text-violet' : 'tw-text-white'}`}
              >
                <Check size={15} className={selected ? 'tw-opacity-100' : 'tw-opacity-0'} aria-hidden="true" />
                <span className="tw-truncate">{option[language]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
