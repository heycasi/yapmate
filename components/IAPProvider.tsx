'use client'

/**
 * RevenueCat IAP Provider
 *
 * Initializes RevenueCat SDK on app startup (iOS only).
 * Links RevenueCat customer ID to Supabase user ID when user logs in.
 * Allows anonymous purchases (complies with App Review Guideline 5.1.1).
 */

import { useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { configureIAP, isIAPAvailable, linkUser } from '@/lib/iap'
import { syncSubscription } from '@/lib/iap-sync'

export function IAPProvider({ children }: { children: React.ReactNode }) {
  const hasConfigured = useRef(false)

  useEffect(() => {
    // Only configure on iOS
    if (!isIAPAvailable()) {
      return
    }

    const initializeIAP = async () => {
      try {
        const supabase = createClientComponentClient()

        // Debug: Log platform detection
        const platform = (window as any).Capacitor?.getPlatform?.() || 'web'
        console.log('[IAP] Platform detected:', platform)
        console.log('[IAP] isIAPAvailable:', isIAPAvailable())

        // Get RevenueCat API key from env
        const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY
        const hasApiKey = !!apiKey

        console.log('[IAP] API key present:', hasApiKey)

        if (!apiKey) {
          console.error('[IAP] NEXT_PUBLIC_REVENUECAT_IOS_API_KEY not set')
          console.error('[IAP] Cannot configure RevenueCat without API key')
          return
        }

        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // Configure anonymously first (allows purchases without account)
        // If logged in, we'll link the user below
        console.log('[IAP] Configuring RevenueCat...')
        await configureIAP(apiKey)

        hasConfigured.current = true
        console.log('[IAP] ✓ RevenueCat configured successfully (anonymous mode)')

        // Debug: Fetch and log offerings
        try {
          const { Purchases } = await import('@revenuecat/purchases-capacitor')
          const offerings = await Purchases.getOfferings()

          console.log('[IAP] Offerings fetched:')
          console.log('  - Current offering ID:', offerings?.current?.identifier || 'NONE')

          if (offerings?.current?.availablePackages) {
            const packages = offerings.current.availablePackages
            console.log('  - Available packages:', packages.length)
            packages.forEach((pkg: any) => {
              console.log('    • Package:', pkg.identifier)
              console.log('      Product ID:', pkg.product?.identifier)
              console.log('      Price:', pkg.product?.priceString)
            })
          } else {
            console.warn('[IAP] ⚠️ No packages available in current offering')
          }
        } catch (error) {
          console.error('[IAP] Failed to fetch offerings for debug:', error)
        }

        // If user is already logged in, link their account
        if (session?.user?.id) {
          console.log('[IAP] User logged in, linking to RevenueCat...')
          const linkResult = await linkUser(session.user.id)

          if (linkResult.success) {
            console.log('[IAP] User linked successfully')
          } else {
            console.error('[IAP] Failed to link user:', linkResult.error)
          }
        }
      } catch (error) {
        console.error('[IAP] Initialization failed:', error)
      }
    }

    // Only initialize once
    if (!hasConfigured.current) {
      initializeIAP()
    }

    // Listen for auth state changes to link users when they log in
    const supabase = createClientComponentClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!hasConfigured.current) {
        return
      }

      console.log('[IAP] Auth state changed:', event)

      if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log('[IAP] User signed in, linking to RevenueCat...')

        const linkResult = await linkUser(session.user.id)

        if (linkResult.success) {
          console.log('[IAP] User linked successfully, syncing subscriptions...')

          // Sync subscriptions to Supabase after linking
          try {
            const { Purchases } = await import('@revenuecat/purchases-capacitor')
            const customerInfo = await Purchases.getCustomerInfo()

            if (customerInfo?.customerInfo) {
              await syncSubscription(customerInfo.customerInfo as any)
            }
          } catch (error) {
            console.error('[IAP] Failed to sync after linking:', error)
          }
        } else {
          console.error('[IAP] Failed to link user:', linkResult.error)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
}
