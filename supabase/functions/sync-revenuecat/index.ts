import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Sync RevenueCat Subscription to Supabase
 *
 * Called from iOS app after purchase/restore.
 * Updates subscriptions table and user_preferences.plan based on RevenueCat entitlements.
 *
 * Security: Requires authenticated user, can only update own subscription.
 */

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const {
      customerInfo,
      revenuecatCustomerId,
    }: {
      customerInfo: any
      revenuecatCustomerId?: string
    } = await req.json()

    if (!customerInfo) {
      return new Response(JSON.stringify({ error: 'customerInfo required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[sync-revenuecat] Processing for user:', user.id)

    // Extract entitlement data
    const { entitlements } = customerInfo
    const activeEntitlements = entitlements?.active || {}

    // Determine plan based on active entitlements
    let plan: 'free' | 'pro' | 'trade' = 'free'
    let status: 'active' | 'trialing' | 'expired' | 'cancelled' = 'expired'
    let expirationDate: string | null = null
    let willRenew = false

    // Trade takes precedence (higher tier)
    if (activeEntitlements.trade?.isActive) {
      plan = 'trade'
      const ent = activeEntitlements.trade
      status = ent.periodType === 'TRIAL' || ent.periodType === 'INTRO' ? 'trialing' : 'active'
      expirationDate = ent.expirationDate
      willRenew = ent.willRenew
    } else if (activeEntitlements.pro?.isActive) {
      plan = 'pro'
      const ent = activeEntitlements.pro
      status = ent.periodType === 'TRIAL' || ent.periodType === 'INTRO' ? 'trialing' : 'active'
      expirationDate = ent.expirationDate
      willRenew = ent.willRenew
    }

    // If no active entitlements, check if expired
    if (plan === 'free' && Object.keys(entitlements.all || {}).length > 0) {
      status = 'expired'
    }

    console.log('[sync-revenuecat] Determined plan:', { plan, status, expirationDate })

    // Use service role for database operations (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Upsert subscription record
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          provider: 'revenuecat',
          revenuecat_customer_id: revenuecatCustomerId || customerInfo.originalAppUserId,
          plan,
          status,
          current_period_end: expirationDate,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (subError) {
      console.error('[sync-revenuecat] Subscription upsert failed:', subError)
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', details: subError.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Update user_preferences.plan to match subscription
    const { error: prefError } = await supabaseAdmin
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          plan,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (prefError) {
      console.error('[sync-revenuecat] User preferences update failed:', prefError)
      // Don't fail the request if this fails - subscription is more important
    }

    console.log('[sync-revenuecat] Sync successful')

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        status,
        expirationDate,
        willRenew,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('[sync-revenuecat] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
