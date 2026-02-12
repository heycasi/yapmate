#!/usr/bin/env npx tsx
/**
 * List all beta invites
 *
 * Usage:
 *   npx tsx scripts/list-beta.ts [--active-only]
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (NOT anon key)
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
  process.exit(1)
}

const activeOnly = process.argv.includes('--active-only')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function listBetaInvites() {
  let query = supabase.from('beta_invites').select('*').order('created_at', { ascending: false })

  if (activeOnly) {
    query = query.gt('expires_at', new Date().toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log(activeOnly ? 'No active beta invites found.' : 'No beta invites found.')
    return
  }

  console.log(`\n${activeOnly ? 'Active ' : ''}Beta Invites (${data.length}):\n`)
  console.log('Email'.padEnd(35) + 'Plan'.padEnd(8) + 'Expires'.padEnd(14) + 'Status')
  console.log('-'.repeat(70))

  const now = new Date()
  for (const invite of data) {
    const expiresAt = new Date(invite.expires_at)
    const isExpired = expiresAt < now
    const status = isExpired ? 'EXPIRED' : 'ACTIVE'
    const statusColor = isExpired ? '\x1b[31m' : '\x1b[32m'

    console.log(
      invite.email.padEnd(35) +
        invite.plan.padEnd(8) +
        expiresAt.toLocaleDateString('en-GB').padEnd(14) +
        statusColor +
        status +
        '\x1b[0m'
    )
  }
  console.log('')
}

listBetaInvites()
