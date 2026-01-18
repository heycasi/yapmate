# Build and Test Guide - IAP Purchase Fix

**Issue:** Apple rejection - "app failed to proceed with in app purchase buying process"
**Build:** 15 (next build after rejected Build 14)
**Date:** January 9, 2026

## Code Changes Made

### 1. Pricing Page (`app/pricing/page.tsx`)
**Changes:**
- ✅ Added check to prevent purchase while offerings are loading
- ✅ Added automatic retry if no offerings loaded
- ✅ Improved error messages with more context
- ✅ Extended error display time from 5s to 8s for readability
- ✅ Added detailed logging for debugging

### 2. IAP Library (`lib/iap.ts`)
**Changes:**
- ✅ Added comprehensive logging at every step of purchase flow
- ✅ Logs all offerings and products during purchase attempt
- ✅ Shows exactly which offering contains which products
- ✅ Provides detailed error codes and messages
- ✅ Helps identify if product is missing or offerings aren't synced

## Build Steps

### Step 1: Export Next.js App

```bash
# From project root
cd /Users/conzo/dev/yapmate

# Clean previous builds
rm -rf .next out

# Build Next.js app
npm run build

# Verify build completed
ls -la out/
```

**Expected output:** `out/` directory with static HTML, CSS, JS files

### Step 2: Sync to iOS

```bash
# Copy to iOS public folder
npx cap sync ios

# Verify files copied
ls -la ios/App/App/public/
```

**Expected:** Should see `_next/`, `index.html`, etc.

### Step 3: Build iOS App in Xcode

```bash
# Open Xcode project
open ios/App/App.xcworkspace
```

**In Xcode:**

1. **Select Target:**
   - Product → Destination → Any iOS Device (arm64)

2. **Increment Build Number:**
   - Select "App" target
   - General tab
   - Build: Change from `14` to `15`
   - Version: Keep as `1.0`

3. **Clean Build:**
   - Product → Clean Build Folder (Cmd+Shift+K)

4. **Archive:**
   - Product → Archive (Cmd+B first to build)
   - Wait for archive to complete (5-10 minutes)

5. **Distribute:**
   - Window → Organizer
   - Select latest archive (Build 15)
   - Click "Distribute App"
   - Choose "App Store Connect"
   - Upload
   - Wait for processing (10-15 minutes)

### Step 4: TestFlight Testing

**Setup:**
1. Go to App Store Connect → TestFlight
2. Wait for Build 15 to appear (processing can take 10-30 minutes)
3. Add build to External Testing group (if needed)

**Test on Physical Device (iPhone or iPad):**

1. **Sign Out of Real Apple ID:**
   - Settings → [Your Name] → Sign Out (App Store only)
   - Or: Settings → App Store → Sign Out

2. **Install from TestFlight:**
   - Open TestFlight app
   - Install YapMate Build 15

3. **Test Purchase Flow:**
   - Open YapMate
   - Go to Pricing page
   - **Check Console Logs** (if debugging in Xcode):
     - Connect device via USB
     - Xcode → Window → Devices and Simulators
     - Select device → View Device Logs
     - Filter for "YapMate" or "[IAP]"

   - Tap "Start Free Trial" on Pro plan
   - **Expected logs:**
     ```
     [Pricing] Starting purchase flow
     [Pricing] Available packages: 1
     [IAP] ===== STARTING PURCHASE =====
     [IAP] Product ID: com.yapmate.pro.monthly
     [IAP] Fetching offerings from RevenueCat...
     [IAP] Offerings fetched successfully
     [IAP] Current offering: default
     [IAP] ✓ FOUND! Product found in offering: default
     [IAP] Product details: ...
     [IAP] Initiating purchase with StoreKit...
     ```

   - **Apple StoreKit sheet appears**
   - Sign in with sandbox tester account when prompted
   - Confirm 7-day free trial
   - **Expected:** Purchase succeeds, redirects to /finish-setup

4. **If Purchase Fails:**
   - Check console logs for error
   - Look for `[IAP] ❌ PRODUCT NOT FOUND` or `[IAP] ===== PURCHASE FAILED =====`
   - Note the error message
   - Verify RevenueCat configuration (see REVENUECAT_VERIFICATION_CHECKLIST.md)

### Step 5: Submit to Apple

**Only after successful sandbox testing:**

1. Go to App Store Connect → My Apps → YapMate
2. Version 1.0 → Build section
3. Click "Select Build"
4. Choose Build 15
5. Save
6. Click "Submit for Review"
7. In message to Apple, include:
   ```
   Dear App Review Team,

   Thank you for your feedback on submission fdfca6cc-2308-43e3-8216-12cf0de84076.

   We have identified and fixed the in-app purchase issue:

   1. Improved error handling to ensure offerings are loaded before purchase
   2. Added race condition fix to prevent purchase during loading state
   3. Enhanced logging to aid debugging
   4. Verified RevenueCat product configuration

   The Pro Monthly subscription (com.yapmate.pro.monthly) is now properly
   configured and has been tested successfully in Apple's sandbox environment
   on both iPhone and iPad.

   Build 15 includes these fixes and is ready for review.

   Please test the purchase flow by:
   1. Opening the app
   2. Going to the Pricing page
   3. Tapping "Start Free Trial" on the Pro plan
   4. Completing the purchase with a sandbox tester account

   Thank you,
   Connor Dahl
   ```

## Troubleshooting

### Issue: "Loading subscription options, please wait..."

**Cause:** Offerings still loading when user tapped button

**Fix:** This is normal - user should wait 2-3 seconds and try again. If persists:
1. Check console logs
2. Verify RevenueCat API key is in .env.local
3. Verify app is connected to internet
4. Check RevenueCat dashboard for API key status

### Issue: "Product not found: com.yapmate.pro.monthly"

**Cause:** Product not in RevenueCat offering or offering not synced

**Fix:**
1. Go to RevenueCat → Offerings → default
2. Verify Pro Monthly package is in the offering
3. Verify offering is marked as "Current Offering"
4. If Trade Monthly is in offering and has "Waiting for Review" status, REMOVE it
5. Save and wait 5 minutes
6. Rebuild iOS app with npx cap sync ios

### Issue: Console shows no logs

**Cause:** Not running in debug mode

**Fix:**
1. Connect device via USB
2. In Xcode, select device from dropdown (not "Any iOS Device")
3. Product → Run (Cmd+R)
4. Check Console at bottom of Xcode for logs

### Issue: Sandbox account prompt not appearing

**Cause:** Already signed in with real Apple ID

**Fix:**
1. Settings → App Store → Sign Out
2. Kill YapMate app
3. Reopen and try again

## Success Criteria

✅ **Local Testing:**
- Offerings load successfully (check console)
- Products appear in offerings (check console)
- Purchase button works
- StoreKit sheet appears
- Purchase completes
- Redirects to /finish-setup

✅ **Apple Review:**
- App Review team can complete purchase
- No errors during purchase flow
- Subscription activates properly

## Console Log Reference

**Good Logs (Success):**
```
[IAP] Platform detected: ios
[IAP] API key present: true
[IAP] ✓ RevenueCat configured successfully
[IAP] Current offering ID: default
[IAP] Available packages: 1
[Pricing] Available packages:
  - pro: com.yapmate.pro.monthly (£15.00/month)
[IAP] ✓ FOUND! Product found in offering: default
[IAP] ===== PURCHASE SUCCESSFUL =====
```

**Bad Logs (Product Not Found):**
```
[IAP] ❌ PRODUCT NOT FOUND
[IAP] Searched for: com.yapmate.pro.monthly
[IAP] Available products:
  - com.yapmate.trade.monthly
```

**Bad Logs (Offerings Not Loaded):**
```
[IAP] Offerings fetched successfully
[IAP] Current offering: NONE
[IAP] Total offerings: 0
[IAP] ⚠️ No offerings available
```

## Files Modified

1. `app/pricing/page.tsx` - Purchase flow improvements
2. `lib/iap.ts` - Enhanced logging and error handling
3. `REVENUECAT_VERIFICATION_CHECKLIST.md` - Configuration guide (NEW)
4. `BUILD_AND_TEST_GUIDE.md` - This file (NEW)

## Next Steps After Apple Approval

1. Add Trade Monthly back to RevenueCat offering
2. Create version 1.1 with both Pro and Trade plans
3. Test both subscription tiers
4. Launch publicly
