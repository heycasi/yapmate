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
  console.log('[sync-revenuecat] ========================================')
  console.log('[sync-revenuecat] ===== EDGE FUNCTION INVOKED =====')
  console.log('[sync-revenuecat] Timestamp:', new Date().toISOString())
  console.log('[sync-revenuecat] Method:', req.method)

  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      console.log('[sync-revenuecat] Handling CORS preflight')
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
    console.log('[sync-revenuecat] Auth header present:', !!authHeader)

    if (!authHeader) {
      console.error('[sync-revenuecat] ❌ No Authorization header')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[sync-revenuecat] Creating Supabase client with user auth...')
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
    console.log('[sync-revenuecat] Getting authenticated user...')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[sync-revenuecat] ❌ Auth error:', authError.message)
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!user) {
      console.error('[sync-revenuecat] ❌ No user found')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[sync-revenuecat] ✓ Authenticated user:', user.id)
    console.log('[sync-revenuecat] User email:', user.email)

    // Parse request body
    let body: any
    try {
      body = await req.json()
    } catch (parseError: any) {
      console.error('[sync-revenuecat] ❌ Failed to parse request body:', parseError.message)
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { customerInfo, revenuecatCustomerId, correlationId } = body

    // Log correlation ID for tracing (from client)
    const syncCorrelationId = correlationId || `server_${Date.now()}`
    console.log('[sync-revenuecat] Correlation ID:', syncCorrelationId)

    if (!customerInfo) {
      console.error('[sync-revenuecat] ❌ customerInfo missing from request')
      console.error('[sync-revenuecat] Correlation ID:', syncCorrelationId)
      return new Response(JSON.stringify({ error: 'customerInfo required', correlationId: syncCorrelationId }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[sync-revenuecat] ===== REQUEST DATA =====')
    console.log('[sync-revenuecat] Correlation ID:', syncCorrelationId)
    console.log('[sync-revenuecat] revenuecatCustomerId:', revenuecatCustomerId)
    console.log('[sync-revenuecat] originalAppUserId:', customerInfo.originalAppUserId)
    console.log('[sync-revenuecat] entitlements.active:', JSON.stringify(customerInfo.entitlements?.active || {}))
    console.log('[sync-revenuecat] entitlements.all:', JSON.stringify(customerInfo.entitlements?.all || {}))
    console.log('[sync-revenuecat] ========================')

    // Extract entitlement data
    const { entitlements } = customerInfo
    const activeEntitlements = entitlements?.active || {}

    // Determine plan based on active entitlements
    // NOTE: When Trade tier is disabled (v1.0), Trade entitlements are treated as Pro
    // Check NEXT_PUBLIC_ENABLE_TRADE_TIER environment variable
    const isTradeEnabled = Deno.env.get('NEXT_PUBLIC_ENABLE_TRADE_TIER') === 'true'

    let plan: 'free' | 'pro' | 'trade' = 'free'
    let status: 'active' | 'trialing' | 'expired' | 'cancelled' = 'expired'
    let expirationDate: string | null = null
    let willRenew = false

    // Trade takes precedence (higher tier)
    // When Trade is disabled, treat as Pro
    if (activeEntitlements.trade?.isActive) {
      plan = isTradeEnabled ? 'trade' : 'pro'
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

    console.log('[sync-revenuecat] ===== PLAN DETERMINATION =====')
    console.log('[sync-revenuecat] Determined plan:', plan)
    console.log('[sync-revenuecat] Determined status:', status)
    console.log('[sync-revenuecat] Expiration date:', expirationDate)
    console.log('[sync-revenuecat] Will renew:', willRenew)
    console.log('[sync-revenuecat] =============================')

    // Use service role for database operations (bypass RLS)
    console.log('[sync-revenuecat] Creating admin client with service role...')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('[sync-revenuecat] Service role key present:', !!serviceRoleKey)

    if (!serviceRoleKey) {
      console.error('[sync-revenuecat] ❌ SUPABASE_SERVICE_ROLE_KEY not set!')
      return new Response(
        JSON.stringify({ error: 'Server configuration error', details: 'Missing service role key' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    // Build the subscription record
    const rcCustomerId = revenuecatCustomerId || customerInfo.originalAppUserId

    // Validate RevenueCat customer ID - required by database constraint
    if (!rcCustomerId) {
      console.error('[sync-revenuecat] ❌ No RevenueCat customer ID available!')
      console.error('[sync-revenuecat] revenuecatCustomerId:', revenuecatCustomerId)
      console.error('[sync-revenuecat] originalAppUserId:', customerInfo.originalAppUserId)
      return new Response(
        JSON.stringify({
          error: 'Missing RevenueCat customer ID',
          details: 'Neither revenuecatCustomerId nor originalAppUserId was provided',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('[sync-revenuecat] RevenueCat customer ID:', rcCustomerId)

    const subscriptionRecord = {
      user_id: user.id,
      provider: 'revenuecat',
      revenuecat_customer_id: rcCustomerId,
      plan,
      status,
      current_period_end: expirationDate,
      updated_at: new Date().toISOString(),
    }

    console.log('[sync-revenuecat] ===== DATABASE UPSERT =====')
    console.log('[sync-revenuecat] Table: subscriptions')
    console.log('[sync-revenuecat] Record:', JSON.stringify(subscriptionRecord))
    console.log('[sync-revenuecat] Conflict key: user_id')
    console.log('[sync-revenuecat] ===========================')

    // Upsert subscription record
    const { data: subData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subscriptionRecord, { onConflict: 'user_id' })
      .select()

    console.log('[sync-revenuecat] Upsert result - data:', JSON.stringify(subData))
    console.log('[sync-revenuecat] Upsert result - error:', subError ? JSON.stringify(subError) : 'null')

    if (subError) {
      console.error('[sync-revenuecat] ❌ Subscription upsert FAILED!')
      console.error('[sync-revenuecat] Correlation ID:', syncCorrelationId)
      console.error('[sync-revenuecat] Error code:', subError.code)
      console.error('[sync-revenuecat] Error message:', subError.message)
      console.error('[sync-revenuecat] Error details:', subError.details)
      console.error('[sync-revenuecat] Error hint:', subError.hint)
      return new Response(
        JSON.stringify({
          error: 'Failed to update subscription',
          details: subError.message,
          code: subError.code,
          hint: subError.hint,
          correlationId: syncCorrelationId,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('[sync-revenuecat] ✓ Subscription upserted successfully')

    // Update user_preferences.plan to match subscription
    console.log('[sync-revenuecat] Updating user_preferences...')
    const { data: prefData, error: prefError } = await supabaseAdmin
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
      .select()

    if (prefError) {
      console.error('[sync-revenuecat] ⚠️ User preferences update failed:', prefError.message)
      // Don't fail the request if this fails - subscription is more important
    } else {
      console.log('[sync-revenuecat] ✓ User preferences updated')
    }

    console.log('[sync-revenuecat] ===== SYNC SUCCESSFUL =====')
    console.log('[sync-revenuecat] Correlation ID:', syncCorrelationId)
    console.log('[sync-revenuecat] ========================================')

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        status,
        expirationDate,
        willRenew,
        correlationId: syncCorrelationId,
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
