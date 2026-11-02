import { useEffect, useState } from 'react';
import Image from 'next/image';

/** Opening sequence based on the user-supplied Cloud Play HTML. */
export default function IntroLayer() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 4300); return () => clearTimeout(timer); }, []);
  if (!visible) return null;
  return (
    <div className="intro-layer" aria-hidden="true">
      <div className="intro-wrap">
        <div className="intro-brand">
          <Image className="intro-logo-dark" src="/art/brand-dark-stacked.png" width={241} height={263} priority unoptimized alt=""/>
          <Image className="intro-logo-light" src="/art/brand-light-complete.png" width={358} height={113} priority unoptimized alt=""/>
        </div>
        <div className="intro-loader"><span/></div>
      </div>
    </div>
  );
}
