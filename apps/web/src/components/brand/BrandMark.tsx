/**
 * The Cloud Play symbol, drawn — not rasterised.
 *
 * A white ring with an open right side, and a gradient play head inside it. It
 * matches the shipped mark (art/mark-*.png) but stays crisp at any size and can
 * follow the appearance tokens, so the identity screen never ships a second,
 * slightly different logo.
 */
export default function BrandMark({
  size = 200,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Cloud Play"
    >
      <defs>
        <linearGradient id="cp-play-head" x1="66" y1="58" x2="132" y2="142" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5cc8ff" />
          <stop offset="0.45" stopColor="#7b6bff" />
          <stop offset="0.78" stopColor="#e256c9" />
          <stop offset="1" stopColor="#ff9a3c" />
        </linearGradient>
        <linearGradient id="cp-ring" x1="40" y1="34" x2="160" y2="168" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f2f4ff" />
          <stop offset="1" stopColor="#dfe4f7" />
        </linearGradient>
        <filter id="cp-head-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.62  0 0 0 0 0.35  0 0 0 0 0.95  0 0 0 0.55 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* The C: an arc that opens to the right, round caps, optical thickness. */}
      <path
        d="M150 47.5A74 74 0 1 0 150 152.5"
        stroke="url(#cp-ring)"
        strokeWidth="25"
        strokeLinecap="round"
      />
      {/* Play head, nudged into the bowl of the C. */}
      <path
        d="M76 64.5c0-5.4 5.8-8.8 10.6-6.2l50.6 27.6c9.6 5.3 9.6 19.1 0 24.4l-50.6 27.6c-4.8 2.6-10.6-.8-10.6-6.2V64.5Z"
        fill="url(#cp-play-head)"
        filter="url(#cp-head-glow)"
      />
      <path
        d="M78.5 72.4c0-2.2 2.4-3.6 4.3-2.5l44.2 24.1c3.5 1.9 3.5 7 0 8.9L82.8 127c-1.9 1.1-4.3-.3-4.3-2.5V72.4Z"
        fill="rgba(255,255,255,0.22)"
      />
    </svg>
  );
}
