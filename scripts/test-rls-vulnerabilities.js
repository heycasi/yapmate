#!/usr/bin/env node

/**
 * RLS Vulnerability Test Script
 *
 * This script tests the RLS vulnerabilities before and after the fix
 * WARNING: This script attempts to exploit vulnerabilities - only run on test data!
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role bypasses RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testRLSVulnerabilities() {
  console.log('🧪 RLS Vulnerability Test Suite')
  console.log('='  .repeat(80))
  console.log('')

  console.log('⚠️  WARNING: This test creates temporary test data')
  console.log('⚠️  Using service role key (bypasses RLS for setup)')
  console.log('')

  let testResults = {
    passed: 0,
    failed: 0,
    errors: 0
  }

  try {
    // ========================================================================
    // SETUP: Create two test users and their data
    // ========================================================================
    console.log('📋 Setting up test data...\n')

    // Note: We can't create auth users via Supabase client, so we'll use existing users
    // or create dummy UUIDs for testing

    const userA_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'  // Test user A
    const userB_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'  // Test user B

    // Clean up any existing test data
    await supabase.from('invoices').delete().eq('user_id', userA_id)
    await supabase.from('invoices').delete().eq('user_id', userB_id)
    await supabase.from('customers').delete().eq('user_id', userA_id)
    await supabase.from('customers').delete().eq('user_id', userB_id)

    // Create customer for User A
    const { data: customerA, error: customerAError } = await supabase
      .from('customers')
      .insert({
        user_id: userA_id,
        name: 'Customer A',
        email: 'customer-a@test.com'
      })
      .select()
      .single()

    if (customerAError) {
      console.error('❌ Failed to create customer A:', customerAError)
      return
    }

    console.log(`✅ Created Customer A (ID: ${customerA.id}) for User A`)

    // Create customer for User B
    const { data: customerB, error: customerBError } = await supabase
      .from('customers')
      .insert({
        user_id: userB_id,
        name: 'Customer B',
        email: 'customer-b@test.com'
      })
      .select()
      .single()

    if (customerBError) {
      console.error('❌ Failed to create customer B:', customerBError)
      return
    }

    console.log(`✅ Created Customer B (ID: ${customerB.id}) for User B`)
    console.log('')

    // ========================================================================
    // TEST 1: Cross-User Invoice-Customer Association (CRITICAL)
    // ========================================================================
    console.log('🔍 TEST 1: Cross-User Invoice-Customer Association')
    console.log('-'.repeat(80))
    console.log('Attempting to create invoice for User B with Customer A (cross-user)...')

    const { data: maliciousInvoice, error: maliciousInvoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: userB_id,  // User B
        customer_id: customerA.id,  // Customer A (belongs to User A!)
        job_summary: 'Malicious cross-user invoice',
        labour_hours: 1,
        status: 'draft'
      })
      .select()
      .single()

    if (maliciousInvoiceError) {
      // This is expected AFTER the fix
      console.log('✅ PASS: Cross-user invoice creation blocked!')
      console.log(`   Error: ${maliciousInvoiceError.message}`)
      testResults.passed++
    } else {
      // This is a VULNERABILITY if it succeeds!
      console.log('❌ FAIL: Cross-user invoice creation succeeded!')
      console.log('   🚨 VULNERABILITY: User B successfully linked invoice to User A\'s customer')
      console.log(`   Invoice ID: ${maliciousInvoice.id}`)
      testResults.failed++

      // Clean up
      await supabase.from('invoices').delete().eq('id', maliciousInvoice.id)
    }

    console.log('')

    // ========================================================================
    // TEST 2: Same-User Invoice-Customer Association (Should Work)
    // ========================================================================
    console.log('🔍 TEST 2: Same-User Invoice-Customer Association (Valid)')
    console.log('-'.repeat(80))
    console.log('Attempting to create invoice for User A with Customer A (same user)...')

    const { data: validInvoice, error: validInvoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: userA_id,  // User A
        customer_id: customerA.id,  // Customer A (belongs to User A - OK!)
        job_summary: 'Valid same-user invoice',
        labour_hours: 1,
        status: 'draft'
      })
      .select()
      .single()

    if (validInvoiceError) {
      console.log('❌ FAIL: Same-user invoice creation blocked (should succeed)')
      console.log(`   Error: ${validInvoiceError.message}`)
      testResults.failed++
    } else {
      console.log('✅ PASS: Same-user invoice creation succeeded')
      console.log(`   Invoice ID: ${validInvoice.id}`)
      testResults.passed++

      // Clean up
      await supabase.from('invoices').delete().eq('id', validInvoice.id)
    }

    console.log('')

    // ========================================================================
    // TEST 3: Invoice with NULL customer_id (Should Work)
    // ========================================================================
    console.log('🔍 TEST 3: Invoice with NULL customer_id (Valid)')
    console.log('-'.repeat(80))
    console.log('Attempting to create invoice for User A with no customer...')

    const { data: nullCustomerInvoice, error: nullCustomerError } = await supabase
      .from('invoices')
      .insert({
        user_id: userA_id,  // User A
        customer_id: null,  // No customer - OK!
        customer_name: 'Cash Customer',
        job_summary: 'Invoice with no customer link',
        labour_hours: 1,
        status: 'draft'
      })
      .select()
      .single()

    if (nullCustomerError) {
      console.log('❌ FAIL: NULL customer_id invoice blocked (should succeed)')
      console.log(`   Error: ${nullCustomerError.message}`)
      testResults.failed++
    } else {
      console.log('✅ PASS: NULL customer_id invoice succeeded')
      console.log(`   Invoice ID: ${nullCustomerInvoice.id}`)
      testResults.passed++

      // Clean up
      await supabase.from('invoices').delete().eq('id', nullCustomerInvoice.id)
    }

    console.log('')

    // ========================================================================
    // TEST 4: UPDATE invoice to cross-user customer (CRITICAL)
    // ========================================================================
    console.log('🔍 TEST 4: UPDATE Invoice to Cross-User Customer')
    console.log('-'.repeat(80))

    // First create a valid invoice for User A
    const { data: updateTestInvoice, error: updateTestError } = await supabase
      .from('invoices')
      .insert({
        user_id: userA_id,
        customer_id: customerA.id,
        job_summary: 'Invoice for update test',
        labour_hours: 1,
        status: 'draft'
      })
      .select()
      .single()

    if (updateTestError) {
      console.log('❌ ERROR: Failed to create test invoice for update test')
      testResults.errors++
    } else {
      console.log('Attempting to UPDATE invoice to point to different user\'s customer...')

      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          customer_id: customerB.id  // Try to switch to User B's customer!
        })
        .eq('id', updateTestInvoice.id)
        .select()
        .single()

      if (updateError) {
        console.log('✅ PASS: Cross-user invoice update blocked!')
        console.log(`   Error: ${updateError.message}`)
        testResults.passed++
      } else {
        console.log('❌ FAIL: Cross-user invoice update succeeded!')
        console.log('   🚨 VULNERABILITY: User A successfully changed invoice to User B\'s customer')
        testResults.failed++
      }

      // Clean up
      await supabase.from('invoices').delete().eq('id', updateTestInvoice.id)
    }

    console.log('')

    // ========================================================================
    // CLEANUP: Remove test data
    // ========================================================================
    console.log('🧹 Cleaning up test data...')
    await supabase.from('customers').delete().eq('id', customerA.id)
    await supabase.from('customers').delete().eq('id', customerB.id)
    console.log('✅ Cleanup complete')
    console.log('')

    // ========================================================================
    // RESULTS
    // ========================================================================
    console.log('='  .repeat(80))
    console.log('📊 TEST RESULTS')
    console.log('='  .repeat(80))
    console.log(`✅ Passed: ${testResults.passed}`)
    console.log(`❌ Failed: ${testResults.failed}`)
    console.log(`⚠️  Errors: ${testResults.errors}`)
    console.log('')

    if (testResults.failed > 0) {
      console.log('🚨 VULNERABILITIES DETECTED!')
      console.log('')
      console.log('Next steps:')
      console.log('1. Run migration: npm run migrate')
      console.log('2. Re-run this test: node scripts/test-rls-vulnerabilities.js')
      console.log('')
      process.exit(1)
    } else if (testResults.passed === 4) {
      console.log('🎉 ALL TESTS PASSED! RLS policies are secure.')
      console.log('')
      process.exit(0)
    } else {
      console.log('⚠️  Some tests had errors. Review output above.')
      console.log('')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Test suite error:', error.message)
    process.exit(1)
  }
}

// Run tests
testRLSVulnerabilities()
