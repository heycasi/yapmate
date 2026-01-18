# RevenueCat Configuration Verification Checklist

**Date:** January 9, 2026
**Issue:** Apple App Review rejection - "app failed to proceed with in app purchase buying process"
**Device:** iPad Air 11-inch (M3), iPadOS 26.2

## Critical Checks to Perform in RevenueCat Dashboard

### 1. App Store Connect API Key Configuration

**Location:** RevenueCat → Apps → YapMate AI Ltd (App Store) → App Store Connect API

✅ **Verify:**
- [ ] Key ID: `3F2Y8ZU6GF` is uploaded
- [ ] Issuer ID: `116b1e2c-6820-4ed2-9315-bd0b19ed86d0` is correct
- [ ] Key file `AuthKey_3F2Y8ZU6GF.p8` is properly uploaded
- [ ] Status shows "Connected" (not "Could not check")

### 2. Product Configuration

**Location:** RevenueCat → Products

✅ **Pro Monthly:**
- [ ] Product ID: `com.yapmate.pro.monthly`
- [ ] Status: Should show "Ready to Submit" or "Approved" (NOT "Could not check")
- [ ] Store: App Store
- [ ] Type: Subscription

✅ **Trade Monthly:**
- [ ] Product ID: `com.yapmate.trade.monthly`
- [ ] Status: Note current status (Waiting for Review / Ready to Submit)
- [ ] Store: App Store
- [ ] Type: Subscription

### 3. Offerings Configuration ⚠️ CRITICAL

**Location:** RevenueCat → Offerings

✅ **Default Offering:**
- [ ] Offering identifier: `default` (must match exactly)
- [ ] Is marked as "Current Offering" (green checkmark)
- [ ] **Packages in this offering:**
  - [ ] **Pro Monthly** - MUST be included
  - [ ] **Trade Monthly** - Should be REMOVED if status is "Waiting for Review"

**CRITICAL:** If Trade Monthly is in "Waiting for Review" status in App Store Connect, it MUST be removed from the offering. Apple's sandbox cannot test products in this state.

### 4. Entitlements Configuration

**Location:** RevenueCat → Entitlements

✅ **Pro Entitlement:**
- [ ] Identifier: `pro` (lowercase)
- [ ] Products attached: `com.yapmate.pro.monthly`

✅ **Trade Entitlement:**
- [ ] Identifier: `trade` (lowercase)
- [ ] Products attached: `com.yapmate.trade.monthly`

### 5. App Store Connect Verification

**Location:** App Store Connect → In-App Purchases → Subscriptions

✅ **Pro Monthly (`com.yapmate.pro.monthly`):**
- [ ] Status: "Ready to Submit" or "Waiting for Review"
- [ ] Subscription Group: YapMate Subscriptions
- [ ] Price: £15.00
- [ ] Free Trial: 7 days
- [ ] **Attached to version 1.0:** YES ✅

✅ **Trade Monthly (`com.yapmate.trade.monthly`):**
- [ ] Status: Note current status
- [ ] If "Waiting for Review": Cannot be added to new versions until approved
- [ ] If attached to version 1.0: Note this

## Common Issues and Fixes

### Issue 1: Products Show "Could not check" in RevenueCat

**Cause:** App Store Connect API key not configured or incorrect

**Fix:**
1. Go to RevenueCat → Apps → YapMate AI Ltd → App Store Connect API
2. Upload `AuthKey_3F2Y8ZU6GF.p8`
3. Enter Key ID: `3F2Y8ZU6GF`
4. Enter Issuer ID: `116b1e2c-6820-4ed2-9315-bd0b19ed86d0`
5. Click Save
6. Wait 5 minutes and refresh - status should change to "Ready to Submit"

### Issue 2: Offering Includes Unavailable Products

**Cause:** Trade Monthly in "Waiting for Review" status but still in offering

**Fix:**
1. Go to RevenueCat → Offerings → default
2. Remove Trade Monthly package
3. Keep only Pro Monthly package
4. Click Save
5. Verify offering now shows only 1 package

### Issue 3: Purchase Fails with "Product not found"

**Cause:** Product not in current offering or offering not synced

**Fix:**
1. Verify offering configuration (see Issue 2)
2. In RevenueCat, go to Offerings
3. Ensure "default" is marked as Current Offering (green checkmark)
4. If not, click "Make Current"
5. Save and wait 5 minutes for sync

### Issue 4: Products Not Available in Sandbox

**Cause:** Products not submitted with app version

**Fix:**
1. Go to App Store Connect → App Information → In-App Purchases
2. Verify Pro Monthly is listed
3. Go to version 1.0 → In-App Purchases and Subscriptions
4. Verify Pro Monthly is attached to version 1.0
5. If not attached, add it and resubmit

## Steps to Reproduce Issue (For Testing)

**On iPad Air (or any iOS device):**

1. Sign out of Apple ID in Settings → App Store
2. Sign in with Apple sandbox tester account
3. Open YapMate app
4. Navigate to Pricing page
5. Tap "Start Free Trial" on Pro plan
6. Apple StoreKit purchase sheet should appear
7. Complete purchase with sandbox account
8. **Expected:** Purchase succeeds, redirects to /finish-setup
9. **If it fails:** Check console logs for detailed error

## Next Steps After Verification

1. ✅ Fix any issues found in RevenueCat dashboard
2. ✅ Update iOS app code (already done - improved error handling)
3. ✅ Build new version with fixes
4. ✅ Test in sandbox with TestFlight
5. ✅ Submit new build to Apple for review

## Console Log Keywords to Search For

If Apple provides console logs, search for:
- `[IAP] ===== STARTING PURCHASE =====`
- `[IAP] ❌ PRODUCT NOT FOUND`
- `[IAP] Offerings fetched successfully`
- `[IAP] Current offering:`
- `[IAP] Available products:`
- `[Pricing] Purchase failed:`
- `[Pricing] No offerings available`

## Contact Information

**RevenueCat Support:** support@revenuecat.com
**Apple Developer Support:** https://developer.apple.com/contact/
**API Key Location:** User's secure storage (AuthKey_3F2Y8ZU6GF.p8)
