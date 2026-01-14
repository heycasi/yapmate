/**
 * Plan-based access control
 * Centralized logic for checking feature access based on user pricing plan
 *
 * Implements entitlement-first access (Guideline 5.1.1):
 * 1. Check RevenueCat entitlements first (works without login)
 * 2. Fall back to Supabase user_preferences.plan (requires login)
 */

import { createBrowserClient } from '@/lib/supabase'
import { getCustomerInfo, getActivePlan, isIAPAvailable } from '@/lib/iap'
import { isTradeEnabled } from '@/lib/runtime-config'

// ============================================================================
// Types and Constants
// ============================================================================

export type PricingPlan = 'free' | 'pro' | 'trade'

export interface UserPlan {
  plan: PricingPlan
  userId: string
}

export interface PlanLimits {
  maxInvoices: number | null // null = unlimited
  canUseVAT: boolean
  canUseCIS: boolean
}

// Configurable limits
export const FREE_PLAN_INVOICE_LIMIT = 3

// Plan feature matrix
const PLAN_LIMITS: Record<PricingPlan, PlanLimits> = {
  free: {
    maxInvoices: FREE_PLAN_INVOICE_LIMIT,
    canUseVAT: false,
    canUseCIS: false,
  },
  pro: {
    maxInvoices: null, // unlimited
    canUseVAT: true,
    canUseCIS: false,
  },
  trade: {
    maxInvoices: null, // unlimited
    canUseVAT: true,
    canUseCIS: true,
  },
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the user's current pricing plan
 * Entitlement-first: Checks RevenueCat first, then Supabase
 *
 * @param userId - Optional Supabase user ID (not required for logged-out users)
 * @returns Current pricing plan
 */
export async function getUserPlan(userId?: string): Promise<PricingPlan> {
  // Step 1: Check RevenueCat entitlements (works without login)
  if (isIAPAvailable()) {
    try {
      const customerInfo = await getCustomerInfo()

      if (customerInfo) {
        const plan = getActivePlan(customerInfo)
        console.log('[PlanAccess] Plan from RevenueCat:', plan)

        if (plan !== 'free') {
          return plan
        }
      }
    } catch (error) {
      console.warn('[PlanAccess] Failed to check RevenueCat:', error)
    }
  }

  // Step 2: Fall back to Supabase (requires user ID)
  if (userId) {
    try {
      const supabase = createBrowserClient()

      const { data, error } = await (supabase
        .from('user_preferences') as any)
        .select('plan')
        .eq('user_id', userId)
        .single()

      if (!error && data) {
        console.log('[PlanAccess] Plan from Supabase:', data.plan)
        return data.plan as PricingPlan
      }
    } catch (error) {
      console.warn('[PlanAccess] Failed to fetch user plan from Supabase:', error)
    }
  }

  // Default: Free plan
  console.log('[PlanAccess] No active plan found, defaulting to free')
  return 'free'
}

/**
 * Get plan limits for a specific plan
 */
export function getPlanLimits(plan: PricingPlan): PlanLimits {
  return PLAN_LIMITS[plan]
}

/**
 * Get the current invoice count for a user
 */
export async function getUserInvoiceCount(userId: string): Promise<number> {
  const supabase = createBrowserClient()

  const { count, error } = await (supabase
    .from('invoices') as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to fetch invoice count:', error)
    return 0
  }

  return count || 0
}

/**
 * Check if a user can create a new invoice
 * Returns { canCreate: boolean, reason?: string }
 *
 * @param userId - Optional Supabase user ID (logged-in users only have invoice counts)
 */
export async function canCreateInvoice(
  userId?: string
): Promise<{ canCreate: boolean; reason?: string; currentCount?: number; limit?: number }> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  // Pro and Trade have unlimited invoices
  if (limits.maxInvoices === null) {
    return { canCreate: true }
  }

  // Free plan - check current count (only if logged in)
  if (!userId) {
    // Not logged in + free plan: can create, but won't persist to DB
    console.warn('[PlanAccess] Not logged in - invoice will not be saved to cloud')
    return { canCreate: true, limit: limits.maxInvoices }
  }

  const currentCount = await getUserInvoiceCount(userId)

  if (currentCount >= limits.maxInvoices) {
    return {
      canCreate: false,
      reason: `You've reached the limit of ${limits.maxInvoices} invoices on the free plan`,
      currentCount,
      limit: limits.maxInvoices,
    }
  }

  return { canCreate: true, currentCount, limit: limits.maxInvoices }
}

/**
 * Check if a user can use VAT features
 * Works for both logged-in and logged-out users (via RevenueCat)
 */
export async function canUseVAT(userId?: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)
  return limits.canUseVAT
}

/**
 * Check if a user can use CIS features
 * Works for both logged-in and logged-out users (via RevenueCat)
 *
 * NOTE: CIS features are Trade-only. Always returns false when Trade tier is disabled.
 */
export async function canUseCIS(userId?: string): Promise<boolean> {
  // CIS is a Trade-only feature - disabled when Trade tier is disabled
  if (!isTradeEnabled()) {
    return false
  }

  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)
  return limits.canUseCIS
}

/**
 * Get plan display name
 *
 * NOTE: When Trade tier is disabled, 'trade' users are shown as 'Pro'
 */
export function getPlanDisplayName(plan: PricingPlan): string {
  // When Trade is disabled, show Trade users as Pro
  if (plan === 'trade' && !isTradeEnabled()) {
    return 'Pro'
  }

  const names: Record<PricingPlan, string> = {
    free: 'Free',
    pro: 'Pro',
    trade: 'Trade',
  }
  return names[plan]
}
