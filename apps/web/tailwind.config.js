/**
 * Tailwind Config for Aether Web Viewer (Stage 4)
 * Inspired by Cloud Play Design Reference
 */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brandDark: '#0a0a0c',
        brandCard: '#121217',
        cyanGlow: '#00e5ff',
        magentaGlow: '#ff2085',
        violetGlow: '#7b30ff',
        amberGlow: '#ffb000',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
