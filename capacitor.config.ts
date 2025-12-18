import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yapmate.app',
  appName: 'YapMate',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // DEV ONLY: Comment out before production build
    url: 'http://192.168.1.108:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
}

export default config
