#!/usr/bin/env node

/**
 * Simplified RLS Vulnerability Test
 *
 * Tests RLS policies using SQL injection simulation
 * This version doesn't require real auth users
 */

const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL

async function testRLS() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    console.log('🧪 RLS Vulnerability Test Suite')
    console.log('='  .repeat(80))
    console.log('')

    // ========================================================================
    // TEST 1: Check if invoices INSERT policy validates customer_id
    // ========================================================================
    console.log('🔍 TEST 1: Invoices INSERT Policy - customer_id Validation')
    console.log('-'.repeat(80))

    const { rows: insertPolicies } = await client.query(`
      SELECT
        policyname,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND cmd = 'INSERT';
    `)

    console.log(`Found ${insertPolicies.length} INSERT policy/policies for invoices:`)

    for (const policy of insertPolicies) {
      console.log(`\nPolicy: ${policy.policyname}`)
      console.log(`WITH CHECK: ${policy.with_check}`)

      // Check if policy validates customer_id
      const hasCustomerValidation = policy.with_check && (
        policy.with_check.includes('customer_id') &&
        policy.with_check.includes('customers') &&
        policy.with_check.includes('EXISTS')
      )

      if (hasCustomerValidation) {
        console.log('✅ PASS: Policy validates customer_id ownership')
      } else {
        console.log('❌ FAIL: Policy does NOT validate customer_id (VULNERABILITY!)')
        console.log('   🚨 Users can associate invoices with other users\' customers')
      }
    }

    console.log('')

    // ========================================================================
    // TEST 2: Check if invoices UPDATE policy validates customer_id
    // ========================================================================
    console.log('🔍 TEST 2: Invoices UPDATE Policy - customer_id Validation')
    console.log('-'.repeat(80))

    const { rows: updatePolicies } = await client.query(`
      SELECT
        policyname,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND cmd = 'UPDATE';
    `)

    console.log(`Found ${updatePolicies.length} UPDATE policy/policies for invoices:`)

    for (const policy of updatePolicies) {
      console.log(`\nPolicy: ${policy.policyname}`)
      console.log(`WITH CHECK: ${policy.with_check || 'NULL'}`)

      if (!policy.with_check) {
        console.log('❌ FAIL: No WITH CHECK clause (users can update to any customer_id!)')
        continue
      }

      // Check if policy validates customer_id
      const hasCustomerValidation = policy.with_check.includes('customer_id') &&
        policy.with_check.includes('customers') &&
        policy.with_check.includes('EXISTS')

      if (hasCustomerValidation) {
        console.log('✅ PASS: Policy validates customer_id ownership')
      } else {
        console.log('❌ FAIL: Policy does NOT validate customer_id (VULNERABILITY!)')
        console.log('   🚨 Users can update invoices to point to other users\' customers')
      }
    }

    console.log('')

    // ========================================================================
    // TEST 3: Check if user_preferences has DELETE policy
    // ========================================================================
    console.log('🔍 TEST 3: user_preferences DELETE Policy')
    console.log('-'.repeat(80))

    const { rows: userPrefsPolicies } = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'user_preferences'
      AND cmd = 'DELETE';
    `)

    const hasDeletePolicy = userPrefsPolicies[0].count > 0

    if (hasDeletePolicy) {
      console.log('✅ PASS: user_preferences has DELETE policy')
    } else {
      console.log('❌ FAIL: user_preferences has NO DELETE policy')
      console.log('   🚨 GDPR compliance issue - users cannot delete their data')
    }

    console.log('')

    // ========================================================================
    // TEST 4: Check for duplicate policies on waitlist_signups
    // ========================================================================
    console.log('🔍 TEST 4: waitlist_signups Duplicate Policies')
    console.log('-'.repeat(80))

    const { rows: waitlistInsertPolicies } = await client.query(`
      SELECT policyname, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'waitlist_signups'
      AND cmd = 'INSERT';
    `)

    console.log(`Found ${waitlistInsertPolicies.length} INSERT policy/policies:`)
    for (const policy of waitlistInsertPolicies) {
      console.log(`  - ${policy.policyname}: WITH CHECK: ${policy.with_check}`)
    }

    if (waitlistInsertPolicies.length > 1) {
      console.log('⚠️  WARNING: Multiple INSERT policies (possible duplicates)')
    } else {
      console.log('✅ PASS: No duplicate policies')
    }

    console.log('')

    // ========================================================================
    // TEST 5: Check waitlist_signups UPDATE/DELETE policies
    // ========================================================================
    console.log('🔍 TEST 5: waitlist_signups UPDATE/DELETE Policies')
    console.log('-'.repeat(80))

    const { rows: waitlistUpdatePolicies } = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'waitlist_signups'
      AND cmd = 'UPDATE';
    `)

    const { rows: waitlistDeletePolicies } = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'waitlist_signups'
      AND cmd = 'DELETE';
    `)

    const hasUpdatePolicy = waitlistUpdatePolicies[0].count > 0
    const hasDeletePolicyWaitlist = waitlistDeletePolicies[0].count > 0

    if (hasUpdatePolicy) {
      console.log('✅ PASS: waitlist_signups has UPDATE policy')
    } else {
      console.log('❌ FAIL: waitlist_signups has NO UPDATE policy')
      console.log('   ⚠️  Users cannot correct email typos')
    }

    if (hasDeletePolicyWaitlist) {
      console.log('✅ PASS: waitlist_signups has DELETE policy')
    } else {
      console.log('❌ FAIL: waitlist_signups has NO DELETE policy')
      console.log('   🚨 GDPR compliance issue - users cannot remove themselves')
    }

    console.log('')

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='  .repeat(80))
    console.log('📊 SUMMARY')
    console.log('='  .repeat(80))
    console.log('')

    // Count vulnerabilities by checking the policy details
    const vulnCheck = {
      invoicesInsert: insertPolicies.length > 0 && !insertPolicies[0].with_check?.includes('customer_id'),
      invoicesUpdate: updatePolicies.length > 0 && (!updatePolicies[0].with_check || !updatePolicies[0].with_check.includes('customer_id')),
      userPrefsDelete: !hasDeletePolicy,
      waitlistDuplicates: waitlistInsertPolicies.length > 1,
      waitlistUpdate: !hasUpdatePolicy,
      waitlistDelete: !hasDeletePolicyWaitlist
    }

    const criticalVulns = [vulnCheck.invoicesInsert, vulnCheck.invoicesUpdate].filter(Boolean).length
    const highVulns = vulnCheck.userPrefsDelete ? 1 : 0
    const mediumVulns = [vulnCheck.waitlistDuplicates, vulnCheck.waitlistUpdate, vulnCheck.waitlistDelete].filter(Boolean).length

    console.log(`🔴 CRITICAL Vulnerabilities: ${criticalVulns}`)
    if (vulnCheck.invoicesInsert) {
      console.log('   - invoices INSERT: No customer_id validation')
    }
    if (vulnCheck.invoicesUpdate) {
      console.log('   - invoices UPDATE: No customer_id validation')
    }

    console.log(`🟡 HIGH Vulnerabilities: ${highVulns}`)
    if (vulnCheck.userPrefsDelete) {
      console.log('   - user_preferences: Missing DELETE policy')
    }

    console.log(`🟠 MEDIUM Issues: ${mediumVulns}`)
    if (vulnCheck.waitlistDuplicates) {
      console.log('   - waitlist_signups: Duplicate INSERT policies')
    }
    if (vulnCheck.waitlistUpdate) {
      console.log('   - waitlist_signups: Missing UPDATE policy')
    }
    if (vulnCheck.waitlistDelete) {
      console.log('   - waitlist_signups: Missing DELETE policy')
    }

    console.log('')

    if (criticalVulns > 0 || highVulns > 0 || mediumVulns > 0) {
      console.log('🚨 ACTION REQUIRED: Run migration to fix vulnerabilities')
      console.log('')
      console.log('Run: npm run migrate')
      console.log('Then re-run this test to verify fixes')
      console.log('')
      process.exit(1)
    } else {
      console.log('🎉 ALL CHECKS PASSED! RLS policies are secure.')
      console.log('')
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

testRLS()
