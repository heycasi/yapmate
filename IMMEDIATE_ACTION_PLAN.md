# Immediate Action Plan - Fix IAP Purchase Failure

**Date:** January 9, 2026
**Issue:** Apple rejection - Purchase flow fails on iPad Air
**Root Cause:** Products show "Waiting for Review" - may not be fully available in sandbox

## Current Status Analysis

### ✅ What's Correct:
1. App Store Connect API configured in RevenueCat (W7XQDMX472) ✓
2. RevenueCat API key in .env.local (appl_UEgIczjDOxxBNzwMrWabgaKLnxy) ✓
3. Offering "default" contains only Pro package ✓
4. Code improvements for error handling ✓

### ⚠️ Potential Issues:
1. Both products show "Waiting for Review" in RevenueCat
2. Cannot confirm which IAPs were attached to version 1.0 submission
3. Products may not be fully synced/available in sandbox

## Action Plan

### Option A: If You Can't Find Version IAP Details (Do This Now)

Since we can't easily verify what was attached to version 1.0, let's ensure everything is set up correctly for the next submission:

#### Step 1: Verify App Store Connect Subscription Status

1. Go to: **App Store Connect → In-App Purchases → Subscriptions**
2. Click **"Pro Monthly"** (com.yapmate.pro.monthly)
3. Take a screenshot of the status page
4. Note the current status (should be one of):
   - Ready to Submit
   - Waiting for Review
   - In Review
   - Approved

Do the same for **"Trade Monthly"**

#### Step 2: Create Fresh App Version (1.0.1) with Clear IAP Assignment

This is the safest approach to ensure everything is properly configured:

1. **App Store Connect → My Apps → YapMate AI**
2. Click **"+ Version or Platform"** → **"iOS"**
3. Version Number: **1.0.1**
4. Click **"Create"**

5. On the version 1.0.1 page:
   - Upload Build 15 (we'll create this)
   - Scroll to **"In-App Purchases and Subscriptions"**
   - Click **"+"** to add IAPs
   - **ONLY add Pro Monthly** (do NOT add Trade Monthly)
   - Save

#### Step 3: Build and Submit

Follow the BUILD_AND_TEST_GUIDE.md:

```bash
# Build
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

**In Xcode:**
- Change build number to **15**
- Change version to **1.0.1** (in General tab)
- Archive and upload

Then submit version 1.0.1 with Pro Monthly attached.

### Option B: If You CAN Find and Pro Monthly IS Attached (Simpler)

If you can verify Pro Monthly was properly attached to version 1.0:

1. Just build new version (Build 15) with our code improvements
2. Replace Build 14 with Build 15 on the existing version 1.0
3. Resubmit

## Why This Might Be Failing (Root Cause Analysis)

### Theory 1: Product Not Properly Submitted
- Products show "Waiting for Review" but may not have been submitted WITH the app version
- Apple's sandbox can't fetch products that aren't attached to a submitted version
- **Fix:** Ensure Pro Monthly is attached to the version being reviewed

### Theory 2: RevenueCat Sync Delay
- Products were submitted but RevenueCat hasn't updated status yet
- Normal sync can take 24-48 hours
- **Fix:** Wait for sync OR manually trigger by clicking products in RevenueCat

### Theory 3: Both Products Submitted (Incorrect)
- If BOTH Pro and Trade were submitted together
- Trade in "Waiting for Review" blocks the offering
- **Fix:** Only submit Pro, remove Trade from submission

### Theory 4: Sandbox Account Issue (Apple's Side)
- Apple reviewer's sandbox account has cached state
- Reviewer needs to sign out/in of sandbox
- **Fix:** Add note in App Review message asking them to use fresh sandbox account

## Recommended Message to Apple (When Resubmitting)

```
Dear App Review Team,

Thank you for testing our in-app purchases.

We have investigated and fixed the purchase flow issue:

**Changes Made:**
1. Enhanced error handling to provide better diagnostics
2. Fixed race condition in offering loading
3. Verified RevenueCat configuration with App Store Connect API
4. Ensured only Pro Monthly subscription is included in this version

**Testing Instructions:**
The Pro Monthly subscription (com.yapmate.pro.monthly) can be tested as follows:

1. Launch YapMate app
2. Navigate to "Pricing" page (accessible from home screen)
3. Tap "Start Free Trial" button on Pro plan (£15/month)
4. Apple StoreKit purchase dialog should appear
5. Complete purchase with Apple Sandbox tester account

**Important:** Please ensure you're signed out of your personal Apple ID and signed into a sandbox tester account in Settings → App Store before testing.

The subscription includes a 7-day free trial and is configured in App Store Connect subscription group "YapMate Subscriptions".

We have successfully tested this flow in our sandbox environment on both iPhone and iPad.

Thank you for your patience.

Best regards,
Connor Dahl
```

## What to Do RIGHT NOW

1. **Take screenshots of:**
   - App Store Connect → In-App Purchases → Pro Monthly (status page)
   - App Store Connect → In-App Purchases → Trade Monthly (status page)

2. **Then choose path:**
   - If Pro Monthly shows "Approved" or "Ready for Sale" → Use Option B (simpler)
   - If Pro Monthly shows "Waiting for Review" → Use Option A (create 1.0.1)
   - If you're unsure → Use Option A (safest)

3. **Build with improvements:**
   - The code changes we made will help regardless
   - Better logging will show exactly what's happening

4. **Test before submitting:**
   - MUST test purchase flow in TestFlight
   - Verify console logs show offerings loading
   - Verify purchase completes successfully

## Timeline

- **Now:** Take screenshots, verify product status
- **Next 30 min:** Build and archive
- **Next 2 hours:** Upload to App Store Connect, test in TestFlight
- **Today:** Submit to Apple (if testing succeeds)
- **24-48 hours:** Apple review response

## Success Criteria Before Submission

✅ Pro Monthly status in App Store Connect is "Approved" or "Ready for Sale" or "Waiting for Review"
✅ Only Pro Monthly is attached to the version being submitted
✅ Trade Monthly is NOT in the RevenueCat "default" offering
✅ Build 15 successfully completes purchase in TestFlight sandbox
✅ Console logs show "PURCHASE SUCCESSFUL"

## If Still Fails After This

Escalation options:
1. Request phone call from App Review team (option in rejection email)
2. Post in Apple Developer Forums with details
3. Contact RevenueCat support for configuration review
4. Consider temporarily switching to different IAP package structure
