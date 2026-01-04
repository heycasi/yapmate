# IAP Testing Guide - RevenueCat + iOS Subscriptions

This guide covers end-to-end testing of the in-app purchase flow for YapMate iOS app using RevenueCat and Apple Sandbox.

## Prerequisites

### 1. RevenueCat Configuration

1. **Create Project in RevenueCat**
   - Go to https://app.revenuecat.com/
   - Create a new project or select existing YapMate project
   - Navigate to Project Settings

2. **Configure iOS App**
   - Add iOS app with bundle ID: `com.yapmate.app` (or your actual bundle ID)
   - Copy the **iOS API Key** (starts with `appl_`)
   - Add to `.env.local`:
     ```
     NEXT_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_key_here
     ```

3. **Create Products**
   - Go to RevenueCat dashboard → Products
   - Create two products with these **exact** product IDs:
     - `com.yapmate.pro.monthly` → Attach to entitlement: `pro`
     - `com.yapmate.trade.monthly` → Attach to entitlement: `trade`
   - These must match App Store Connect product IDs

4. **Configure Entitlements**
   - Create two entitlements:
     - `pro` (attached to Pro Monthly product)
     - `trade` (attached to Trade Monthly product)

5. **Enable Sandbox Testing**
   - RevenueCat → Project Settings → API Keys
   - Use the same iOS API key for both production and sandbox testing
   - RevenueCat automatically detects sandbox vs production receipts

### 2. App Store Connect Configuration

1. **Create Sandbox Tester Account**
   - Go to App Store Connect → Users and Access → Sandbox Testers
   - Create a new sandbox tester with a unique email
   - **Important:** Use a DIFFERENT email from your real Apple ID
   - Save the password securely

2. **Create Subscription Products**
   - Go to App Store Connect → Your App → Subscriptions
   - Create a new subscription group
   - Create two auto-renewable subscriptions:
     - **Product ID:** `com.yapmate.pro.monthly`
       - Name: "YapMate Pro"
       - Duration: 1 month
       - Price: £9.99 (or your chosen price)
       - Free Trial: 7 days
     - **Product ID:** `com.yapmate.trade.monthly`
       - Name: "YapMate Trade"
       - Duration: 1 month
       - Price: £19.99 (or your chosen price)
       - Free Trial: 7 days

3. **Enable Accelerated Time**
   - In sandbox, subscriptions renew much faster:
     - 1 month subscription = 5 minutes in sandbox
     - 7-day trial = ~3 minutes in sandbox
   - This allows rapid testing of renewals/expirations

### 3. Supabase Edge Function Deployment

Deploy the RevenueCat sync edge function:

```bash
cd supabase
supabase functions deploy sync-revenuecat
```

Verify it's deployed:
```bash
supabase functions list
```

Run database migrations to add RevenueCat support:
```bash
supabase db push
```

## Testing Procedures

### Test Environment Setup

1. **Build iOS App**
   ```bash
   npm run build
   npx cap sync ios
   ```

2. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

3. **Configure Sandbox Account on Device**
   - iOS Settings → App Store → Sandbox Account
   - Sign in with your sandbox tester email

4. **Install App via Xcode**
   - Run on a physical device (IAP doesn't work in simulator)
   - Or use TestFlight with a TestFlight build

### Test Cases

#### Test 1: Free Trial Start (Pro Plan)

**Steps:**
1. Launch app
2. Create account / log in
3. Go to Pricing page
4. Tap "Start Free Trial" under Pro plan
5. Complete Apple payment sheet (Touch ID / Face ID)
6. Wait for confirmation

**Expected:**
- Purchase succeeds
- App shows success message
- Settings page shows:
  - Current Plan: PRO
  - Status: FREE TRIAL
  - Expires: ~3 minutes from now (sandbox time)
  - Renews: [date]
- VAT toggle is now unlocked
- CIS toggle still locked

**Verify in Supabase:**
```sql
SELECT * FROM subscriptions WHERE user_id = 'your-user-id';
-- Should show:
-- provider: 'revenuecat'
-- plan: 'pro'
-- status: 'trialing'
-- current_period_end: ~3 min from now

SELECT * FROM user_preferences WHERE user_id = 'your-user-id';
-- Should show:
-- plan: 'pro'
```

#### Test 2: Trial Conversion to Active

**Steps:**
1. Wait 3-5 minutes (sandbox trial expires)
2. Pull to refresh on Settings page or restart app

**Expected:**
- Status changes from "FREE TRIAL" to "ACTIVE"
- Plan remains "PRO"
- Renewal date extends by ~5 minutes (1 month in sandbox)
- Subscription still active

#### Test 3: Upgrade During Trial (Pro → Trade)

**Steps:**
1. Start free trial for Pro (see Test 1)
2. While still in trial, go to Pricing page
3. Tap "Start Free Trial" under Trade plan
4. Complete payment

**Expected:**
- Upgrade succeeds immediately
- Settings page shows:
  - Current Plan: TRADE
  - Status: FREE TRIAL
  - VAT and CIS both unlocked

#### Test 4: Restore Purchases

**Steps:**
1. Complete a purchase (Pro or Trade)
2. Go to Settings page
3. Tap "Log Out"
4. Log back in with same account
5. Go to Settings → Tap "Restore Purchases"

**Expected:**
- "Restoring..." indicator shown
- Success message appears
- Plan and subscription status restored
- Access gates (VAT/CIS) re-applied correctly

**Alternative Restore Test:**
1. Delete app
2. Reinstall app
3. Log in
4. Tap "Restore Purchases"
5. Subscription restored from App Store

#### Test 5: Subscription Expiration

**Steps:**
1. Purchase a subscription
2. Go to iOS Settings → App Store → Sandbox Account → Manage
3. Find YapMate subscription
4. Tap "Cancel Subscription"
5. Wait for current period to end (~5 minutes in sandbox)
6. Restart app

**Expected:**
- During cancellation period:
  - Plan: still active (Pro or Trade)
  - Status: ACTIVE
  - Expires: [date] (not "Renews")
- After expiration:
  - Plan: FREE
  - Status: EXPIRED
  - VAT/CIS locked again

#### Test 6: Plan-Based Access Gates

**Setup:** Start as free user

**Test VAT Access (Pro plan required):**
1. Go to Settings
2. Try to enable VAT toggle → Should work but save as disabled
3. Warning message: "VAT features require Pro plan"
4. Upgrade to Pro
5. Enable VAT toggle → Should save successfully
6. Create new invoice → VAT enabled by default

**Test CIS Access (Trade plan required):**
1. With Pro plan, try to enable CIS
2. Warning message: "CIS features require Trade plan"
3. Upgrade to Trade
4. Enable CIS toggle → Should save successfully
5. Create new invoice → CIS enabled by default

#### Test 7: Logout/Login Persistence

**Steps:**
1. Purchase Pro subscription
2. Enable VAT in settings
3. Log out
4. Log back in

**Expected:**
- Plan synced from Supabase (no restore needed)
- VAT preference persists
- Access gates applied correctly

#### Test 8: Network Failure Handling

**Test Purchase with No Network:**
1. Enable Airplane Mode
2. Try to purchase → Should show error

**Test Restore with No Network:**
1. Enable Airplane Mode
2. Tap "Restore Purchases" → Should show error

**Test Sync Failure:**
1. Purchase succeeds with RevenueCat
2. Supabase sync fails (simulate by temporarily breaking edge function)
3. Expected: Error message "Purchase succeeded but sync failed. Please contact support."

#### Test 9: Receipt Validation Edge Cases

**Test Multiple Rapid Purchases:**
1. Purchase Pro
2. Immediately purchase Trade (upgrade)
3. Verify only one active subscription exists in Supabase

**Test Sandbox Receipt Detection:**
1. RevenueCat should automatically detect sandbox environment
2. Verify edge function processes sandbox receipts correctly

## Debugging

### Check RevenueCat Dashboard
- Go to RevenueCat → Customers
- Search for your user ID (Supabase user ID)
- View purchase history, active entitlements, transaction logs

### Check Supabase Logs
```bash
supabase functions logs sync-revenuecat --tail
```

Look for:
- `[sync-revenuecat] Processing for user: <user-id>`
- `[sync-revenuecat] Determined plan: { plan: 'pro', status: 'trialing' }`
- `[sync-revenuecat] Sync successful`

### Check Browser Console (in app)
Look for:
- `[IAP] Initialized RevenueCat`
- `[IAP] Purchase successful`
- `[IAP Sync] Success: { plan: 'pro', status: 'trialing' }`

### Common Issues

**"Product not found" error:**
- Verify product IDs match exactly in App Store Connect and RevenueCat
- Check entitlements are configured in RevenueCat
- Wait 5-10 minutes after creating products in App Store Connect

**"No active session" during sync:**
- User must be logged in to Supabase
- Check authentication token is valid

**Restore returns "No purchases found":**
- Make sure using same sandbox account as purchase
- Check device has previous purchase in App Store history
- Try signing out/in of sandbox account in iOS Settings

**Subscription shows expired but should be active:**
- Check `current_period_end` in subscriptions table
- Verify timezone handling (dates should be in UTC)
- Check RevenueCat dashboard for actual entitlement status

## Production Checklist

Before deploying to production TestFlight or App Store:

- [ ] Replace sandbox API key with production API key (if different)
- [ ] Test with real App Store Connect production account
- [ ] Verify webhooks are configured in RevenueCat (for server-to-server notifications)
- [ ] Test restore purchases on multiple devices
- [ ] Verify subscription renewal works without app open
- [ ] Check Supabase RLS policies allow subscription updates
- [ ] Monitor RevenueCat webhook events in dashboard
- [ ] Set up customer support flow for subscription issues

## Support Resources

- **RevenueCat Docs:** https://www.revenuecat.com/docs
- **Apple IAP Testing Guide:** https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases
- **Sandbox Environment:** https://developer.apple.com/apple-pay/sandbox-testing/
