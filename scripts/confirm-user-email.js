#!/usr/bin/env node

/**
 * One-off script to manually confirm a user's email in Supabase
 *
 * Usage:
 *   node scripts/confirm-user-email.js cd14295@icloud.com
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const EMAIL_TO_CONFIRM = process.argv[2] || 'cd14295@icloud.com'

async function confirmUserEmail(email) {
  console.log(`\n[Confirm Email] Starting for: ${email}`)
  console.log('─'.repeat(60))

  // Validate env vars (support both NEXT_PUBLIC_ and non-prefixed vars)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required env vars:')
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗')
    console.error('\nEnsure these are set in .env.local')
    process.exit(1)
  }

  // Create admin client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('✓ Admin client created')

  try {
    // Step 1: Find user by email
    console.log(`\n[1/3] Searching for user: ${email}`)

    const { data: users, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Failed to list users:', listError.message)
      process.exit(1)
    }

    const user = users.users.find(u => u.email === email)

    if (!user) {
      console.error(`\n❌ User not found: ${email}`)
      console.error('   No user with this email exists in the database.')
      process.exit(1)
    }

    console.log(`✓ User found: ${user.id}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Email confirmed: ${user.email_confirmed_at ? 'YES' : 'NO'}`)
    console.log(`  Created at: ${user.created_at}`)

    // Step 2: Check if already confirmed
    if (user.email_confirmed_at) {
      console.log(`\n✓ Email already confirmed at: ${user.email_confirmed_at}`)
      console.log('  No action needed.')
      process.exit(0)
    }

    // Step 3: Confirm email
    console.log(`\n[2/3] Confirming email for user: ${user.id}`)

    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    )

    if (updateError) {
      console.error('❌ Failed to confirm email:', updateError.message)
      process.exit(1)
    }

    console.log('✓ Email confirmed successfully!')
    console.log(`  User ID: ${updatedUser.user.id}`)
    console.log(`  Email: ${updatedUser.user.email}`)
    console.log(`  Confirmed at: ${updatedUser.user.email_confirmed_at}`)

    // Step 4: Verify update
    console.log(`\n[3/3] Verifying update...`)

    const { data: verifyUser, error: verifyError } = await supabase.auth.admin.getUserById(user.id)

    if (verifyError) {
      console.error('⚠️  Failed to verify update:', verifyError.message)
      process.exit(1)
    }

    if (verifyUser.user.email_confirmed_at) {
      console.log('✓ Verification successful!')
      console.log(`  User ${email} can now log in without email confirmation.`)
    } else {
      console.error('❌ Verification failed - email_confirmed_at is still null')
      process.exit(1)
    }

    console.log('\n' + '─'.repeat(60))
    console.log('✅ COMPLETE: Email confirmed successfully')
    console.log('─'.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

// Run
confirmUserEmail(EMAIL_TO_CONFIRM)
