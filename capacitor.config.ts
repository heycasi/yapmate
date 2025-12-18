import type { CapacitorConfig } from '@capacitor/cli'

// ==========================================
// DEVELOPMENT MODE TOGGLE
// ==========================================
// Set to true for local development with live reload
// Set to false for production builds (TestFlight/App Store)
const DEV_MODE = false

// Local dev server URL (update with your machine's IP)
const DEV_URL = 'http://192.168.1.108:3000'

// Production URL (your deployed Next.js app)
// Leave empty string to use bundled files from webDir
const PROD_URL = ''
// ==========================================

const config: CapacitorConfig = {
  appId: 'com.yapmate.app',
  appName: 'YapMate',
  webDir: 'out',

  // Server config: DEV uses live reload, PROD uses bundled files
  ...(DEV_MODE ? {
    server: {
      url: DEV_URL,
      cleartext: true,
      androidScheme: 'https',
    },
  } : {}),

  ios: {
    contentInset: 'always',
  },
}

export default config
