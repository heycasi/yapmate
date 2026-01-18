# Adding Trade Monthly Subscription - Step by Step Guide

**When to do this:** After Apple approves version 1.0 with Pro Monthly

---

## Current Status

**Pro Monthly:**
- Status: In Review (with version 1.0)
- In RevenueCat offering: YES ✅
- Available for purchase: YES ✅

**Trade Monthly:**
- Status: Waiting for Review (NOT attached to version 1.0)
- In RevenueCat offering: NO ❌ (removed for safety)
- Available for purchase: NO ❌

---

## Why Trade Monthly Isn't Available Yet

Trade Monthly is in "Waiting for Review" status and wasn't attached to version 1.0 because:
1. Apple doesn't let you attach products in "Waiting for Review" to new versions
2. It needs to be approved separately
3. We removed it from RevenueCat offering to avoid conflicts

---

## Step-by-Step: Adding Trade Monthly

### Option A: If Trade Monthly Auto-Approves with Pro Monthly

Sometimes when Pro Monthly gets approved, Trade Monthly automatically approves too (since they're in the same subscription group).

**Check Status:**
1. App Store Connect → In-App Purchases → Subscriptions
2. Click "Trade Monthly"
3. Check status - if it says **"Approved"** or **"Ready for Sale"**, proceed to Step 2

**If still "Waiting for Review"**, use Option B below.

---

### Option B: Submit Trade Monthly for Review (Most Likely Scenario)

#### Step 1: Submit Trade Monthly Product for Review

1. **App Store Connect → In-App Purchases → Subscriptions**
2. Click **"Trade Monthly"** (com.yapmate.trade.monthly)
3. If you see **"Submit for Review"** button at top, click it
4. Fill in any missing information if prompted
5. Submit

**This doesn't require a new app version** - you're just submitting the IAP product for review.

#### Step 2: Wait for Trade Monthly Approval (Usually 24-48 hours)

Apple will review Trade Monthly separately. You'll get an email when it's approved.

#### Step 3: Create Version 1.1 (or 1.0.1)

Once Trade Monthly is **"Approved"** or **"Ready for Sale"**:

1. **App Store Connect → My Apps → YapMate AI**
2. Click **"+ Version or Platform"**
3. Select **"iOS"**
4. Version Number: **1.0.1** (or 1.1 if you prefer)
5. Click **"Create"**

#### Step 4: Configure Version 1.0.1

On the version 1.0.1 page:

1. **What's New in This Version:**
   ```
   • Added Trade plan for CIS contractors
   • Includes CIS deduction support
   • Bank details on invoices
   ```

2. **Build Section:**
   - Click **"Select a build"**
   - Choose **Build 15** (same build, no code changes needed)
   - Click **"Done"**

3. **In-App Purchases and Subscriptions Section:**
   - Click **"+"**
   - Select **BOTH**:
     - ✓ Pro Monthly
     - ✓ Trade Monthly
   - Click **"Done"**

4. Click **"Save"**

#### Step 5: Add Trade Monthly to RevenueCat Offering

1. **RevenueCat Dashboard → Apps → YapMate AI Ltd**
2. Click **"Offerings"** in left sidebar
3. Click on **"default"** offering
4. Click **"Edit"** button
5. Under **"Packages"**, click **"Add Package"**
6. Configure:
   - **Package Identifier:** `trade`
   - **Package Type:** `$rc_monthly`
   - **Product:** Select `com.yapmate.trade.monthly`
7. Click **"Save"**

Your offering should now have 2 packages:
- Pro (com.yapmate.pro.monthly)
- Trade (com.yapmate.trade.monthly)

#### Step 6: Update .env.local (If Needed)

Check if you need to add Trade product ID to your constants:

```bash
# In lib/iap.ts, this should already be there:
export const IAP_PRODUCTS = {
  PRO_MONTHLY: 'com.yapmate.pro.monthly',
  TRADE_MONTHLY: 'com.yapmate.trade.monthly',  // ✅ Already in code
} as const
```

**No code changes needed** - Trade Monthly is already in your code, just not in the offering.

#### Step 7: Build and Test (Optional but Recommended)

Since no code changed, you can skip this. But if you want to test:

```bash
# No changes needed, but if you want to rebuild:
npm run build
npx cap sync ios
# Then archive and upload as Build 16
```

Or just use **Build 15** (same build works fine).

#### Step 8: Submit Version 1.0.1 for Review

1. On version 1.0.1 page, click **"Submit for Review"**
2. Include this message:

```
This update adds the Trade Monthly subscription option for CIS contractors.

The Trade plan includes all Pro features plus CIS deduction support.

Both Pro Monthly and Trade Monthly subscriptions have been tested and are
working correctly in sandbox.

Thank you.
```

---

## Timeline Estimate

**Day 0 (Today):** Version 1.0 submitted with Pro Monthly ✅

**Day 1-2:** Apple reviews version 1.0
- If approved → Pro Monthly becomes "Ready for Sale"
- Trade Monthly might auto-approve or stay "Waiting for Review"

**Day 2:** Check Trade Monthly status
- If approved → Proceed to Step 3 (create version 1.0.1)
- If not approved → Submit Trade Monthly for review (Step 1)

**Day 3-4:** If you submitted Trade Monthly for review, wait for approval

**Day 5:** Once Trade Monthly approved:
- Add to RevenueCat offering
- Create version 1.0.1
- Submit to Apple

**Day 6-7:** Apple reviews version 1.0.1

**Day 8:** Both subscriptions live! 🎉

---

## Alternative: Faster Approach (If Trade Auto-Approves)

If Trade Monthly automatically approves when Pro Monthly does:

**Day 1-2:** Version 1.0 approved
- Check Trade Monthly status
- If also approved, immediately add to RevenueCat offering

**No new app version needed!** Just add Trade to RevenueCat offering and it will work in the existing app.

Then submit version 1.0.1 later with updated "What's New" mentioning Trade plan.

---

## Testing Trade Monthly

Once Trade is in RevenueCat offering:

1. Open YapMate in TestFlight
2. Go to Pricing page
3. **Trade plan should now show "Start Free Trial" button** (not greyed out)
4. Tap it and complete purchase
5. Should work exactly like Pro Monthly did

---

## What If Trade Monthly Gets Rejected?

Unlikely, but if it happens:

1. Read Apple's feedback
2. Fix the product metadata in App Store Connect
3. Resubmit just the Trade Monthly product
4. Don't need to resubmit app version

---

## Summary

**Short version:**
1. Wait for version 1.0 approval (Pro Monthly)
2. Submit Trade Monthly for review (if not auto-approved)
3. Once Trade approved, add to RevenueCat offering
4. Create version 1.0.1 with both subscriptions attached
5. Submit version 1.0.1

**Fastest path:**
- If Trade auto-approves with Pro, just add to RevenueCat offering
- Users can purchase immediately
- Submit version 1.0.1 later for App Store listing

**No code changes needed** - everything is already in place!
