/**
 * IAP Subscription Sync
 *
 * Syncs RevenueCat customer info to Supabase subscriptions table.
 * Should be called after purchase, restore, login, or when checking subscription status.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { IAPCustomerInfo } from './iap'
import { isIAPAvailable, linkUser, getCustomerInfo } from './iap'

export interface SyncResult {
  success: boolean
  plan?: 'free' | 'pro' | 'trade'
  status?: 'active' | 'trialing' | 'expired' | 'cancelled'
  expirationDate?: string | null
  willRenew?: boolean
  error?: string
  correlationId?: string
}

/**
 * Generate a correlation ID for tracing sync requests
 */
function generateCorrelationId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * CANONICAL SYNC FUNCTION
 *
 * Links RevenueCat user to Supabase user and syncs subscription data.
 * This is the SINGLE SOURCE OF TRUTH for syncing.
 *
 * Call this:
 * - After login
 * - On dashboard load (safety net)
 * - After purchase
 * - After restore
 *
 * @param userId - Supabase user ID
 * @returns SyncResult with plan/status or error
 */
export async function syncRevenueCatToSupabase(userId: string): Promise<SyncResult> {
  const correlationId = generateCorrelationId()

  console.log('[IAP Sync] ========================================')
  console.log('[IAP Sync] ===== SYNC START =====')
  console.log('[IAP Sync] Correlation ID:', correlationId)
  console.log('[IAP Sync] Timestamp:', new Date().toISOString())
  console.log('[IAP Sync] Supabase User ID:', userId)

  // Check if IAP is available (iOS only)
  if (!isIAPAvailable()) {
    console.log('[IAP Sync] Not on iOS, skipping sync')
    return { success: true, plan: 'free' }
  }

  try {
    // Step 1: Link RevenueCat user to Supabase user ID
    console.log('[IAP Sync] Step 1: Linking RevenueCat user...')
    const linkResult = await linkUser(userId)

    if (!linkResult.success) {
      console.error('[IAP Sync] Link failed:', linkResult.error)
      // Continue anyway - user might already be linked
    } else {
      console.log('[IAP Sync] Link successful')
    }

    // Step 2: Fetch fresh customer info from RevenueCat
    console.log('[IAP Sync] Step 2: Fetching customer info...')
    const customerInfo = await getCustomerInfo()

    if (!customerInfo) {
      console.warn('[IAP Sync] ⚠️ No customer info returned from RevenueCat')
      return { success: true, plan: 'free' }
    }

    // Log FULL RevenueCat state for debugging
    console.log('[IAP Sync] ===== REVENUECAT STATE =====')
    console.log('[IAP Sync] originalAppUserId:', customerInfo.originalAppUserId)
    console.log('[IAP Sync] activeSubscriptions:', JSON.stringify(customerInfo.activeSubscriptions))
    console.log('[IAP Sync] entitlements.active:', JSON.stringify(customerInfo.entitlements?.active || {}))
    console.log('[IAP Sync] entitlements.all:', JSON.stringify(customerInfo.entitlements?.all || {}))
    console.log('[IAP Sync] latestExpirationDate:', customerInfo.latestExpirationDate)
    console.log('[IAP Sync] ==============================')

    // Step 3: Check if there's anything to sync
    const hasActiveEntitlements = Object.keys(customerInfo.entitlements?.active || {}).length > 0
    const hasActiveSubscriptions = (customerInfo.activeSubscriptions?.length || 0) > 0

    console.log('[IAP Sync] hasActiveEntitlements:', hasActiveEntitlements)
    console.log('[IAP Sync] hasActiveSubscriptions:', hasActiveSubscriptions)

    // ALWAYS sync if user has any entitlements (active OR expired) to ensure DB is updated
    const hasAnyEntitlements = Object.keys(customerInfo.entitlements?.all || {}).length > 0

    if (!hasActiveEntitlements && !hasActiveSubscriptions && !hasAnyEntitlements) {
      console.log('[IAP Sync] No entitlements at all, nothing to sync')
      return { success: true, plan: 'free' }
    }

    // Step 4: Sync to Supabase (even if expired - to update status)
    console.log('[IAP Sync] Step 3: Calling edge function sync-revenuecat...')
    const syncResult = await syncSubscription(customerInfo, customerInfo.originalAppUserId, correlationId)

    console.log('[IAP Sync] ===== SYNC COMPLETE =====')
    console.log('[IAP Sync] Correlation ID:', correlationId)
    console.log('[IAP Sync] Result:', JSON.stringify(syncResult))
    console.log('[IAP Sync] ========================================')

    return { ...syncResult, correlationId }

  } catch (error: any) {
    console.error('[IAP Sync] ========================================')
    console.error('[IAP Sync] ===== SYNC FAILED =====')
    console.error('[IAP Sync] Correlation ID:', correlationId)
    console.error('[IAP Sync] Error:', error.message || error)
    console.error('[IAP Sync] Stack:', error.stack)
    console.error('[IAP Sync] ========================================')
    return {
      success: false,
      error: error.message || 'Sync failed',
      correlationId,
    }
  }
}

/**
 * Sync RevenueCat customer info to Supabase
 *
 * @param customerInfo - RevenueCat customer info from purchase/restore
 * @param revenuecatCustomerId - Optional RevenueCat customer ID
 * @param correlationId - Optional correlation ID for tracing
 */
export async function syncSubscription(
  customerInfo: IAPCustomerInfo,
  revenuecatCustomerId?: string,
  correlationId?: string
): Promise<SyncResult> {
  const syncCorrelationId = correlationId || generateCorrelationId()
  console.log('[IAP Sync] ===== syncSubscription START =====')
  console.log('[IAP Sync] Correlation ID:', syncCorrelationId)

  try {
    const supabase = createClientComponentClient()

    // Get current session
    console.log('[IAP Sync] Getting Supabase session...')
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      // [GUIDELINE 5.1.1] Allow purchases without session
      // Subscription is active in RevenueCat, will sync when user logs in
      console.log('[IAP Sync] ⚠️ No Supabase session - cannot call edge function')
      console.log('[IAP Sync] Subscription active locally via RevenueCat, will sync on login')
      return {
        success: true,
        plan: 'free', // Will be updated when user logs in
      }
    }

    console.log('[IAP Sync] ✓ Session found for user:', session.user.id)
    console.log('[IAP Sync] Session email:', session.user.email)

    // Prepare payload for edge function
    const payload = {
      customerInfo,
      revenuecatCustomerId,
      correlationId: syncCorrelationId,
    }

    console.log('[IAP Sync] ===== EDGE FUNCTION REQUEST =====')
    console.log('[IAP Sync] Function: sync-revenuecat')
    console.log('[IAP Sync] Correlation ID:', syncCorrelationId)
    console.log('[IAP Sync] revenuecatCustomerId:', revenuecatCustomerId)
    console.log('[IAP Sync] customerInfo.originalAppUserId:', customerInfo.originalAppUserId)
    console.log('[IAP Sync] customerInfo.entitlements.active:', JSON.stringify(customerInfo.entitlements?.active || {}))
    console.log('[IAP Sync] ================================')

    // Call edge function
    const response = await supabase.functions.invoke('sync-revenuecat', {
      body: payload,
    })

    console.log('[IAP Sync] ===== EDGE FUNCTION RESPONSE =====')
    console.log('[IAP Sync] response.error:', response.error ? JSON.stringify(response.error) : 'null')
    console.log('[IAP Sync] response.data:', JSON.stringify(response.data))
    console.log('[IAP Sync] =================================')

    if (response.error) {
      console.error('[IAP Sync] ❌ Edge function error:', response.error)
      console.error('[IAP Sync] Error message:', response.error.message)
      console.error('[IAP Sync] Error context:', response.error.context)
      return {
        success: false,
        error: response.error.message || 'Sync failed',
      }
    }

    const result = response.data

    if (!result) {
      console.error('[IAP Sync] ❌ Edge function returned null/undefined data')
      return {
        success: false,
        error: 'Edge function returned no data',
      }
    }

    if (result.error) {
      console.error('[IAP Sync] ❌ Edge function returned error in data:', result.error)
      console.error('[IAP Sync] Error details:', result.details)
      return {
        success: false,
        error: result.error,
      }
    }

    console.log('[IAP Sync] ✓ Edge function success!')
    console.log('[IAP Sync] Correlation ID:', syncCorrelationId)
    console.log('[IAP Sync] Synced plan:', result.plan)
    console.log('[IAP Sync] Synced status:', result.status)
    console.log('[IAP Sync] Expiration:', result.expirationDate)
    console.log('[IAP Sync] ===== syncSubscription COMPLETE =====')

    return {
      success: true,
      plan: result.plan,
      status: result.status,
      expirationDate: result.expirationDate,
      willRenew: result.willRenew,
      correlationId: syncCorrelationId,
    }
  } catch (error: any) {
    console.error('[IAP Sync] ===== syncSubscription EXCEPTION =====')
    console.error('[IAP Sync] Correlation ID:', syncCorrelationId)
    console.error('[IAP Sync] Error type:', error.constructor.name)
    console.error('[IAP Sync] Error message:', error.message)
    console.error('[IAP Sync] Error stack:', error.stack)
    return {
      success: false,
      error: error.message || 'Sync failed',
      correlationId: syncCorrelationId,
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
