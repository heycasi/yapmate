# Trade Tier - Disabled for v1.0

**Status:** ❌ DISABLED
**Date Disabled:** January 14, 2026
**Reason:** Shipping Free + Pro only for initial App Store submission
**Planned Re-enablement:** After v1.0 approval

---

## What Was Disabled

The **Trade tier** (£25/month) has been temporarily removed from the app to simplify the initial App Store submission. This tier included:

### Features (Trade-only)
- ✅ Everything in Pro (unlimited invoices, VAT, Reverse Charge)
- ✅ **CIS deduction** (Construction Industry Scheme tax calculation)
- ✅ **Bank details on invoices** (payment information display)
- ✅ **Priority support**

### Product Configuration
- **Product ID:** `com.yapmate.trade.monthly`
- **Entitlement ID:** `trade` (RevenueCat)
- **Price:** £25.00/month (GBP)
- **Trial:** 7-day free trial
- **Subscription Group:** YapMate Subscriptions (ID: 21571031)

### Files Modified
The following files had Trade references removed or gated behind `isTradeEnabled()`:
1. `app/pricing/page.tsx` - Trade pricing card removed
2. `app/settings/page.tsx` - CIS toggle hidden
3. `lib/iap.ts` - Trade product/entitlement gated
4. `lib/plan-access.ts` - Trade plan limits gated
5. `supabase/functions/sync-revenuecat/index.ts` - Trade tier sync gated
6. `ios/App/YapMate.storekit` - Trade product commented out

---

## How to Re-Enable Trade Tier

Follow these steps **in order** to bring Trade tier back:

### 1. Environment Variable (5 minutes)

**In `.env.local`:**
```bash
# Change this line from false to true:
NEXT_PUBLIC_ENABLE_TRADE_TIER=true
```

**In production deployment:**
- Set the same environment variable in your hosting platform (Vercel, etc.)

### 2. RevenueCat Dashboard (10 minutes)

**Add Trade Product:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to: **Project → Products**
3. Click "Add Product"
4. Enter Product ID: `com.yapmate.trade.monthly`
5. Select platform: iOS
6. Save

**Add Trade Entitlement:**
1. Navigate to: **Project → Entitlements**
2. Click "Add Entitlement"
3. Enter Entitlement ID: `trade`
4. Attach product: `com.yapmate.trade.monthly`
5. Save

**Add to Default Offering:**
1. Navigate to: **Project → Offerings**
2. Select offering: `default` (or create if missing)
3. Click "Add Package"
4. Select product: `com.yapmate.trade.monthly`
5. Package identifier: `trade` (or `$rc_monthly`)
6. Save and mark as "Current Offering"

### 3. App Store Connect (20 minutes)

**Create Trade Monthly IAP:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to: **My Apps → YapMate AI → In-App Purchases**
3. Click "+" to create new IAP
4. Select: **Auto-Renewable Subscription**
5. Reference Name: `Trade Monthly`
6. Product ID: `com.yapmate.trade.monthly`
7. Subscription Group: `YapMate Subscriptions` (ID: 21571031)
8. Subscription Duration: `1 Month`
9. Price: `£25.00` (Tier 25 or custom pricing)

**Add Free Trial:**
1. In the same IAP configuration
2. Subscription Prices → Add Introductory Offer
3. Type: `Free`
4. Duration: `7 days`
5. Save

**Add App Review Information:**
1. Still in IAP configuration
2. Upload screenshot showing Trade tier in Pricing page
3. Add review notes: "Trade tier includes CIS deduction for UK contractors"
4. Click "Submit for Review"

**Attach to App Version:**
1. Go to version in App Store Connect (e.g., 1.1)
2. Scroll to "In-App Purchases and Subscriptions"
3. Click "+" and select `Trade Monthly`
4. Save

### 4. Uncomment StoreKit Configuration (2 minutes)

**File:** `ios/App/YapMate.storekit`

Find the commented-out Trade configuration (around line 107-114) and uncomment it:

```json
{
  "displayPrice" : "25",
  "familyShareable" : false,
  "internalID" : "6739002870",
  "localizations" : [
    {
      "description" : "Trade monthly subscription with 7-day free trial",
      "displayName" : "Trade Monthly",
      "locale" : "en_GB"
    }
  ],
  "productID" : "com.yapmate.trade.monthly",
  "referenceName" : "Trade Monthly",
  // ... rest of config
}
```

### 5. Rebuild & Deploy (10 minutes)

```bash
# 1. Clean build
npm run lint
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open Xcode and archive
npm run ios
# OR
open ios/App/App.xcworkspace

# 4. In Xcode:
# - Increment build number
# - Product → Clean Build Folder
# - Product → Archive
# - Distribute to App Store

# 5. Deploy web build (if applicable)
# Follow your deployment process
```

### 6. Test Thoroughly (30 minutes)

**On iPad device:**
- [ ] Trade card appears on Pricing page
- [ ] Trade card shows "Start Free Trial" button
- [ ] Tapping button initiates purchase flow
- [ ] Purchase completes successfully
- [ ] CIS toggle appears in Settings
- [ ] CIS toggle works correctly
- [ ] Invoices can use CIS deduction
- [ ] Bank details appear on invoices (if configured)

**Backend verification:**
- [ ] Check RevenueCat dashboard shows Trade purchase
- [ ] Check Supabase `subscriptions` table shows `plan: 'trade'`
- [ ] Check `user_preferences` table shows `plan: 'trade'`
- [ ] User can access CIS features after purchase

---

## Files to Review When Re-enabling

When you set `NEXT_PUBLIC_ENABLE_TRADE_TIER=true`, check these files to ensure Trade is properly restored:

1. **`app/pricing/page.tsx`**
   → Trade card should render
   → Purchase flow should include 'trade' option

2. **`app/settings/page.tsx`**
   → CIS toggle should appear for Trade users
   → Trade plan should display in subscription status

3. **`lib/plan-access.ts`**
   → `canUseCIS()` should return true for Trade users
   → Trade plan limits should be active

4. **`lib/iap.ts`**
   → Trade product ID should be usable
   → Trade entitlement should be checked

5. **`supabase/functions/sync-revenuecat/index.ts`**
   → Trade tier should sync to database correctly

---

## Configuration Reference

All Trade tier configuration is preserved in:
- **`trade-tier-config.ts`** (in this directory)

This file contains:
- Product IDs and entitlement IDs
- Pricing and trial configuration
- Feature flags and limits
- Marketing copy and UI text
- StoreKit configuration
- RevenueCat configuration

**DO NOT DELETE** these files - they are the source of truth for Trade tier.

---

## Notes

- Trade tier was the most complex tier (CIS features, bank details)
- Original implementation tested and working before disable
- Feature flag pattern allows instant re-enablement
- No code was deleted, only gated behind `isTradeEnabled()`
- Database schema still supports `plan: 'trade'`

---

## Contact

For questions about re-enabling Trade tier:
- Check this README first
- Review `trade-tier-config.ts` for all configuration
- Test on sandbox environment before production
- Ensure App Store Connect approval before going live

**Last Updated:** January 14, 2026
**Author:** Claude Code (automated refactor)
