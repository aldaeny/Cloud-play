/**
 * Tailwind is SCOPED to the new IPTV channel UI only.
 *
 * The rest of Cloud Play ships hand-written CSS with its own reset. Emitting
 * Tailwind's preflight or unprefixed utilities globally would restyle every
 * existing page, so:
 *   - `prefix: 'tw-'`      → no generated class can collide with existing ones.
 *   - `preflight: false`   → the app's own base styles stay authoritative.
 *   - `content`            → only the channel/player components are scanned.
 *   - `important: '.cp-tw'`   → utilities only win inside the new subtree.
 */
module.exports = {
  prefix: 'tw-',
  important: '.cp-tw',
  content: [
    './src/components/channels/**/*.{ts,tsx}',
    './src/components/player/VideoPlayerModal.tsx',
  ],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // Channel UI follows the Liquid Glass semantic layer instead of owning a
        // second palette: dark/light, Arabic/English share one set of variables.
        ink: 'var(--cp-ink)',
        panel: 'var(--cp-glass-fill)',
        panelHover: 'var(--cp-glass-fill-3)',
        line: 'var(--cp-glass-rim)',
        muted: 'var(--cp-ink-3)',
        accent: 'var(--cp-accent)',
        accentHover: 'var(--cp-accent-strong)',
        violet: 'var(--cp-glass-rim-strong)',
        brandDark: 'var(--cp-bg)',
        brandCard: 'var(--cp-glass-solid)',
        cyanGlow: 'var(--cp-accent)',
        magentaGlow: 'var(--cp-accent-magenta)',
        violetGlow: 'var(--cp-accent-strong)',
        amberGlow: 'var(--cp-warning)',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      keyframes: {
        'cp-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'cp-pop-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'cp-live-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.25' } },
      },
      animation: {
        'cp-fade-in': 'cp-fade-in .18s ease-out both',
        'cp-pop-in': 'cp-pop-in .22s cubic-bezier(.2,.8,.3,1) both',
        'cp-live-pulse': 'cp-live-pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
