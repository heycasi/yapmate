/**
 * Runtime Configuration Module
 *
 * Centralized access to environment variables with validation.
 * Used across the app to check configuration state without crashing.
 */

// Supabase Configuration
export function hasSupabaseConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  return url
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  }
  return key
}

// RevenueCat Configuration (iOS billing)
export function hasRevenueCatKey(): boolean {
  return !!process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY
}

export function getRevenueCatKey(): string {
  const key = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY
  if (!key) {
    throw new Error('NEXT_PUBLIC_REVENUECAT_IOS_API_KEY is not configured')
  }
  return key
}

// Platform Detection
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false

  // Check if running in Capacitor iOS app
  const isCapacitor = !!(window as any).Capacitor
  const platform = (window as any).Capacitor?.getPlatform?.() || ''

  return isCapacitor && platform === 'ios'
}

export function isWeb(): boolean {
  if (typeof window === 'undefined') return true

  // Not Capacitor, or explicitly web platform
  const isCapacitor = !!(window as any).Capacitor
  const platform = (window as any).Capacitor?.getPlatform?.() || 'web'

  return !isCapacitor || platform === 'web'
}

// Billing Configuration Check
export function isBillingConfigured(): boolean {
  // Web doesn't need billing configured
  if (isWeb()) return true

  // iOS needs RevenueCat key
  if (isIOS()) {
    const hasKey = hasRevenueCatKey()

    // Debug logging (only in development)
    if (!hasKey && typeof window !== 'undefined') {
      console.error('[BillingConfig] RevenueCat key missing!')
      console.error('[BillingConfig] Platform: iOS')
      console.error('[BillingConfig] Key present:', hasKey)
      console.error('[BillingConfig] Check .env.local for NEXT_PUBLIC_REVENUECAT_IOS_API_KEY')
    }

    return hasKey
  }

  return false
}

export function getBillingNotConfiguredMessage(): string {
  if (isIOS() && !hasRevenueCatKey()) {
    return 'Billing not configured. Please contact support.'
  }
  return 'Billing not available on this platform.'
}

// Feature Flags
export function isBillingEnabled(): boolean {
  // Check if billing is explicitly disabled via env var
  const disabled = process.env.NEXT_PUBLIC_BILLING_DISABLED === 'true'
  return !disabled && isBillingConfigured()
}

/**
 * Check if Trade tier is enabled
 *
 * Trade tier disabled for v1.0 App Store submission.
 * Set NEXT_PUBLIC_ENABLE_TRADE_TIER=true to re-enable.
 *
 * When re-enabling:
 * 1. Set env var to true
 * 2. Add Trade product to RevenueCat offering
 * 3. Submit Trade IAP in App Store Connect
 * 4. Rebuild and deploy
 */
export function isTradeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_TRADE_TIER === 'true'
}
