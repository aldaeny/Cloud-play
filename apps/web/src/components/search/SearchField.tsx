'use client';
/* eslint-disable react-hooks/immutability -- a ref callback forwards the node to a caller-owned ref. */

import { useCallback, useRef, type Ref } from 'react';
import Icon from '../icons/Icon';
import { useI18n } from '../../lib/i18n';

/**
 * The product's search field: a single glass capsule with a leading glyph, a
 * full-width input, an optional clear control and (on pointer devices) a
 * keyboard hint. It keeps `dir="auto"` so mixed Arabic/Latin queries never
 * reorder, while the field itself follows the interface direction.
 */
export default function SearchField({
  value, onChange, placeholder, label, onSubmit, onClear, autoFocus = false, id,
  inputRef, maxLength = 200, shortcut, className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  onSubmit?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  maxLength?: number;
  shortcut?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const fallbackRef = useRef<HTMLInputElement | null>(null);
  // Stable ref callback: keep the local fallback and forward to the caller's ref.
  const setInput = useCallback((node: HTMLInputElement | null) => {
    fallbackRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef && 'current' in inputRef) (inputRef as { current: HTMLInputElement | null }).current = node;
  }, [inputRef]);

  return (
    <form
      className={['cp-field', 'cp-search-field', className ?? ''].filter(Boolean).join(' ')}
      role="search"
      onSubmit={event => { event.preventDefault(); onSubmit?.(); }}
    >
      <span className="cp-field__icon" aria-hidden="true"><Icon name="search" size={19} /></span>
      <input
        ref={setInput}
        id={id}
        type="search"
        dir="auto"
        value={value}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape' && value) { event.stopPropagation(); onChange(''); onClear?.(); }
        }}
        placeholder={placeholder}
        aria-label={label}
      />
      {value ? (
        <button
          type="button"
          className="cp-field__action"
          onClick={() => { onChange(''); onClear?.(); fallbackRef.current?.focus(); }}
          aria-label={t('search.clear')}
        >
          <Icon name="close" size={15} />
        </button>
      ) : shortcut ? (
        <kbd className="cp-kbd" aria-hidden="true">{shortcut}</kbd>
      ) : null}
    </form>
  );
}
