#!/usr/bin/env node

/**
 * Automated IAP Sync Test
 *
 * Tests the RevenueCat → Supabase subscription sync end-to-end.
 * Creates a test user, invokes the edge function, verifies DB write.
 *
 * Usage: npm run test:iap-sync
 *
 * Exit codes:
 *   0 = PASS
 *   1 = FAIL
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');
const http = require('http');

// ============================================================================
// CONFIGURATION (discovered from repo)
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test constants
const TEST_EMAIL = `iap-sync-test-${Date.now()}@yapmate-test.local`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_RC_CUSTOMER_ID = 'rc_test_sync_automated';
const EXPECTED_PLAN = 'pro';
const EXPECTED_STATUS = 'trialing';
const EXPECTED_PROVIDER = 'revenuecat';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ============================================================================
// UTILITIES
// ============================================================================

function log(msg) {
  console.log(`${CYAN}[TEST]${RESET} ${msg}`);
}

function logSuccess(msg) {
  console.log(`${GREEN}[PASS]${RESET} ${msg}`);
}

function logError(msg) {
  console.error(`${RED}[FAIL]${RESET} ${msg}`);
}

function logWarn(msg) {
  console.log(`${YELLOW}[WARN]${RESET} ${msg}`);
}

function redactKey(key) {
  if (!key) return '(missing)';
  return key.substring(0, 20) + '...' + key.substring(key.length - 10);
}

/**
 * Make an HTTPS request
 */
function makeRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================================================
// STEP 1: VALIDATE CONFIGURATION
// ============================================================================

function validateConfig() {
  log('Step 1: Validating configuration...');

  const missing = [];

  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }

  log(`  SUPABASE_URL: ${SUPABASE_URL}`);
  log(`  SUPABASE_ANON_KEY: ${redactKey(SUPABASE_ANON_KEY)}`);
  log(`  SUPABASE_SERVICE_ROLE_KEY: ${redactKey(SUPABASE_SERVICE_ROLE_KEY)}`);

  logSuccess('Configuration validated');
  return true;
}

// ============================================================================
// STEP 2: CREATE TEST USER
// ============================================================================

async function createTestUser() {
  log('Step 2: Creating test user...');
  log(`  Email: ${TEST_EMAIL}`);

  // Create user via Supabase Admin API
  const createResponse = await makeRequest(
    `${SUPABASE_URL}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
    {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }
  );

  if (createResponse.status !== 200 && createResponse.status !== 201) {
    logError(`Failed to create user: ${createResponse.status}`);
    logError(`Response: ${JSON.stringify(createResponse.data)}`);
    return null;
  }

  const userId = createResponse.data.id;
  log(`  User ID: ${userId}`);

  // Sign in to get access token
  const signInResponse = await makeRequest(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
    },
    {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }
  );

  if (signInResponse.status !== 200) {
    logError(`Failed to sign in: ${signInResponse.status}`);
    logError(`Response: ${JSON.stringify(signInResponse.data)}`);
    return null;
  }

  const accessToken = signInResponse.data.access_token;
  log(`  Access token: ${redactKey(accessToken)}`);

  logSuccess('Test user created and authenticated');

  return {
    userId,
    email: TEST_EMAIL,
    accessToken,
  };
}

// ============================================================================
// STEP 3: CLEAN STATE
// ============================================================================

async function cleanState(userId) {
  log('Step 3: Cleaning existing subscription state...');

  // Delete any existing subscription for this user
  const deleteResponse = await makeRequest(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&provider=eq.revenuecat`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation',
      },
    }
  );

  if (deleteResponse.status !== 200 && deleteResponse.status !== 204) {
    logWarn(`Delete response status: ${deleteResponse.status}`);
    // Not fatal - user might not have had a subscription
  }

  // Also delete from user_preferences
  await makeRequest(
    `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  logSuccess('State cleaned');
}

// ============================================================================
// STEP 4: INVOKE EDGE FUNCTION
// ============================================================================

async function invokeEdgeFunction(accessToken) {
  log('Step 4: Invoking edge function sync-revenuecat...');

  // Construct mock RevenueCat CustomerInfo
  const customerInfo = {
    originalAppUserId: TEST_RC_CUSTOMER_ID,
    activeSubscriptions: ['com.yapmate.pro.monthly'],
    latestExpirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    entitlements: {
      all: {
        pro: {
          identifier: 'pro',
          isActive: true,
          willRenew: true,
          periodType: 'TRIAL',
          latestPurchaseDate: new Date().toISOString(),
          originalPurchaseDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          productIdentifier: 'com.yapmate.pro.monthly',
          isSandbox: true,
        },
      },
      active: {
        pro: {
          identifier: 'pro',
          isActive: true,
          willRenew: true,
          periodType: 'TRIAL',
          latestPurchaseDate: new Date().toISOString(),
          originalPurchaseDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          productIdentifier: 'com.yapmate.pro.monthly',
          isSandbox: true,
        },
      },
    },
  };

  log(`  Payload: customerInfo with pro entitlement (TRIAL)`);
  log(`  revenuecatCustomerId: ${TEST_RC_CUSTOMER_ID}`);

  const response = await makeRequest(
    `${SUPABASE_URL}/functions/v1/sync-revenuecat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    },
    {
      customerInfo,
      revenuecatCustomerId: TEST_RC_CUSTOMER_ID,
    }
  );

  log(`  HTTP Status: ${response.status}`);
  log(`  Response: ${JSON.stringify(response.data)}`);

  if (response.status !== 200) {
    logError(`Edge function failed with status ${response.status}`);
    logError(`Response body: ${response.raw}`);
    return null;
  }

  if (!response.data?.success) {
    logError(`Edge function returned error: ${response.data?.error}`);
    logError(`Details: ${response.data?.details}`);
    return null;
  }

  logSuccess(`Edge function returned: plan=${response.data.plan}, status=${response.data.status}`);

  return response.data;
}

// ============================================================================
// STEP 5: VERIFY DATABASE WRITE
// ============================================================================

async function verifyDatabaseWrite(userId) {
  log('Step 5: Verifying database write...');

  // Query subscriptions table
  const queryResponse = await makeRequest(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=*`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (queryResponse.status !== 200) {
    logError(`Failed to query subscriptions: ${queryResponse.status}`);
    return false;
  }

  const rows = queryResponse.data;

  if (!rows || rows.length === 0) {
    logError('No subscription row found in database!');
    return false;
  }

  if (rows.length > 1) {
    logWarn(`Found ${rows.length} rows, expected 1. Using first row.`);
  }

  const row = rows[0];
  log(`  Found row: ${JSON.stringify(row, null, 2)}`);

  // Verify each field
  const checks = [
    { field: 'user_id', expected: userId, actual: row.user_id },
    { field: 'plan', expected: EXPECTED_PLAN, actual: row.plan },
    { field: 'status', expected: EXPECTED_STATUS, actual: row.status },
    { field: 'provider', expected: EXPECTED_PROVIDER, actual: row.provider },
    { field: 'revenuecat_customer_id', expected: TEST_RC_CUSTOMER_ID, actual: row.revenuecat_customer_id },
  ];

  let allPassed = true;

  for (const check of checks) {
    if (check.actual === check.expected) {
      logSuccess(`  ${check.field}: ${check.actual}`);
    } else {
      logError(`  ${check.field}: expected "${check.expected}", got "${check.actual}"`);
      allPassed = false;
    }
  }

  return allPassed;
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanup(userId) {
  log('Cleanup: Removing test user and data...');

  // Delete subscription
  await makeRequest(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  // Delete user_preferences
  await makeRequest(
    `${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  // Delete user
  await makeRequest(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  logSuccess('Cleanup complete');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`${CYAN}IAP SYNC AUTOMATED TEST${RESET}`);
  console.log('='.repeat(60) + '\n');

  let testUser = null;
  let exitCode = 1;

  try {
    // Step 1: Validate config
    if (!validateConfig()) {
      process.exit(1);
    }

    // Step 2: Create test user
    testUser = await createTestUser();
    if (!testUser) {
      process.exit(1);
    }

    // Step 3: Clean state
    await cleanState(testUser.userId);

    // Step 4: Invoke edge function
    const edgeResult = await invokeEdgeFunction(testUser.accessToken);
    if (!edgeResult) {
      throw new Error('Edge function invocation failed');
    }

    // Step 5: Verify database write
    const verified = await verifyDatabaseWrite(testUser.userId);
    if (!verified) {
      throw new Error('Database verification failed');
    }

    // All passed!
    exitCode = 0;

  } catch (error) {
    logError(`Test failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    // Cleanup
    if (testUser) {
      await cleanup(testUser.userId);
    }
  }

  // Final result
  console.log('\n' + '='.repeat(60));
  if (exitCode === 0) {
    console.log(`${GREEN}${'█'.repeat(20)} PASS ${'█'.repeat(20)}${RESET}`);
    console.log(`${GREEN}All assertions passed. IAP sync is working correctly.${RESET}`);
  } else {
    console.log(`${RED}${'█'.repeat(20)} FAIL ${'█'.repeat(20)}${RESET}`);
    console.log(`${RED}One or more assertions failed. See errors above.${RESET}`);
  }
  console.log('='.repeat(60) + '\n');

  process.exit(exitCode);
}

main();
