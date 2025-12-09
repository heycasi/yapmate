#!/usr/bin/env node

/**
 * Automated Migration Runner for YapMate
 *
 * This script automatically runs all SQL migrations in the supabase/migrations folder
 * against your Supabase database using direct PostgreSQL connection.
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DATABASE_URL = process.env.DATABASE_URL

// Build connection string if not provided
let connectionString = DATABASE_URL

if (!connectionString && SUPABASE_URL) {
  // Extract project ref from Supabase URL
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (!projectRef) {
    console.error('❌ Error: Could not parse Supabase project reference from URL')
    process.exit(1)
  }

  // Check for database password
  const dbPassword = process.env.SUPABASE_DB_PASSWORD

  if (!dbPassword) {
    console.error('❌ Error: Missing database credentials')
    console.error('\nPlease add one of the following to your .env.local file:')
    console.error('\nOption 1 - Direct connection string:')
    console.error('DATABASE_URL=postgresql://postgres.YOUR-PROJECT-REF:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres')
    console.error('\nOption 2 - Just the password:')
    console.error('SUPABASE_DB_PASSWORD=[YOUR-PASSWORD]')
    console.error('\n💡 Find your database password in Supabase Dashboard → Settings → Database')
    console.error('   Then copy the "Connection string" (Session pooler recommended) from that page')
    process.exit(1)
  }

  // Try pooler connection first (newer Supabase projects), then fall back to direct
  // Session pooler format: postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  // Direct format: postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
  const poolerHost = `aws-0-us-east-1.pooler.supabase.com` // Common US region
  connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@${poolerHost}:6543/postgres?pgbouncer=true`
}

if (!connectionString) {
  console.error('❌ Error: No database connection string available')
  console.error('Please set DATABASE_URL or SUPABASE_DB_PASSWORD in .env.local')
  process.exit(1)
}

async function runMigrations() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Supabase uses SSL
    }
  })

  try {
    console.log('🚀 Starting migration process...\n')
    console.log('🔌 Connecting to database...')

    await client.connect()
    console.log('✅ Connected successfully!\n')

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')

    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found at:', migrationsDir)
      return
    }

    // Get all .sql files in migrations directory
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort() // Run in alphabetical order

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found')
      return
    }

    console.log(`📁 Found ${migrationFiles.length} migration file(s):\n`)

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Get already executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT filename FROM _migrations'
    )
    const executedSet = new Set(executedMigrations.map(row => row.filename))

    // Run each migration
    for (const file of migrationFiles) {
      // Skip if already executed
      if (executedSet.has(file)) {
        console.log(`⏭️  Skipping: ${file} (already executed)`)
        continue
      }

      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf8')

      console.log(`⏳ Running: ${file}...`)

      try {
        // Execute the SQL migration
        await client.query(sql)

        // Record successful migration
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        )

        console.log(`   ✅ ${file} completed successfully\n`)

      } catch (error) {
        console.error(`   ❌ Error running ${file}:`)
        console.error(`   ${error.message}\n`)

        // Stop on first error to prevent cascading issues
        console.error('⚠️  Migration stopped due to error')
        console.error('💡 Fix the error and run again - completed migrations will be skipped\n')
        throw error
      }
    }

    console.log('✨ All migrations completed successfully!\n')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await client.end()
    console.log('🔌 Database connection closed')
  }
}

// Run migrations
runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  })
