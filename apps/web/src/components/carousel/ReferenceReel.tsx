import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';

type Language = 'ar' | 'en';
type Props = {language: Language; autoAdvance: boolean; reduceMotion: boolean; paused: boolean};

/** Category cards preserve the reel while avoiding unverified title claims. */
export default function ReferenceReel({language, autoAdvance, reduceMotion, paused}: Props) {
  const ar = language === 'ar';
  const [active, setActive] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [inView, setInView] = useState(false);
  const [systemReduce, setSystemReduce] = useState(false);
  const root = useRef<HTMLElement>(null);
  const touchStart = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const cards = [
    {id:'exclusive', title:ar ? 'الحصريات' : 'Exclusives', description:ar ? 'ستظهر الأعمال الحصرية هنا عند توفير حقوقها.' : 'Exclusive titles will appear when their rights are secured.', tag:ar ? 'اختيارات خاصة' : 'SPECIAL PICKS', note:ar ? 'لا توجد حصريات مؤكدة حالياً' : 'No confirmed exclusives yet', href:'/exclusive', action:ar ? 'صفحة الحصريات' : 'View exclusives'},
    {id:'latest', title:ar ? 'الأفلام الحديثة' : 'New films', description:ar ? 'اكتشف الإصدارات الحديثة عند إضافتها بترخيص.' : 'Discover recent releases when licensed titles are added.', tag:ar ? 'أحدث الإصدارات' : 'NEW RELEASES', note:ar ? 'لا توجد أفلام حديثة حالياً' : 'No recent films yet', href:'/latest', action:ar ? 'صفحة الأفلام الحديثة' : 'View new films'},
    {id:'about', title:ar ? 'عن المنصة' : 'About Cloud Play', description:ar ? 'تعرف على المكتبة والمفضلة ومتابعة المشاهدة.' : 'Learn about the library, favorites and watch progress.', tag:ar ? 'كلاود بلاي' : 'CLOUD PLAY', note:ar ? 'تجربة المشاهدة وتفاصيلها' : 'The viewing experience', href:'/about', action:ar ? 'تفاصيل المنصة' : 'Platform details'},
  ];
  const step = (delta: number) => setActive(i => (i + delta + cards.length) % cards.length);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduce(media.matches);
    update();
    if (media.addEventListener) media.addEventListener('change', update); else media.addListener(update);
    return () => { if (media.removeEventListener) media.removeEventListener('change', update); else media.removeListener(update); };
  }, []);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) { Promise.resolve().then(() => setInView(true)); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {threshold: .25});
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!autoAdvance || reduceMotion || systemReduce || paused || interacting || !inView) return;
    const timer = window.setInterval(() => {
      const node = root.current;
      const hovered = window.matchMedia('(hover: hover)').matches && node?.matches(':hover');
      const focused = node?.contains(document.activeElement);
      if (!document.hidden && !hovered && !focused) setActive(i => (i + 1) % cards.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [autoAdvance, reduceMotion, systemReduce, paused, interacting, inView, cards.length]);
  const automatic = autoAdvance && !reduceMotion && !systemReduce && !paused && !interacting && inView;
  return <section ref={root} className="cp-reel shell" role="region" aria-roledescription={ar ? 'عرض دوّار' : 'carousel'} aria-label={ar ? 'استكشف كلاود بلاي' : 'Explore Cloud Play'} onMouseEnter={() => setInteracting(true)} onMouseLeave={e => setInteracting(e.currentTarget.contains(document.activeElement))} onFocusCapture={() => setInteracting(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInteracting(e.currentTarget.matches(':hover')); }} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); } }}>
    <div className="cp-reel-header"><div><span className="cp-reel-kicker">{ar ? 'عالم كلاود بلاي' : 'THE CLOUD PLAY EDIT'}</span><h2>{ar ? 'قصص بانتظارك' : 'Stories to discover'}</h2><p>{ar ? 'الحصريات والأفلام الحديثة وتفاصيل المنصة.' : 'Exclusives, new films and platform details.'}</p></div><span className="cp-reel-count" aria-hidden="true">0{active + 1} <i/> 0{cards.length}</span></div>
    <div className="cp-reel-world">
      <div className="cp-reel-aura" aria-hidden="true"/><div className="cp-reel-stars" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      <div className="cp-reel-stage" onTouchStart={e => { touchStart.current = e.touches[0]?.clientX ?? null; didSwipe.current = false; }} onTouchEnd={e => { if (touchStart.current === null) return; const delta = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) { didSwipe.current = true; step(delta < 0 ? 1 : -1); window.setTimeout(() => { didSwipe.current = false; }, 500); } touchStart.current = null; }} onClickCapture={e => { if (didSwipe.current) { e.preventDefault(); e.stopPropagation(); didSwipe.current = false; } }}>
        {cards.map((card, i) => {
          const offset = (i - active + cards.length) % cards.length;
          const position = offset === 0 ? 'center' : offset === 1 ? 'right' : offset === cards.length - 1 ? 'left' : 'back';
          return <article key={card.id} className={`cp-reel-card cp-reel-${position} cp-reel-color-${i}`} aria-hidden={position === 'back' ? true : undefined}>
            <div className="cp-reel-card-glow" aria-hidden="true"/><div className="cp-reel-card-top"><span>CLOUD PLAY</span><span>0{i + 1}</span></div>
            <div className="cp-reel-card-content"><span className="cp-reel-tag">{card.tag}</span><h3 dir="auto">{card.title}</h3><p dir={ar ? 'rtl' : 'ltr'}>{card.description}</p></div>
            <div className="cp-reel-card-bottom"><span>{card.note}</span>{position === 'center' && <Link href={card.href} className="cp-reel-link">{card.action}<span aria-hidden="true">↗</span></Link>}</div>
            {(position === 'left' || position === 'right') && <button className="cp-reel-select" type="button" onClick={() => { setActive(i); window.requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('.cp-reel-center .cp-reel-link')?.focus({preventScroll: true})); }} aria-label={`${ar ? 'عرض' : 'Show'} ${card.title}`}/>}
          </article>;
        })}
      </div>
      <div className="cp-reel-controls" dir="ltr"><button type="button" onClick={() => step(-1)} aria-label={ar ? 'السابق' : 'Previous'}>‹</button><div className="cp-reel-dots" role="group" aria-label={ar ? 'اختيار البطاقة' : 'Choose a slide'}>{cards.map((card, i) => <button key={card.id} type="button" onClick={() => setActive(i)} aria-label={`${ar ? 'عرض' : 'Show'} ${card.title}`} aria-current={i === active ? 'true' : undefined} className={i === active ? 'active' : ''}/>)}</div><button type="button" onClick={() => step(1)} aria-label={ar ? 'التالي' : 'Next'}>›</button></div>
      <span className="cp-reel-sr" aria-live={automatic ? 'off' : 'polite'}>{`${active + 1} / ${cards.length}: ${cards[active].title}`}</span>
    </div>
  </section>;
}
