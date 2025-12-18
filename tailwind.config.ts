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
        // Industrial Utility Palette - High Contrast Only
        yapmate: {
          // Legacy (landing page only - will be removed)
          yellow: '#ffc422',
          gold: {
            DEFAULT: '#F2C94C',
            dark: '#E2B649',
            darker: '#B48828',
          },
          gray: {
            light: '#9CA3AF',
            DEFAULT: '#6B7280',
            dark: '#1A1A1A',
            lightest: '#F2F2F2',
          },
          // INDUSTRIAL SYSTEM - Sharp, High Contrast
          black: '#000000',        // Pure black (dark mode background)
          white: '#FFFFFF',        // Pure white (light mode background)
          slate: {
            // Only extreme values - no mid-tones
            300: '#cbd5e1',        // Light mode borders
            700: '#334155',        // Dark mode borders
            900: '#0f172a',        // Dark mode surface (rare use)
          },
          // Status Colors - Construction/Safety Palette
          status: {
            yellow: '#FACC15',     // Construction Yellow (warning)
            orange: '#F97316',     // Alert Orange (attention)
            green: '#22C55E',      // Success Green (paid)
            red: '#EF4444',        // Critical Red (error)
          },
          // Accent - Active state only
          amber: '#f59e0b',        // Single amber value
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
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
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        // Data-first sizing: numbers > labels
        'data-value': ['1.5rem', { lineHeight: '1.2', fontWeight: '600' }],
        'data-value-lg': ['2rem', { lineHeight: '1.1', fontWeight: '700' }],
        'data-label': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '500' }],
        'section-header': ['0.75rem', { lineHeight: '1', letterSpacing: '0.1em', fontWeight: '600' }],
      },
      backgroundImage: {
        // Keep for legacy landing page only
        'yapmate-gradient': 'linear-gradient(to bottom right, #F2C94C, #E2B649)',
        'yapmate-glow': 'radial-gradient(circle, rgba(255,196,34,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        // Remove all soft shadows - use hard drop shadow only
        'hard': '0 2px 0 0 rgba(0, 0, 0, 0.5)',
        // Keep legacy for landing page
        'yapmate-glow': '0 0 30px rgba(255, 196, 34, 0.3)',
        'yapmate-button': '0 10px 25px rgba(242, 201, 76, 0.3)',
      },
      transitionTimingFunction: {
        // Only linear - no easing
        'industrial': 'linear',
      },
      transitionDuration: {
        // Fast, mechanical transitions only
        'snap': '100ms',
      },
      animation: {
        // Remove pulse-slow - no playful animations
      },
    },
  },
  plugins: [],
}
export default config
