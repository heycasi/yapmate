/**
 * IAP Subscription Sync
 *
 * Syncs RevenueCat customer info to Supabase subscriptions table.
 * Should be called after purchase, restore, or when checking subscription status.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { IAPCustomerInfo } from './iap'

export interface SyncResult {
  success: boolean
  plan?: 'free' | 'pro' | 'trade'
  status?: 'active' | 'trialing' | 'expired' | 'cancelled'
  expirationDate?: string | null
  willRenew?: boolean
  error?: string
}

/**
 * Sync RevenueCat customer info to Supabase
 *
 * @param customerInfo - RevenueCat customer info from purchase/restore
 * @param revenuecatCustomerId - Optional RevenueCat customer ID
 */
export async function syncSubscription(
  customerInfo: IAPCustomerInfo,
  revenuecatCustomerId?: string
): Promise<SyncResult> {
  try {
    const supabase = createClientComponentClient()

    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      // [GUIDELINE 5.1.1] Allow purchases without session
      // Subscription is active in RevenueCat, will sync when user logs in
      console.log('[IAP Sync] No session - subscription active locally via RevenueCat')
      return {
        success: true,
        plan: 'free', // Will be updated when user logs in
      }
    }

    // Call edge function
    const response = await supabase.functions.invoke('sync-revenuecat', {
      body: {
        customerInfo,
        revenuecatCustomerId,
      },
    })

    if (response.error) {
      console.error('[IAP Sync] Failed:', response.error)
      return {
        success: false,
        error: response.error.message || 'Sync failed',
      }
    }

    const result = response.data

    console.log('[IAP Sync] Success:', result)

    return {
      success: true,
      plan: result.plan,
      status: result.status,
      expirationDate: result.expirationDate,
      willRenew: result.willRenew,
    }
  } catch (error: any) {
    console.error('[IAP Sync] Error:', error)
    return {
      success: false,
      error: error.message || 'Sync failed',
    }
  }
}

/**
 * Check and sync subscription status
 *
 * Useful for checking subscription state on app resume or after login.
 * Returns the current plan without requiring a purchase.
 */
export async function checkSubscriptionStatus(): Promise<SyncResult> {
  try {
    // This would call getCustomerInfo and sync, but that's done
    // automatically by the IAPProvider, so this is mostly for manual checks

    const supabase = createClientComponentClient()

    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return {
        success: false,
        error: 'No active session',
      }
    }

    // Query current subscription from Supabase
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, provider')
      .eq('user_id', session.user.id)
      .single()

    if (error || !subscription) {
      return {
        success: true,
        plan: 'free',
        status: 'expired',
      }
    }

    return {
      success: true,
      plan: subscription.plan as 'free' | 'pro' | 'trade',
      status: subscription.status as 'active' | 'trialing' | 'expired' | 'cancelled',
      expirationDate: subscription.current_period_end,
    }
  } catch (error: any) {
    console.error('[IAP Sync] Check failed:', error)
    return {
      success: false,
      error: error.message || 'Check failed',
    }
  }
}
