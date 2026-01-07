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

        // Get RevenueCat API key from env
        const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY

        if (!apiKey) {
          console.error('[IAP] NEXT_PUBLIC_REVENUECAT_IOS_API_KEY not set')
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
        console.log('[IAP] Initialized successfully (anonymous mode)')

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
