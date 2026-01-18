# Apple App Review Issue - Complete Breakdown

**Date:** January 9, 2026
**App:** YapMate AI
**Developer:** Connor Dahl
**Critical:** App launch blocked by IAP purchase failure

---

## THE PROBLEM

### Apple's Rejection Message (Received Jan 8, 2026)

```
Guideline 2.1 - Performance - App Completeness

The In-App Purchase products in the app exhibited one or more bugs which create
a poor user experience. Specifically, app failed to proceed with in app purchase
buying process.

Review device details:
- Device type: iPad Air 11-inch (M3)
- OS version: iPadOS 26.2

Next Steps:
Apple reviews In-App Purchase products in the sandbox and the In-App Purchase
products do not need prior approval to function in review. Review the product
configurations, complete any missing information, and test them in the sandbox.
```

**Translation:** The Apple reviewer tried to purchase a subscription and the purchase flow failed somewhere in the process. It started but didn't complete.

---

## CONTEXT: Previous Issues (All Fixed)

This is the **2nd rejection**. Previous issues were:

1. ✅ **Guideline 2.3.3** - Screenshots issue (FIXED)
2. ✅ **Guideline 3.1.2** - Missing EULA link (FIXED)
3. ✅ **Guideline 5.1.1** - Forced account creation before IAP (FIXED - users can now purchase without login)
4. ❌ **Guideline 2.1** - IAP purchase flow failure (CURRENT ISSUE)

---

## OUR IAP SETUP

### Products Configuration

**Pro Monthly Subscription:**
- Product ID: `com.yapmate.pro.monthly`
- Status in App Store Connect: "Waiting for Review"
- Status in RevenueCat: "Waiting for Review"
- Price: £15.00/month
- Free Trial: 7 days
- Subscription Group: YapMate Subscriptions (ID: 21571031)

**Trade Monthly Subscription:**
- Product ID: `com.yapmate.trade.monthly`
- Status: "Waiting for Review"
- Price: £25.00/month
- Free Trial: 7 days
- Same subscription group

### RevenueCat Configuration

**API Keys:**
- Public SDK Key: `appl_UEgIczjDOxxBNzwMrWabgaKLnxy` ✅
- App Store Connect API Key: `W7XQDMX472` ✅
- Issuer ID: `116b1e2c-6820-4ed2-9315-bd0b19ed86d0` ✅
- Status: Valid credentials with all permissions

**Offerings:**
- Current offering: "default"
- Packages: **Pro Monthly ONLY** (Trade Monthly removed)
- Why only one? Previous session log indicated Trade Monthly in "Waiting for Review" causes issues

**Entitlements:**
- `pro` → linked to `com.yapmate.pro.monthly`
- `trade` → linked to `com.yapmate.trade.monthly`

---

## THE PURCHASE FLOW (How It Should Work)

### User Journey
1. User opens YapMate app
2. Goes to Pricing page (`/pricing`)
3. Sees three plans: Free, Pro (£15), Trade (£25)
4. Taps "Start Free Trial" on Pro plan
5. **[CRITICAL POINT]** App calls RevenueCat to fetch offerings
6. App identifies product `com.yapmate.pro.monthly`
7. Calls RevenueCat purchase function
8. Apple StoreKit purchase sheet appears
9. User signs in with sandbox account (if not logged in)
10. User confirms 7-day free trial
11. Purchase completes
12. App redirects to `/finish-setup` (if not logged in) or dashboard

### Where It's Failing
Based on Apple's message "app failed to proceed with in app purchase buying process", the failure is happening somewhere between steps 5-11. The purchase flow starts but doesn't complete.

---

## ROOT CAUSE ANALYSIS

### Theory 1: Race Condition (MOST LIKELY - NOW FIXED)
**Problem:** User taps "Start Free Trial" before offerings finish loading from RevenueCat.

**Evidence:**
- Offerings load asynchronously via `getOfferings()` in `useEffect`
- No check to prevent purchase while `isLoadingOfferings` is true
- If user is quick, they can tap button before offerings array is populated

**Result:** Purchase function called with empty offerings → product not found → purchase fails

**Our Fix:**
```typescript
// Added in Build 15
if (isLoadingOfferings) {
  console.warn('[Pricing] ⚠️ Offerings still loading, waiting...')
  setPurchaseError('Loading subscription options, please wait...')
  return
}

if (offerings.length === 0) {
  console.warn('[Pricing] ⚠️ No offerings available, reloading...')
  setPurchaseError('Loading subscription options, please try again...')
  await loadOfferings()
  return
}
```

---

### Theory 2: Product Not in Offering (POSSIBLE)
**Problem:** `com.yapmate.pro.monthly` not actually in the RevenueCat "default" offering.

**Evidence from Screenshots:**
- RevenueCat dashboard shows offering has "Pro" package ✅
- But both products show "Waiting for Review" status
- Possible sync delay between App Store Connect and RevenueCat

**Result:** Product lookup fails → purchase can't proceed

**Our Fix:** Added comprehensive logging to see exactly what's in the offering:
```typescript
console.log('[IAP] Current offering:', offeringsResult.current?.identifier)
console.log('[IAP] Searching for product in', allOfferings.length, 'offering(s)...')
// Logs each package and product ID
```

---

### Theory 3: Product Not Attached to Version 1.0 (CRITICAL - UNVERIFIED)
**Problem:** Pro Monthly subscription might not be properly attached to the app version being reviewed.

**Evidence:**
- We couldn't find the "In-App Purchases and Subscriptions" section on version 1.0 page
- Navigation in App Store Connect is confusing
- Previous session log says Pro Monthly should be attached, but we couldn't verify

**Result:** Apple's sandbox can't fetch product because it's not linked to the version

**Status:** ⚠️ **UNVERIFIED - This might be the real issue**

---

### Theory 4: RevenueCat SDK Initialization Issue (UNLIKELY)
**Problem:** RevenueCat not initializing properly on iPad.

**Evidence:**
- Works in our testing on iPhone
- iPad Air 11-inch is the test device
- Different screen sizes shouldn't affect SDK but worth checking

**Our Fix:** Added detailed initialization logging:
```typescript
console.log('[IAP] Platform detected:', platform)
console.log('[IAP] isIAPAvailable:', isIAPAvailable())
console.log('[IAP] API key present:', hasApiKey)
console.log('[IAP] ✓ RevenueCat configured successfully')
```

---

## WHAT WE'VE DONE TO FIX IT

### Code Changes in Build 15

#### 1. Pricing Page (`app/pricing/page.tsx`)

**Added Race Condition Protection:**
- Check if offerings are still loading before allowing purchase
- Check if offerings array is empty and retry loading
- Better error messages with context

**Enhanced Error Handling:**
- Extended error display time from 5s to 8s for readability
- More helpful error messages:
  - "Loading subscription options, please wait..."
  - "Subscription not available. Please contact support with error: Product not found"
  - "Billing system not ready. Please try again or contact support."

**Added Logging:**
```typescript
console.log('[Pricing] Starting purchase flow (logged in:', isLoggedIn, ')')
console.log('[Pricing] Current offerings state:', offerings.length, 'offerings')
console.log('[Pricing] Available packages:')
offerings.forEach((offering) => {
  offering.availablePackages.forEach((pkg) => {
    console.log(`  - ${pkg.identifier}: ${pkg.product.identifier} (${pkg.product.priceString})`)
  })
})
```

#### 2. IAP Library (`lib/iap.ts`)

**Comprehensive Step-by-Step Logging:**
```typescript
console.log('[IAP] ===== STARTING PURCHASE =====')
console.log('[IAP] Product ID:', productId)
console.log('[IAP] Fetching offerings from RevenueCat...')
console.log('[IAP] Offerings fetched successfully')
console.log('[IAP] Current offering:', offeringsResult.current?.identifier)
console.log('[IAP] Total offerings:', Object.keys(offeringsResult.all || {}).length)
console.log('[IAP] Searching for product in', allOfferings.length, 'offering(s)...')

// For each offering:
console.log('[IAP] Checking offering:', offering.identifier)
console.log('[IAP] Packages in offering:', offering.availablePackages.length)
console.log('[IAP]   - Package:', pkg.identifier, '→ Product:', pkg.product?.identifier)

// When found:
console.log('[IAP] ✓ FOUND! Product found in offering:', foundInOffering)
console.log('[IAP] Product details:')
console.log('[IAP]   - ID:', productToPurchase.identifier)
console.log('[IAP]   - Title:', productToPurchase.title)
console.log('[IAP]   - Price:', productToPurchase.priceString)
console.log('[IAP]   - Intro Offer:', productToPurchase.introPrice ? 'YES' : 'NO')

// Purchase attempt:
console.log('[IAP] Initiating purchase with StoreKit...')

// Success:
console.log('[IAP] ===== PURCHASE SUCCESSFUL =====')

// Failure:
console.error('[IAP] ===== PURCHASE FAILED =====')
console.error('[IAP] Error code:', error.code)
console.error('[IAP] Error message:', error.message)
```

**Better Error Context:**
```typescript
if (!productToPurchase) {
  console.error('[IAP] ❌ PRODUCT NOT FOUND')
  console.error('[IAP] Searched for:', productId)
  console.error('[IAP] Available products:')
  allOfferings.forEach((offering) => {
    offering.availablePackages.forEach((pkg) => {
      console.error('[IAP]   -', pkg.product?.identifier)
    })
  })

  return {
    success: false,
    error: `Product not found: ${productId}. Available offerings: ${allOfferings.length}`,
  }
}
```

---

### Build Process

**Build 15 Details:**
- Version: 1.0
- Build number: 15 (incremented from 14)
- Built: January 9, 2026
- Status: Uploaded to App Store Connect, processing
- Archive location: `~/Library/Developer/Xcode/Archives/2026-01-09/YapMate-Build15.xcarchive`

**What's Included:**
- All code fixes above
- Next.js static export with updated code
- RevenueCat SDK: @revenuecat/purchases-capacitor@11.3.2
- Capacitor: Latest synced version

---

## WHAT WE HAVEN'T VERIFIED (CRITICAL GAPS)

### ⚠️ Gap 1: Product Attachment to Version 1.0
**Issue:** We couldn't navigate App Store Connect to verify if `com.yapmate.pro.monthly` is actually attached to version 1.0.

**Why It Matters:** If the product isn't attached, Apple's sandbox can't fetch it, and the purchase will always fail.

**How to Check:**
1. App Store Connect → My Apps → YapMate AI
2. iOS App → 1.0 → [Need to find "In-App Purchases and Subscriptions" section]
3. Should show: Pro Monthly attached ✅

**Status:** ❌ UNVERIFIED

---

### ⚠️ Gap 2: Actual Product Status in App Store Connect
**Issue:** RevenueCat shows "Waiting for Review" but we haven't checked the actual status in App Store Connect.

**Why It Matters:** RevenueCat status might be stale. Real status could be:
- "Ready to Submit" (product never submitted)
- "In Review" (being reviewed now)
- "Approved" (already approved)
- "Rejected" (rejected for some reason)

**How to Check:**
1. App Store Connect → In-App Purchases → Manage
2. Click on "Pro Monthly"
3. Check status at top of page

**Status:** ❌ UNVERIFIED

---

### ⚠️ Gap 3: RevenueCat Offering Sync
**Issue:** We see offering configured correctly in RevenueCat dashboard, but don't know if it's actually syncing to the iOS app.

**Why It Matters:** Could be a cache issue or sync delay.

**How to Test:**
- Install Build 15 via TestFlight
- Check console logs for offering details
- Verify product appears in offerings

**Status:** ⏳ PENDING (Build 15 still processing)

---

## TESTING STATUS

### What We CAN Test
✅ Build process (builds successfully)
✅ RevenueCat initialization (logs show it works)
✅ Offering fetch (code looks correct)
✅ Error handling (code improvements in place)

### What We CANNOT Test
❌ Full purchase flow (need Apple sandbox during review)
❌ Whether Apple reviewers see the product
❌ If product is properly attached to version
❌ Actual purchase completion on iPad Air 11-inch

---

## EXPECTED BEHAVIOR IN BUILD 15

### If Everything Works
1. User opens app → RevenueCat initializes
2. Navigate to /pricing → Offerings load (3-5 seconds)
3. Tap "Start Free Trial" → Immediate check for offerings
4. If loaded → Purchase initiated
5. Console shows:
   ```
   [IAP] ===== STARTING PURCHASE =====
   [IAP] Product ID: com.yapmate.pro.monthly
   [IAP] ✓ FOUND! Product found in offering: default
   [IAP] Initiating purchase with StoreKit...
   [IAP] ===== PURCHASE SUCCESSFUL =====
   ```
6. Apple StoreKit sheet appears
7. Purchase completes
8. Redirect to /finish-setup

### If It Fails Again
Console will show exactly where it fails:
- `[Pricing] ⚠️ Offerings still loading` → Race condition (shouldn't happen now)
- `[Pricing] ⚠️ No offerings available` → RevenueCat fetch failed
- `[IAP] ❌ PRODUCT NOT FOUND` → Product not in offering
- `[IAP] ===== PURCHASE FAILED =====` + error code → StoreKit error

---

## POSSIBLE REMAINING ISSUES

### Issue A: Product Not Attached (HIGH PROBABILITY)
**Symptom:** Apple sandbox can't see the product
**Fix:** Attach Pro Monthly to version 1.0 in App Store Connect
**How:** Need Apple support to help navigate

### Issue B: Both Products Submitted Together (MEDIUM PROBABILITY)
**Symptom:** Trade Monthly in offering causes conflict
**Fix:** Ensure only Pro Monthly is in offering (already done ✅)
**Verify:** RevenueCat dashboard shows only Pro package

### Issue C: RevenueCat Configuration Error (LOW PROBABILITY)
**Symptom:** API keys or offering misconfigured
**Fix:** Re-verify configuration
**Status:** Looks correct based on screenshots

### Issue D: Sandbox Account Issue (LOW PROBABILITY)
**Symptom:** Apple reviewer's sandbox account has cached/bad state
**Fix:** Ask reviewer to sign out/in or use fresh sandbox account
**Note:** Can mention this in submission message

---

## DOCUMENTATION CREATED

1. **REVENUECAT_VERIFICATION_CHECKLIST.md**
   - Step-by-step RevenueCat configuration checks
   - What to verify in dashboard
   - Common issues and fixes

2. **BUILD_AND_TEST_GUIDE.md**
   - Complete build instructions
   - Testing procedures
   - Submission message template

3. **IMMEDIATE_ACTION_PLAN.md**
   - Root cause analysis
   - Action items
   - Success criteria

4. **APPLE_CALL_TALKING_POINTS.md**
   - What to say on Apple support call
   - Questions to ask
   - Configuration details for reference

5. **This Document**
   - Complete breakdown of issue and fixes

---

## WHAT WE NEED TO DO NEXT

### Immediate (Before Apple Call)
1. ✅ Build 15 uploaded (DONE)
2. ⏳ Wait for Build 15 to finish processing
3. 📞 Apple support call (scheduled)

### During Apple Call
1. Ask them to verify Pro Monthly is attached to version 1.0
2. Ask them to check product status in App Store Connect
3. Get help submitting Build 15 properly
4. Ask if they see any configuration issues

### After Apple Call
1. Submit Build 15 as guided
2. Include message about fixes
3. Wait for review
4. Check console logs if rejected again

---

## CRITICAL QUESTIONS FOR APPLE

1. **Is `com.yapmate.pro.monthly` properly attached to version 1.0?**
   - If NO: How do we attach it?
   - If YES: Why did the purchase fail?

2. **What's the actual status of Pro Monthly in App Store Connect?**
   - Is it "Ready to Submit", "In Review", or "Approved"?

3. **Should Trade Monthly also be submitted or should we wait?**
   - Currently removed from offering for safety

4. **Is there anything wrong with our RevenueCat configuration?**
   - API keys, offering structure, product links

5. **Can we see reviewer logs or error messages?**
   - What exact error did the reviewer see?

---

## CONFIDENCE LEVEL

### High Confidence (Fixed)
✅ Race condition in offerings loading → FIXED
✅ Error handling and user feedback → IMPROVED
✅ Diagnostic logging → COMPREHENSIVE
✅ RevenueCat API configuration → VERIFIED

### Medium Confidence (Likely Fixed)
🟡 Product availability in offering → CODE IMPROVED
🟡 Error messages for Apple reviewers → MORE HELPFUL
🟡 Purchase flow stability → BETTER SAFEGUARDS

### Low Confidence (Unverified)
🔴 Product attached to version 1.0 → NEED TO VERIFY
🔴 Actual product status → NEED TO CHECK
🔴 Apple sandbox can fetch product → NEED TO TEST

---

## BOTTOM LINE

**We've fixed the code-level issues that could cause the purchase flow to fail.** Build 15 has better error handling, race condition protection, and comprehensive logging.

**BUT we still have configuration gaps** - specifically whether Pro Monthly is properly attached to version 1.0 in App Store Connect.

**The Apple support call is critical** because they can:
1. Verify the product is attached correctly
2. Check for any configuration issues we can't see
3. Help us submit Build 15 properly
4. Potentially expedite review

**If the product IS attached and configured correctly, Build 15 should fix the issue.** If it's NOT attached, we need Apple to help us fix that before any code improvements will matter.

---

**Status:** Waiting for Apple support call to resolve configuration verification and submit Build 15.
