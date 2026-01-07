# Changelog: App Review Guideline 5.1.1 Fix

**Date:** January 7, 2026
**Guideline:** App Review Guideline 5.1.1 - In-App Purchase
**Requirement:** Users must be able to purchase subscriptions without creating an account

---

## Summary of Changes

### ✅ What Was Fixed

**BEFORE:** Users were blocked from purchasing subscriptions with error "Please log in to purchase a subscription"

**AFTER:** Users can now:
1. Purchase Pro/Trade subscriptions WITHOUT logging in
2. Use premium features immediately after purchase
3. Create an account anytime to save invoices to the cloud
4. Have purchases automatically linked when they create an account

---

## Code Changes

### 1. lib/iap.ts
**Added:**
- `linkUser(appUserID)` method to merge anonymous RevenueCat user with authenticated user
- Calls `RevenueCat.logIn()` to transfer purchases when user logs in

**Lines:** 512-553

---

### 2. components/IAPProvider.tsx
**Changed:**
- Configure RevenueCat anonymously on app start (no user ID required)
- Listen for `SIGNED_IN` auth events
- Automatically link user to RevenueCat when they log in
- Sync subscriptions to Supabase after linking

**Key changes:**
- Anonymous configuration: `await configureIAP(apiKey)` (no user ID)
- Auth state listener: `supabase.auth.onAuthStateChange()`
- Auto-link on sign-in: `await linkUser(session.user.id)`

**Lines:** 1-114

---

### 3. app/pricing/page.tsx
**Removed:**
- Auth gate that blocked purchases (lines 94-99)
- "Sign Up to Upgrade" buttons for logged-out users

**Added:**
- Console log for debugging: `console.log('[Pricing] Starting purchase flow (logged in:', isLoggedIn, ')')`
- Redirect to `/finish-setup` after successful purchase (if not logged in)

**Changed:**
- Pro/Trade buttons now show "Start Free Trial" for all users (logged in or not)
- Post-purchase flow: logged-in users sync to Supabase, logged-out users go to /finish-setup

**Lines:** 68-149, 345-409

---

### 4. lib/plan-access.ts
**Changed:**
- `getUserPlan(userId?)` now accepts optional `userId` parameter
- **Entitlement-first access:** Checks RevenueCat entitlements BEFORE Supabase
- Works for both logged-in and logged-out users

**Logic flow:**
1. Check RevenueCat customer info (works without login)
2. If plan found (pro/trade), return it
3. Fall back to Supabase (requires userId)
4. Default to 'free' if nothing found

**Updated functions:**
- `getUserPlan(userId?)`
- `canCreateInvoice(userId?)`
- `canUseVAT(userId?)`
- `canUseCIS(userId?)`

**Lines:** 1-189

---

### 5. lib/iap-sync.ts
**Changed:**
- `syncSubscription()` now handles missing session gracefully
- Returns `success: true` for logged-out purchases (subscription active in RevenueCat)
- Logs: `[IAP Sync] No session - subscription active locally via RevenueCat`

**Lines:** 26-46

---

### 6. app/finish-setup/page.tsx (NEW FILE)
**Created:**
- Post-purchase onboarding page shown to logged-out users
- Verifies subscription via RevenueCat
- Prompts user to create account (with benefits explained)

**Features:**
- Success icon and "Trial Started" message
- Explains benefits of creating account:
  - Save invoices across devices
  - Automatic cloud backup
  - Synced customer list
- Three CTAs:
  - "Create Account" (primary)
  - "Log In" (secondary)
  - "Not Now - Start Using" (tertiary)

**Lines:** 1-154

---

### 7. supabase/migrations/009_add_plan_if_missing.sql (NEW FILE)
**Created:**
- Emergency migration to ensure `plan` column exists in `user_preferences`
- Adds check constraint: `CHECK (plan IN ('free', 'pro', 'trade'))`
- Creates index: `idx_user_preferences_plan`
- Safe to run multiple times (idempotent)

**Lines:** 1-62

---

## Data Persistence Rules

### Logged-Out Users with Subscription:
- ✅ Premium features unlocked (based on RevenueCat entitlements)
- ✅ Can create invoices
- ⚠️ Invoices NOT saved to Supabase (local only)
- ✅ When user creates account, purchases are linked via RevenueCat.logIn()

### Logged-In Users with Subscription:
- ✅ Premium features unlocked
- ✅ Invoices saved to Supabase
- ✅ Data synced across devices

### Free Plan (Logged In or Out):
- ✅ 3 invoice limit (enforced for logged-in users)
- ⚠️ Logged-out free users can create invoices (local only, not counted)

---

## User Flows

### Flow 1: Purchase Without Account
1. User downloads app
2. Taps "Pricing" → "Start Free Trial" on Pro
3. Confirms with Face ID
4. **Trial starts immediately (no account required)**
5. Redirected to `/finish-setup`
6. Chooses "Not Now - Start Using"
7. Uses premium features with local-only invoice storage

### Flow 2: Create Account Later
1. (Following Flow 1)
2. User goes to Settings → "Create Account"
3. Signs up with email
4. **IAPProvider detects SIGNED_IN event**
5. Calls `linkUser(userId)` → RevenueCat.logIn()
6. Purchases merged to user account
7. Subscriptions synced to Supabase
8. Invoices can now be saved to cloud

### Flow 3: Purchase After Creating Account
1. User downloads app
2. Creates account first
3. Goes to Pricing → "Start Free Trial"
4. Confirms purchase
5. Subscription synced to Supabase immediately
6. Can use premium features + cloud sync

---

## Debugging & Instrumentation

### Console Logs Added:

**IAPProvider.tsx:**
- `[IAP] Configuring RevenueCat...`
- `[IAP] Initialized successfully (anonymous mode)`
- `[IAP] User logged in, linking to RevenueCat...`
- `[IAP] User linked successfully`
- `[IAP] Auth state changed: SIGNED_IN`

**lib/iap.ts:**
- `[IAP] Linking user to RevenueCat: <userId>`
- `[IAP] User linked successfully`

**lib/plan-access.ts:**
- `[PlanAccess] Plan from RevenueCat: <plan>`
- `[PlanAccess] Plan from Supabase: <plan>`
- `[PlanAccess] No active plan found, defaulting to free`
- `[PlanAccess] Not logged in - invoice will not be saved to cloud`

**app/pricing/page.tsx:**
- `[Pricing] Starting purchase flow (logged in: <boolean>)`
- `[Pricing] Purchase successful`
- `[Pricing] Syncing to Supabase...`
- `[Pricing] Purchase successful, redirecting to /finish-setup...`

**lib/iap-sync.ts:**
- `[IAP Sync] No session - subscription active locally via RevenueCat`

---

## Testing Scenarios

### Scenario 1: Anonymous Purchase
1. Fresh install → Do NOT create account
2. Tap Pricing → Start Free Trial (Pro)
3. Confirm with Face ID
4. Verify: Redirected to /finish-setup
5. Tap "Not Now"
6. Go to Record → Create invoice with VAT
7. Verify: VAT option is available (premium feature unlocked)

### Scenario 2: Account Linking
1. Continue from Scenario 1
2. Go to Settings → Create Account
3. Enter email and password
4. Check Console logs for `[IAP] User linked successfully`
5. Go to Dashboard → Verify invoices are now synced

### Scenario 3: Restore Purchases
1. Fresh install → Do NOT create account
2. Go to Settings → Restore Purchases
3. If previous subscription exists, it's restored
4. Verify: Premium features unlocked WITHOUT logging in

---

## App Review Submission Notes

### Key Points to Highlight:

1. **IAP is accessible without account:**
   - Home screen → Pricing (bottom nav)
   - "Start Free Trial" buttons work for all users

2. **Post-purchase experience:**
   - Users are PROMPTED (not required) to create account
   - Can choose "Not Now" and use premium features

3. **Account benefits are clearly explained:**
   - Cloud sync
   - Multi-device access
   - Invoice backup

4. **Compliance with Guideline 5.1.1:**
   - No forced account creation before purchase
   - No forced account creation after purchase
   - Account is optional enhancement, not requirement

---

## Rollback Plan

If issues arise:

```bash
git revert 718443f
git push origin main
npm run build
npx cap sync ios
```

Then rebuild in Xcode and resubmit previous version.

---

## Files Changed

| File | Status | Description |
|------|--------|-------------|
| lib/iap.ts | Modified | Added linkUser() method |
| components/IAPProvider.tsx | Modified | Anonymous config + auto-linking |
| app/pricing/page.tsx | Modified | Removed auth gate, added /finish-setup redirect |
| lib/plan-access.ts | Modified | Entitlement-first access |
| lib/iap-sync.ts | Modified | Handle logged-out sync |
| app/finish-setup/page.tsx | **New** | Post-purchase onboarding |
| supabase/migrations/009_add_plan_if_missing.sql | **New** | Ensure plan column exists |

---

**Commit:** 718443f
**Author:** Claude Sonnet 4.5
**Date:** January 7, 2026
