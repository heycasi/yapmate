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
        // YapMate Brand Colors
        yapmate: {
          black: '#000000',
          yellow: '#ffc422',
          gold: {
            DEFAULT: '#F2C94C',
            dark: '#E2B649',
            darker: '#B48828',
          },
          gray: {
            lightest: '#F2F2F2',
            light: '#9CA3AF',
            DEFAULT: '#666666',
            dark: '#1A1A1A',
            darker: '#0D0D0D',
          },
        },
      },
      backgroundImage: {
        'yapmate-gradient': 'linear-gradient(to bottom right, #F2C94C, #E2B649)',
        'yapmate-glow': 'radial-gradient(circle, rgba(255,196,34,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'yapmate-glow': '0 0 30px rgba(255, 196, 34, 0.3)',
        'yapmate-button': '0 10px 25px rgba(242, 201, 76, 0.3)',
      },
    },
  },
  plugins: [],
}
export default config
