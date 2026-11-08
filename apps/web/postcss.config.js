/**
 * PostCSS pipeline for the scoped Tailwind layer (`src/styles/channel-ui.css`).
 * Tailwind runs with `preflight: false` and a `tw-` prefix, so the existing
 * hand-written stylesheets pass through untouched.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
