'use client';

/**
 * Cloud Play — universal controls.
 *
 * These are the only button / segment / switch / slider implementations the
 * product uses. They preserve one contract across platforms:
 *   · keyboard focus is always visible and arrow keys work,
 *   · Android gets a material ripple, iOS a spring press,
 *   · every label is localized by the caller (no hard-coded copy),
 *   · geometry comes from the shared control tokens.
 */
import {
  forwardRef, useCallback, type ButtonHTMLAttributes, type CSSProperties,
  type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { haptic } from '../../lib/appearance';

/* -------------------------------------------------------------------------- */
/* Ripple                                                                     */
/* -------------------------------------------------------------------------- */

function canRipple() {
  return typeof document !== 'undefined' && document.documentElement.dataset.platform === 'android';
}

/** Adds a material ripple to any relatively-positioned, overflow-hidden host. */
export function useRipple() {
  return useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!canRipple()) return;
    const host = event.currentTarget;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'cp-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.insetInlineStart = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.insetBlockStart = `${event.clientY - rect.top - size / 2}px`;
    host.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }, []);
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'media';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  rounded?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'secondary', size = 'md', block, icon, trailing, rounded, className, children,
  onPointerDown, onClick, type = 'button', ...rest
}, ref) {
  const ripple = useRipple();
  const classes = [
    'cp-btn', block ? 'cp-btn--block' : '', rounded ? 'cp-btn--rounded' : '', className ?? '',
  ].filter(Boolean).join(' ');
  const dataVariant = variant === 'secondary' ? undefined : variant;
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      data-variant={dataVariant}
      data-size={size === 'md' ? undefined : size}
      onPointerDown={event => { onPointerDown?.(event); ripple(event); }}
      onClick={event => { haptic('light'); onClick?.(event); }}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  plain?: boolean;
  active?: boolean;
  badge?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  label, children, size = 'md', plain, active, badge, className, onPointerDown, onClick,
  type = 'button', ...rest
}, ref) {
  const ripple = useRipple();
  return (
    <button
      ref={ref}
      type={type}
      className={['cp-icon-btn', className ?? ''].filter(Boolean).join(' ')}
      data-size={size === 'md' ? undefined : size}
      data-variant={plain ? 'plain' : undefined}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onPointerDown={event => { onPointerDown?.(event); ripple(event); }}
      onClick={event => { haptic('light'); onClick?.(event); }}
      {...rest}
    >
      {children}
      {badge && <span className="cp-icon-btn__dot" aria-hidden="true" />}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export function Segmented<T extends string>({
  value, options, onChange, label, size = 'md', className,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const style = {
    '--cp-seg-count': options.length,
    '--cp-seg-index': index,
  } as CSSProperties;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const rtl = document.documentElement.dir === 'rtl';
    const forward = event.key === 'ArrowRight' ? !rtl : event.key === 'ArrowLeft' ? rtl : event.key === 'End';
    const next = forward
      ? Math.min(options.length - 1, index + 1)
      : Math.max(0, index - 1);
    if (event.key === 'Home') return onChange(options[0].value);
    if (event.key === 'End') return onChange(options[options.length - 1].value);
    if (next !== index) onChange(options[next].value);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={['cp-segmented', className ?? ''].filter(Boolean).join(' ')}
      data-size={size === 'lg' ? 'lg' : undefined}
      style={style}
      onKeyDown={onKeyDown}
    >
      <span className="cp-segmented__thumb" aria-hidden="true" />
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className="cp-segmented__item"
          aria-pressed={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => { haptic('selection'); onChange(option.value); }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                     */
/* -------------------------------------------------------------------------- */

export function Switch({
  checked, onChange, label, describedBy, disabled, size = 'md', id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  describedBy?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
}) {
  return (
    <label className="cp-switch" data-size={size === 'sm' ? 'sm' : undefined}>
      <input
        id={id}
        type="checkbox"
        className="cp-switch__input"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        onChange={event => { haptic('selection'); onChange(event.target.checked); }}
      />
      <span className="cp-switch__track" aria-hidden="true">
        <span className="cp-switch__knob" />
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Slider                                                                     */
/* -------------------------------------------------------------------------- */

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  /** 0–1 fill, independent of min/max (used by the player seek bar). */
  progress?: number;
};

export function Slider({
  value, min = 0, max = 100, step = 1, onChange, label, progress, className, ...rest
}: SliderProps) {
  const pct = progress !== undefined
    ? Math.max(0, Math.min(1, progress)) * 100
    : max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={['cp-slider', className ?? ''].filter(Boolean).join(' ')}
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      style={{ '--cp-slider-progress': `${pct}%` } as CSSProperties}
      onChange={event => onChange(Number(event.target.value))}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Check mark (menus, selections)                                              */
/* -------------------------------------------------------------------------- */

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
