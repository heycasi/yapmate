/**
 * ⚠️ LEGACY / UNUSED ⚠️
 *
 * This edge function is DEPRECATED and should NOT be used.
 *
 * It has been replaced by:
 * - RevenueCat SDK (@revenuecat/purchases-capacitor)
 * - sync-revenuecat edge function
 *
 * This function used direct Apple receipt verification which is:
 * 1. Deprecated by Apple (verifyReceipt API is being sunset)
 * 2. Less secure than server-to-server notifications
 * 3. Doesn't support cross-platform subscription management
 *
 * DO NOT call this function from the app.
 * DO NOT remove this file without migrating all historical subscriptions.
 *
 * To enable for emergency/migration use only, set:
 * ENABLE_LEGACY_IAP=true in Supabase Edge Function secrets
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Apple IAP Verification URLs
const PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

// Product ID to Plan mapping
const PRODUCT_TO_PLAN: Record<string, 'pro' | 'trade'> = {
  'com.yapmate.pro.monthly': 'pro',
  'com.yapmate.trade.monthly': 'trade',
}

interface AppleReceiptResponse {
  status: number
  latest_receipt_info?: Array<{
    original_transaction_id: string
    product_id: string
    expires_date_ms: string
    cancellation_date_ms?: string
  }>
  receipt?: {
    in_app?: Array<{
      original_transaction_id: string
      product_id: string
      expires_date_ms?: string
      cancellation_date_ms?: string
    }>
  }
}

serve(async (req) => {
  try {
    // HARD GUARD: Block all requests unless explicitly enabled
    const legacyEnabled = Deno.env.get('ENABLE_LEGACY_IAP') === 'true'
    if (!legacyEnabled) {
      return new Response(
        JSON.stringify({
          error: 'This endpoint is deprecated and no longer in use',
          message: 'Please use RevenueCat SDK for in-app purchases',
          migrationGuide: 'See supabase/functions/sync-revenuecat/index.ts',
        }),
        {
          status: 410, // 410 Gone - resource no longer available
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get authenticated user
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { receiptData } = await req.json()
    if (!receiptData) {
      return new Response(
        JSON.stringify({ error: 'Missing receiptData' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Apple shared secret (from App Store Connect)
    const appleSharedSecret = Deno.env.get('APPLE_IAP_SHARED_SECRET')
    if (!appleSharedSecret) {
      console.error('APPLE_IAP_SHARED_SECRET not configured')
      return new Response(
        JSON.stringify({ error: 'IAP verification not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Try production first, fallback to sandbox
    let verificationResponse = await verifyWithApple(
      PRODUCTION_URL,
      receiptData,
      appleSharedSecret
    )

    // Status 21007 means sandbox receipt sent to production
    if (verificationResponse.status === 21007) {
      console.log('Sandbox receipt detected, retrying with sandbox URL')
      verificationResponse = await verifyWithApple(
        SANDBOX_URL,
        receiptData,
        appleSharedSecret
      )
    }

    // Check verification status
    if (verificationResponse.status !== 0) {
      console.error('Apple verification failed:', verificationResponse.status)
      return new Response(
        JSON.stringify({
          error: 'Receipt verification failed',
          appleStatus: verificationResponse.status,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract subscription info
    const latestReceipt = verificationResponse.latest_receipt_info?.[0] ||
      verificationResponse.receipt?.in_app?.[0]

    if (!latestReceipt) {
      return new Response(
        JSON.stringify({ error: 'No subscription found in receipt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const {
      original_transaction_id,
      product_id,
      expires_date_ms,
      cancellation_date_ms,
    } = latestReceipt

    // Map product ID to plan
    const plan = PRODUCT_TO_PLAN[product_id]
    if (!plan) {
      console.error('Unknown product ID:', product_id)
      return new Response(
        JSON.stringify({ error: 'Unknown subscription product' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if subscription is active
    const expiresAt = expires_date_ms ? new Date(parseInt(expires_date_ms)) : null
    const isActive = expiresAt && expiresAt > new Date() && !cancellation_date_ms
    const status = isActive ? 'active' : cancellation_date_ms ? 'cancelled' : 'expired'

    // Upsert subscription record
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          apple_transaction_id: original_transaction_id,
          stripe_subscription_id: null,
          plan: isActive ? plan : 'free',
          status,
          current_period_start: expiresAt
            ? new Date(expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000)
            : null,
          current_period_end: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (subError) {
      console.error('Failed to upsert subscription:', subError)
      throw subError
    }

    // Update user_preferences.plan to match active subscription
    const { error: prefError } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          plan: isActive ? plan : 'free',
        },
        { onConflict: 'user_id' }
      )

    if (prefError) {
      console.error('Failed to update user preferences:', prefError)
      // Don't fail the request - subscription is saved
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan: isActive ? plan : 'free',
        status,
        expiresAt: expiresAt?.toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Verify IAP error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function verifyWithApple(
  url: string,
  receiptData: string,
  password: string
): Promise<AppleReceiptResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password,
      'exclude-old-transactions': true,
    }),
  })

  if (!response.ok) {
    throw new Error(`Apple API error: ${response.status}`)
  }

  return await response.json()
}
