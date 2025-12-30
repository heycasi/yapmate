/**
 * useSubscription Hook
 *
 * React hook for checking user subscription status and entitlements.
 * Automatically syncs with both Supabase subscriptions table and user_preferences.
 *
 * Usage:
 *   const { plan, isActive, canUseVAT, canUseCIS, isLoading } = useSubscription()
 */

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { getUserPlan, canUseVAT as checkVATAccess, canUseCIS as checkCISAccess, type PricingPlan } from '@/lib/plan-access'

export interface SubscriptionStatus {
  plan: PricingPlan
  isActive: boolean
  canUseVAT: boolean
  canUseCIS: boolean
  isLoading: boolean
  expiresAt: Date | null
}

export function useSubscription(): SubscriptionStatus {
  const [status, setStatus] = useState<SubscriptionStatus>({
    plan: 'free',
    isActive: false,
    canUseVAT: false,
    canUseCIS: false,
    isLoading: true,
    expiresAt: null,
  })

  useEffect(() => {
    loadSubscriptionStatus()
  }, [])

  const loadSubscriptionStatus = async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setStatus({
          plan: 'free',
          isActive: false,
          canUseVAT: false,
          canUseCIS: false,
          isLoading: false,
          expiresAt: null,
        })
        return
      }

      // Get plan from user_preferences
      const plan = await getUserPlan(session.user.id)

      // Get subscription record if exists
      const { data: subscription } = await (supabase
        .from('subscriptions') as any)
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      // Check if subscription is active
      const isActive = subscription
        ? subscription.status === 'active' &&
          (!subscription.current_period_end ||
            new Date(subscription.current_period_end) > new Date())
        : false

      // Get feature access
      const vatAccess = await checkVATAccess(session.user.id)
      const cisAccess = await checkCISAccess(session.user.id)

      setStatus({
        plan: isActive ? subscription.plan : plan,
        isActive,
        canUseVAT: vatAccess,
        canUseCIS: cisAccess,
        isLoading: false,
        expiresAt: subscription?.current_period_end
          ? new Date(subscription.current_period_end)
          : null,
      })
    } catch (error) {
      console.error('Failed to load subscription status:', error)
      setStatus({
        plan: 'free',
        isActive: false,
        canUseVAT: false,
        canUseCIS: false,
        isLoading: false,
        expiresAt: null,
      })
    }
  }

  return status
}

/**
 * Utility function to check if a user has an active subscription
 * (non-React version for use in API routes, etc.)
 */
export async function checkActiveSubscription(userId: string): Promise<{
  isActive: boolean
  plan: PricingPlan
  expiresAt: Date | null
}> {
  const supabase = createBrowserClient()

  const { data: subscription } = await (supabase
    .from('subscriptions') as any)
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!subscription) {
    const plan = await getUserPlan(userId)
    return { isActive: false, plan, expiresAt: null }
  }

  const isActive =
    subscription.status === 'active' &&
    (!subscription.current_period_end ||
      new Date(subscription.current_period_end) > new Date())

  return {
    isActive,
    plan: isActive ? subscription.plan : 'free',
    expiresAt: subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null,
  }
}
