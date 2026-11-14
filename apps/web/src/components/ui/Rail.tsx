'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import Icon from '../icons/Icon';
import { IconButton } from './controls';

/**
 * A horizontal content rail with a glass header and direction-aware arrows.
 * Native scrolling handles touch/trackpad; the arrows are a pointer affordance
 * that scrolls the correct way in RTL and LTR without re-measuring the DOM.
 */
export default function Rail({
  title, subtitle, action, actionHref, children, id,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  actionHref?: string;
  children: ReactNode;
  id?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    const node = scroller.current;
    if (!node) return;
    const rtl = document.documentElement.dir === 'rtl';
    const amount = Math.max(240, node.clientWidth * 0.72) * direction * (rtl ? -1 : 1);
    node.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="cp-rail-section" aria-labelledby={id}>
      <div className="cp-rail-head shell">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="cp-rail-head__actions">
          {action && actionHref && (
            <Link href={actionHref} className="cp-btn" data-variant="ghost" data-size="sm">
              {action}
              <Icon name="arrow" size={15} />
            </Link>
          )}
          <span className="cp-rail-arrows">
            <IconButton label="‹" size="sm" plain onClick={() => scroll(-1)}>
              <Icon name="arrow" size={16} />
            </IconButton>
            <IconButton label="›" size="sm" plain onClick={() => scroll(1)}>
              <Icon name="arrow" size={16} />
            </IconButton>
          </span>
        </div>
      </div>
      <div className="cp-rail" ref={scroller}>{children}</div>
    </section>
  );
}
