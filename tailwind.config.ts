import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // YapMate Brand Colors - DeWalt-inspired
        yapmate: {
          yellow: '#F2C94C',      // Primary construction yellow
          black: '#000000',        // Pure black
          charcoal: '#1A1A1A',     // Secondary dark grey
          gold: '#E2B649',         // Accent gold (light)
          'gold-dark': '#B48828',  // Accent gold (dark)
        },
      },
    },
  },
  plugins: [],
}
export default config
