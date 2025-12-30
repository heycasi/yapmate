/**
 * Plan-based access control
 * Centralized logic for checking feature access based on user pricing plan
 */

import { createBrowserClient } from '@/lib/supabase'

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
 * Returns 'free' if no plan is set (safe default)
 */
export async function getUserPlan(userId: string): Promise<PricingPlan> {
  const supabase = createBrowserClient()

  const { data, error } = await (supabase
    .from('user_preferences') as any)
    .select('plan')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.warn('Failed to fetch user plan, defaulting to free:', error)
    return 'free'
  }

  return data.plan as PricingPlan
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
 */
export async function canCreateInvoice(
  userId: string
): Promise<{ canCreate: boolean; reason?: string; currentCount?: number; limit?: number }> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  // Pro and Trade have unlimited invoices
  if (limits.maxInvoices === null) {
    return { canCreate: true }
  }

  // Free plan - check current count
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
 */
export async function canUseVAT(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)
  return limits.canUseVAT
}

/**
 * Check if a user can use CIS features
 */
export async function canUseCIS(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)
  return limits.canUseCIS
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(plan: PricingPlan): string {
  const names: Record<PricingPlan, string> = {
    free: 'Free',
    pro: 'Pro',
    trade: 'Trade',
  }
  return names[plan]
}
