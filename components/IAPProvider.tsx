'use client'

/**
 * RevenueCat IAP Provider
 *
 * Initializes RevenueCat SDK on app startup (iOS only).
 * Links RevenueCat customer ID to Supabase user ID.
 */

import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { configureIAP, isIAPAvailable } from '@/lib/iap'

export function IAPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only configure on iOS
    if (!isIAPAvailable()) {
      return
    }

    const initializeIAP = async () => {
      try {
        const supabase = createClientComponentClient()

        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // Get RevenueCat API key from env
        const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY

        if (!apiKey) {
          console.error('[IAP] NEXT_PUBLIC_REVENUECAT_IOS_API_KEY not set')
          return
        }

        // Configure with Supabase user ID if logged in
        await configureIAP(apiKey, session?.user?.id)

        console.log('[IAP] Initialized successfully')
      } catch (error) {
        console.error('[IAP] Initialization failed:', error)
      }
    }

    initializeIAP()
  }, [])

  return <>{children}</>
}
