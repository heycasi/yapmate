#!/usr/bin/env npx tsx
/**
 * Grant beta access to a user by email
 *
 * Usage:
 *   npx tsx scripts/grant-beta.ts <email> [days] [plan]
 *
 * Examples:
 *   npx tsx scripts/grant-beta.ts user@example.com           # 7 days of Pro
 *   npx tsx scripts/grant-beta.ts user@example.com 14        # 14 days of Pro
 *   npx tsx scripts/grant-beta.ts user@example.com 7 trade   # 7 days of Trade
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (NOT anon key)
 *
 * The script will:
 * 1. Upsert a row in beta_invites with the given email, plan, and expiry
 * 2. If the email already exists, it will update the plan and extend the expiry
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing environment variables')
  console.error('Required:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Parse arguments
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: npx tsx scripts/grant-beta.ts <email> [days] [plan]

Arguments:
  email   User's email address (required)
  days    Number of days for beta access (default: 7)
  plan    Plan to grant: 'pro' or 'trade' (default: 'pro')

Examples:
  npx tsx scripts/grant-beta.ts user@example.com
  npx tsx scripts/grant-beta.ts user@example.com 14
  npx tsx scripts/grant-beta.ts user@example.com 7 trade
`)
  process.exit(0)
}

const email = args[0]
const days = parseInt(args[1] || '7', 10)
const plan = args[2] || 'pro'

// Validate
if (!email.includes('@')) {
  console.error('Error: Invalid email address')
  process.exit(1)
}

if (isNaN(days) || days < 1 || days > 365) {
  console.error('Error: Days must be between 1 and 365')
  process.exit(1)
}

if (plan !== 'pro' && plan !== 'trade') {
  console.error("Error: Plan must be 'pro' or 'trade'")
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function grantBetaAccess() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  const normalizedEmail = email.toLowerCase()

  console.log(`\nGranting beta access:`)
  console.log(`  Email: ${normalizedEmail}`)
  console.log(`  Plan: ${plan}`)
  console.log(`  Days: ${days}`)
  console.log(`  Expires: ${expiresAt.toISOString()}`)
  console.log('')

  // Check if invite already exists (case-insensitive)
  const { data: existing } = await supabase
    .from('beta_invites')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .single()

  if (existing) {
    // Update existing invite
    const { data: updateData, error: updateError } = await supabase
      .from('beta_invites')
      .update({
        plan,
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating beta invite:', updateError.message)
      process.exit(1)
    }

    console.log('✅ Beta access UPDATED (existing invite)')
    console.log(`   ID: ${updateData.id}`)
    console.log(`   Email: ${updateData.email}`)
    console.log(`   Plan: ${updateData.plan}`)
    console.log(`   Expires: ${new Date(updateData.expires_at).toLocaleDateString('en-GB')}`)
    return
  }

  // Insert new invite
  const { data, error } = await supabase
    .from('beta_invites')
    .insert({
      email: normalizedEmail,
      plan,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error granting beta access:', error.message)
    process.exit(1)
  }

  console.log('✅ Beta access GRANTED (new invite)')
  console.log(`   ID: ${data.id}`)
  console.log(`   Email: ${data.email}`)
  console.log(`   Plan: ${data.plan}`)
  console.log(`   Expires: ${new Date(data.expires_at).toLocaleDateString('en-GB')}`)
}

grantBetaAccess()
