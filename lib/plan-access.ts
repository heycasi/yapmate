/**
 * Plan-based access control
 * Centralized logic for checking feature access based on user pricing plan
 *
 * Implements entitlement-first access (Guideline 5.1.1):
 * 1. Check RevenueCat entitlements first (works without login)
 * 2. Check beta_invites table by email (no-card beta access)
 * 3. Fall back to Supabase user_preferences.plan (requires login)
 */

import { createBrowserClient } from '@/lib/supabase'
import { getCustomerInfo, getActivePlan, isIAPAvailable } from '@/lib/iap'
import { isTradeEnabled } from '@/lib/runtime-config'

// ============================================================================
// Beta Invite Types
// ============================================================================

export interface BetaInvite {
  id: string
  email: string
  plan: PricingPlan
  expires_at: string
  created_at: string
}

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
  canUseBranding: boolean // Logo upload, custom colours, branded PDFs
}

// Configurable limits
export const FREE_PLAN_INVOICE_LIMIT = 3

// Plan feature matrix
const PLAN_LIMITS: Record<PricingPlan, PlanLimits> = {
  free: {
    maxInvoices: FREE_PLAN_INVOICE_LIMIT,
    canUseVAT: false,
    canUseCIS: false,
    canUseBranding: false,
  },
  pro: {
    maxInvoices: null, // unlimited
    canUseVAT: true,
    canUseCIS: false,
    canUseBranding: true,
  },
  trade: {
    maxInvoices: null, // unlimited
    canUseVAT: true,
    canUseCIS: true,
    canUseBranding: true,
  },
}

// ============================================================================
// Beta Invite Functions
// ============================================================================

/**
 * Check if user has an active beta invite by email
 * Returns the beta invite if active and not expired, null otherwise
 */
export async function checkBetaInvite(email: string): Promise<BetaInvite | null> {
  if (!email) return null

  try {
    const supabase = createBrowserClient()

    const { data, error } = await (supabase
      .from('beta_invites') as any)
      .select('*')
      .ilike('email', email)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return null
    }

    console.log('[PlanAccess] Active beta invite found:', data.plan, 'expires:', data.expires_at)
    return data as BetaInvite
  } catch (error) {
    console.warn('[PlanAccess] Failed to check beta invite:', error)
    return null
  }
}

/**
 * Get beta invite details for display in UI
 * Returns null if no active beta or user not logged in
 */
export async function getBetaInviteForUser(email?: string): Promise<BetaInvite | null> {
  if (!email) return null
  return checkBetaInvite(email)
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the user's current pricing plan
 * Entitlement-first: Checks RevenueCat first, then beta invite, then Supabase
 *
 * @param userId - Optional Supabase user ID (not required for logged-out users)
 * @param email - Optional user email (for beta invite check)
 * @returns Current pricing plan
 */
export async function getUserPlan(userId?: string, email?: string): Promise<PricingPlan> {
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

  // Step 2: Check beta invite by email
  if (email) {
    const betaInvite = await checkBetaInvite(email)
    if (betaInvite) {
      console.log('[PlanAccess] Plan from beta invite:', betaInvite.plan)
      return betaInvite.plan as PricingPlan
    }
  }

  // Step 3: Fall back to Supabase user_preferences (requires user ID)
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
 * @param email - Optional user email (for beta invite check)
 */
export async function canCreateInvoice(
  userId?: string,
  email?: string
): Promise<{ canCreate: boolean; reason?: string; currentCount?: number; limit?: number }> {
  const plan = await getUserPlan(userId, email)
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
 *
 * @param userId - Optional Supabase user ID
 * @param email - Optional user email (for beta invite check)
 */
export async function canUseVAT(userId?: string, email?: string): Promise<boolean> {
  const plan = await getUserPlan(userId, email)
  const limits = getPlanLimits(plan)
  return limits.canUseVAT
}

/**
 * Check if a user can use CIS features
 * Works for both logged-in and logged-out users (via RevenueCat)
 *
 * NOTE: CIS features are Trade-only. Always returns false when Trade tier is disabled.
 *
 * @param userId - Optional Supabase user ID
 * @param email - Optional user email (for beta invite check)
 */
export async function canUseCIS(userId?: string, email?: string): Promise<boolean> {
  // CIS is a Trade-only feature - disabled when Trade tier is disabled
  if (!isTradeEnabled()) {
    return false
  }

  const plan = await getUserPlan(userId, email)
  const limits = getPlanLimits(plan)
  return limits.canUseCIS
}

/**
 * Check if a user can use invoice branding features
 * (logo upload, custom colours, branded PDF invoices)
 *
 * Works for both logged-in and logged-out users (via RevenueCat)
 * Only Pro and Trade plans have branding access.
 *
 * @param userId - Optional Supabase user ID
 * @param email - Optional user email (for beta invite check)
 */
export async function canUseInvoiceBranding(userId?: string, email?: string): Promise<boolean> {
  const plan = await getUserPlan(userId, email)
  const limits = getPlanLimits(plan)
  const canUse = limits.canUseBranding

  // Logging for audit trail
  if (canUse) {
    console.log('[PlanAccess] branding_access_granted:', plan)
  } else {
    console.log('[PlanAccess] branding_blocked_free_user')
  }

  return canUse
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
