'use client';
/* eslint-disable react-hooks/refs -- popover/sheet hooks expose refs that JSX attaches in render. */

/**
 * Cloud Play — overlays.
 *
 * Popover menus and sheets are the two overlay primitives of the system:
 *   · `usePopover` positions an anchored glass menu, flips it when there is no
 *     room, keeps it inside the viewport in RTL and LTR, and returns focus to
 *     its trigger on close.
 *   · `Sheet` is a drag-to-dismiss bottom sheet on phones/tablets and a centred
 *     glass dialog on desktop/TV. It traps focus, locks the page, and closes on
 *     Escape or a scrim tap.
 */
import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/** Layout effects run on the client only; the server falls back to useEffect. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
import { CheckIcon } from './controls';

/* -------------------------------------------------------------------------- */
/* Portal                                                                     */
/* -------------------------------------------------------------------------- */

export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Mount-once hydration guard: portals cannot render during SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* -------------------------------------------------------------------------- */
/* Popover                                                                    */
/* -------------------------------------------------------------------------- */

type PopoverOptions = { align?: 'start' | 'end'; gap?: number; matchWidth?: boolean };

export function usePopover({ align = 'end', gap = 8, matchWidth = false }: PopoverOptions = {}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      const trigger = triggerRef.current;
      window.setTimeout(() => trigger?.focus?.({ preventScroll: true }), 0);
    }
  }, []);

  const toggle = useCallback(() => setOpen(value => !value), []);

  /** Stable ref callback: trigger elements register themselves after render. */
  const setTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    // The menu lives in a portal, and the portal mounts one commit later than
    // this effect. Positioning therefore retries for a few frames: without it a
    // race left the menu with `top/left: auto` (static position at the end of
    // the document, far outside the viewport) roughly half the time.
    let frame = 0;
    let attempts = 0;
    const place = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) {
        if (attempts < 30) { attempts += 1; frame = requestAnimationFrame(place); }
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const width = matchWidth ? rect.width : Math.max(menu.offsetWidth, 200);
      const height = menu.offsetHeight;
      const rtl = document.documentElement.dir === 'rtl';
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Logical alignment: `start` hugs the inline-start edge of the trigger.
      let left: number;
      if (matchWidth) left = rect.left;
      else if (align === 'start') left = rtl ? rect.right - width : rect.left;
      else left = rtl ? rect.left : rect.right - width;
      left = Math.max(12, Math.min(left, vw - width - 12));
      const below = rect.bottom + gap;
      const above = rect.top - height - gap;
      const placeBelow = below + height <= vh - 12 || above < 12;
      const top = placeBelow ? below : above;
      const next = {
        left,
        top: Math.max(12, Math.min(top, vh - height - 12)),
        width: matchWidth ? width : undefined,
        '--cp-origin': placeBelow ? 'top center' : 'bottom center',
      } as CSSProperties;
      setStyle(current => (current.left === next.left && current.top === next.top && current.width === next.width ? current : next));
    };
    place();
    frame = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    }, 30);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, align, gap, matchWidth, close]);

  /** Arrow-key navigation inside the menu. */
  const onMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % items.length
      : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }, []);

  return { open, setOpen, toggle, close, triggerRef, setTrigger, menuRef, style, onMenuKeyDown };
}

/* -------------------------------------------------------------------------- */
/* Menu items                                                                 */
/* -------------------------------------------------------------------------- */

export type MenuItem = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export function MenuList({
  items, value, onSelect, label, onRequestClose, onKeyDown,
}: {
  items: MenuItem[];
  value?: string;
  onSelect: (value: string) => void;
  label: string;
  onRequestClose: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="cp-menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          role="menuitemradio"
          aria-checked={value === item.value}
          className="cp-menu__item"
          disabled={item.disabled}
          onClick={() => { onSelect(item.value); onRequestClose(); }}
        >
          {item.icon}
          <span style={{ display: 'grid', gap: 2, textAlign: 'start' }}>
            <span>{item.label}</span>
            {item.description && (
              <small style={{ color: 'var(--cp-ink-3)', fontSize: 'var(--cp-text-caption)', fontWeight: 400 }}>
                {item.description}
              </small>
            )}
          </span>
          {value === item.value && <span className="cp-menu__check"><CheckIcon /></span>}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

export function Select({
  label, value, options, onChange, className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; description?: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const popover = usePopover({ align: 'start', matchWidth: true });
  const current = options.find(option => option.value === value);
  const id = useId();
  return (
    <>
      <button
        ref={popover.setTrigger}
        type="button"
        id={id}
        className={['cp-select', className ?? ''].filter(Boolean).join(' ')}
        aria-haspopup="menu"
        aria-expanded={popover.open}
        aria-label={label}
        onClick={popover.toggle}
      >
        <span>{current?.label ?? label}</span>
        <svg className="cp-select__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {popover.open && (
        <Portal>
          <div ref={popover.menuRef} className={`cp-popover${popover.style.top === undefined ? ' cp-popover--measuring' : ''}`} style={popover.style} role="presentation">
            <MenuList
              label={label}
              items={options}
              value={value}
              onSelect={onChange}
              onRequestClose={() => popover.close()}
              onKeyDown={popover.onMenuKeyDown}
            />
          </div>
        </Portal>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sheet                                                                      */
/* -------------------------------------------------------------------------- */

export function Sheet({
  open, onClose, title, description, children, footer, side = 'auto',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'auto' | 'bottom' | 'center';
}) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const dragState = useRef<{ startY: number; delta: number; active: boolean }>({ startY: 0, delta: 0, active: false });

  // Sheet exit animation state machine: the panel must stay mounted for 220 ms.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- entering the open phase is the state machine
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    const timer = window.setTimeout(() => { setVisible(false); setClosing(false); }, 220);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const focusable = sheetRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus({ preventScroll: true });
    }, 60);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = bodyOverflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(element => element.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragState.current = { startY: event.clientY, delta: 0, active: true };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state.active) return;
    state.delta = Math.max(0, event.clientY - state.startY);
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${state.delta}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };
  const onPointerUp = () => {
    const state = dragState.current;
    state.active = false;
    if (!sheetRef.current) return;
    sheetRef.current.style.transition = '';
    sheetRef.current.style.transform = '';
    if (state.delta > 96) onClose();
  };

  if (!visible) return null;

  const resolvedSide = side === 'auto'
    ? (typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches ? 'center' : 'bottom')
    : side;

  return (
    <Portal>
      <div className={`cp-sheet-scrim${closing ? ' is-closing' : ''}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`cp-sheet${resolvedSide === 'center' ? ' cp-sheet--center' : ''}${closing ? ' is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? `${title}-desc` : undefined}
      >
        {resolvedSide === 'bottom' && (
          <div
            className="cp-sheet__handle"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden="true"
          >
            <span />
          </div>
        )}
        <header className="cp-sheet__head">
          <div>
            <h2>{title}</h2>
            {description && (
              <p id={`${title}-desc`} style={{ marginBlockStart: 4, fontSize: 'var(--cp-text-caption)', color: 'var(--cp-ink-2)' }}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className="cp-icon-btn" data-size="sm" aria-label={description ? `${title} — close` : 'Close'} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="cp-sheet__body">{children}</div>
        {footer && <footer className="cp-sheet__foot">{footer}</footer>}
      </div>
    </Portal>
  );
}

/* -------------------------------------------------------------------------- */
/* Select-like menu button (header controls)                                  */
/* -------------------------------------------------------------------------- */

export function MenuButton({
  label, value, items, onSelect, children, triggerClassName,
}: {
  label: string;
  value: string;
  items: MenuItem[];
  onSelect: (value: string) => void;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const popover = usePopover({ align: 'end' });
  const select = (next: string) => { onSelect(next); popover.close(); };
  return (
    <>
      <button
        ref={popover.setTrigger}
        type="button"
        className={triggerClassName ?? 'cp-icon-btn'}
        aria-haspopup="menu"
        aria-expanded={popover.open}
        aria-label={label}
        title={label}
        onClick={popover.toggle}
      >
        {children}
      </button>
      {popover.open && (
        <Portal>
          <div ref={popover.menuRef} className={`cp-popover${popover.style.top === undefined ? ' cp-popover--measuring' : ''}`} style={popover.style}>
            <MenuList
              label={label}
              items={items}
              value={value}
              onSelect={select}
              onRequestClose={() => popover.close()}
              onKeyDown={popover.onMenuKeyDown}
            />
          </div>
        </Portal>
      )}
    </>
  );
}
