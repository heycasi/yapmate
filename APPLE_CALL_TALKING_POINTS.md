# Apple Support Call - Talking Points

**Date:** January 9, 2026
**App:** YapMate AI
**Issue:** IAP purchase failure rejection + need help submitting Build 15

---

## Background

### Original Rejection Details
- **Submission ID:** fdfca6cc-2308-43e3-8216-12cf0de84076
- **Build Rejected:** Build 14
- **Issue:** "app failed to proceed with in app purchase buying process"
- **Test Device:** iPad Air 11-inch (M3), iPadOS 26.2
- **Review Date:** January 8, 2026

---

## What We've Fixed in Build 15

### 1. Enhanced Error Handling
- Added checks to prevent purchase attempts while offerings are loading
- Improved error messages for debugging
- Extended error display time for better visibility

### 2. Race Condition Fix
- Fixed issue where users could tap "Start Free Trial" before offerings loaded
- Added auto-retry mechanism if offerings fail to load
- Better loading state management

### 3. Comprehensive Logging
- Added detailed diagnostic logging throughout purchase flow
- Logs show exactly which offerings and products are available
- Helps identify configuration issues

### 4. RevenueCat Configuration
- ✅ App Store Connect API properly configured (Key: W7XQDMX472)
- ✅ Only Pro Monthly in "default" offering (Trade Monthly removed)
- ✅ Product ID: com.yapmate.pro.monthly
- ✅ Price: £15/month with 7-day free trial

---

## Current Status

### Build Status
- **Build 14:** Rejected (IAP purchase failure)
- **Build 15:** Uploaded to App Store Connect today (January 9, 2026)
- **Version:** 1.0
- **Processing:** Build 15 is currently processing or ready

### What We Need Help With
1. **Navigating App Store Connect** to replace Build 14 with Build 15
2. **Submitting Build 15** for review with proper messaging
3. **Understanding** if there are any additional IAP configuration issues we should address

---

## Product Configuration

### Pro Monthly Subscription
- **Product ID:** com.yapmate.pro.monthly
- **Status in App Store Connect:** Waiting for Review
- **Price:** £15.00/month
- **Free Trial:** 7 days
- **Subscription Group:** YapMate Subscriptions

### Trade Monthly Subscription
- **Product ID:** com.yapmate.trade.monthly
- **Status:** Waiting for Review
- **Note:** NOT included in current offering (will add after approval)

---

## RevenueCat Integration Details

### API Keys
- **Public SDK Key:** appl_UEgIczjDOxxBNzwMrWabgaKLnxy
- **App Store Connect API Key ID:** W7XQDMX472
- **Issuer ID:** 116b1e2c-6820-4ed2-9315-bd0b19ed86d0
- **Status:** ✅ Valid credentials, all permissions granted

### Offering Configuration
- **Current Offering:** "default"
- **Packages:** Pro Monthly only (1 package)
- **Why only one?** Trade Monthly is still "Waiting for Review" from previous submission

---

## Testing We've Done

### What Works
✅ RevenueCat SDK initializes properly on iOS
✅ Offerings load successfully in our testing
✅ Products appear with correct pricing (£15.00)
✅ Purchase flow starts correctly
✅ All code follows Apple guidelines (no forced account creation before IAP)

### What We Can't Test
❌ Full purchase completion (requires Apple sandbox during review)
❌ Whether Apple reviewers can see the product properly

---

## Questions for Apple

1. **Submission Process:**
   - Can you help me navigate to where I replace Build 14 with Build 15?
   - Do I need to create a new version (1.0.1) or can I update the existing version 1.0?

2. **IAP Configuration:**
   - Is Pro Monthly properly attached to version 1.0?
   - Should both subscriptions (Pro and Trade) be in "Waiting for Review" status?
   - Is there anything wrong with our RevenueCat configuration?

3. **Testing:**
   - How can we ensure the Apple reviewer has the right sandbox environment?
   - Are there any special instructions we should provide for testing?

4. **Resubmission:**
   - Should we address the rejection before submitting Build 15?
   - Or can we submit Build 15 as a replacement while the rejection is active?

---

## Code Changes Made (Technical Details if Asked)

### Files Modified
1. **app/pricing/page.tsx**
   - Added `isLoadingOfferings` check before allowing purchase
   - Added automatic retry if offerings array is empty
   - Enhanced error messages with context
   - Extended error visibility from 5s to 8s

2. **lib/iap.ts**
   - Added comprehensive logging at each step:
     - `[IAP] ===== STARTING PURCHASE =====`
     - `[IAP] Offerings fetched successfully`
     - `[IAP] ✓ FOUND! Product found in offering`
     - `[IAP] ===== PURCHASE SUCCESSFUL =====`
   - Logs all available offerings and products
   - Shows which offering contains which products
   - Provides detailed error codes

---

## What We Want to Achieve on This Call

1. ✅ **Submit Build 15** to replace Build 14
2. ✅ **Understand** if there are any configuration issues
3. ✅ **Get guidance** on fastest path to approval
4. ✅ **Clarify** if we need to do anything special for IAP testing

---

## Important Notes to Mention

1. **This is a legitimate UK trade app** for plumbers, electricians, builders
2. **We've addressed all previous rejection issues** (screenshots, EULA, account creation)
3. **IAP is critical** - can't launch without subscriptions working
4. **We're very close** - just need to get past this IAP hurdle
5. **Build 15 has significant improvements** over Build 14

---

## Post-Call Action Items

After the call, we need to:
- [ ] Submit Build 15 as guided by Apple
- [ ] Include proper messaging about fixes
- [ ] Wait for review (24-48 hours)
- [ ] Test purchase flow immediately when approved
- [ ] Add Trade Monthly subscription after Pro Monthly is approved

---

## Contact Information

**Developer:** Connor Dahl
**App:** YapMate AI
**Bundle ID:** com.yapmate.app
**App ID:** 6756750891
**Team ID:** S29UR6M3QD

---

## Files to Reference

If Apple support needs more details, these files contain everything:
- `REVENUECAT_VERIFICATION_CHECKLIST.md` - Configuration details
- `BUILD_AND_TEST_GUIDE.md` - What we built and how
- `IMMEDIATE_ACTION_PLAN.md` - Our analysis and fix strategy
- This file - Summary for Apple call

---

## Bottom Line

**We've fixed the IAP purchase flow issue and uploaded Build 15. We just need help navigating App Store Connect to submit it properly.**

The technical fixes are solid - we've added error handling, fixed race conditions, and verified our RevenueCat configuration. We're confident Build 15 will pass review if submitted correctly.
