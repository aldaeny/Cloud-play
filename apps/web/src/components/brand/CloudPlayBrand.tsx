import Image from 'next/image';

/** The symbol is kept at its source aspect ratio; the wordmark is live text. */
export default function CloudPlayBrand() {
  return <span className="cloudplay-brand" dir="ltr">
    <span className="cloudplay-symbol">
      <Image className="cloudplay-symbol-dark" src="/art/mark-dark.png" width={157} height={160} alt="" unoptimized/>
      <Image className="cloudplay-symbol-light" src="/art/mark-light.png" width={157} height={160} alt="" unoptimized/>
    </span>
    <span className="cloudplay-type"><span className="cloudplay-name"><b>Cloud</b> <span>Play</span></span><small>ENTERTAINMENT ANYWHERE</small></span>
  </span>;
}
