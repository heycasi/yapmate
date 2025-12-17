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
        // YapMate Brand Colors - Tool-like Dark + Amber System
        yapmate: {
          // Legacy (keep for landing page)
          yellow: '#ffc422',
          gold: {
            DEFAULT: '#F2C94C',
            dark: '#E2B649',
            darker: '#B48828',
          },
          // New Design System
          black: '#000000',
          slate: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
            950: '#020617',
          },
          amber: {
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
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
      spacing: {
        'safe-top': 'max(1rem, env(safe-area-inset-top))',
        'safe-bottom': 'max(1rem, env(safe-area-inset-bottom))',
        'safe-left': 'max(1rem, env(safe-area-inset-left))',
        'safe-right': 'max(1rem, env(safe-area-inset-right))',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        'label': ['0.875rem', { letterSpacing: '0.05em', lineHeight: '1.25rem' }],
      },
      backgroundImage: {
        'yapmate-gradient': 'linear-gradient(to bottom right, #F2C94C, #E2B649)',
        'yapmate-glow': 'radial-gradient(circle, rgba(255,196,34,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'yapmate-glow': '0 0 30px rgba(255, 196, 34, 0.3)',
        'yapmate-button': '0 10px 25px rgba(242, 201, 76, 0.3)',
        'amber-glow': '0 0 20px rgba(245, 158, 11, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
export default config
