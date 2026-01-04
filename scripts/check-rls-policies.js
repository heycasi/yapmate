#!/usr/bin/env node

/**
 * RLS Policy Checker for YapMate
 *
 * This script queries the database to check all tables and their RLS policies
 */

const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL

async function checkRLSPolicies() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    // Get all tables in public schema
    const tablesQuery = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_migrations'
      ORDER BY tablename;
    `

    const { rows: tables } = await client.query(tablesQuery)

    console.log('📋 Tables found:', tables.length)
    console.log('='  .repeat(80))
    console.log('')

    for (const table of tables) {
      const tableName = table.tablename

      // Check if RLS is enabled
      const rlsEnabledQuery = `
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
      `
      const { rows: rlsEnabled } = await client.query(rlsEnabledQuery, [tableName])

      const isRLSEnabled = rlsEnabled[0]?.relrowsecurity || false

      console.log(`\n📊 Table: ${tableName}`)
      console.log(`   RLS Enabled: ${isRLSEnabled ? '✅ YES' : '❌ NO'}`)

      // Get columns
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `
      const { rows: columns } = await client.query(columnsQuery, [tableName])

      console.log(`   Columns: ${columns.map(c => c.column_name).join(', ')}`)

      // Get RLS policies
      const policiesQuery = `
        SELECT
          policyname,
          cmd,
          permissive,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1
        ORDER BY policyname;
      `
      const { rows: policies } = await client.query(policiesQuery, [tableName])

      if (policies.length > 0) {
        console.log(`   Policies (${policies.length}):`)
        for (const policy of policies) {
          console.log(`     - ${policy.policyname} (${policy.cmd})`)
          if (policy.qual) {
            console.log(`       USING: ${policy.qual}`)
          }
          if (policy.with_check) {
            console.log(`       WITH CHECK: ${policy.with_check}`)
          }
        }
      } else {
        console.log(`   ⚠️  No RLS policies found!`)
      }

      console.log('-'.repeat(80))
    }

    console.log('\n✅ RLS policy check complete\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

checkRLSPolicies()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  })
