# Apple App Review Rejection - January 12, 2026

**Status:** REJECTED (3rd rejection)
**Submission ID:** de9fa1be-8a6c-4290-991d-56e8c26ea81b
**Review Date:** January 12, 2026
**Version:** 1.0
**Review Device:** iPad Air 11-inch (M3), iPadOS 26.2

---

## Rejection Timeline

**1st Rejection (Jan 7, 2026):**
- Guideline 5.1.1 - Forced account creation before IAP
- ✅ FIXED: Implemented anonymous purchase flow (Commit 718443f)

**2nd Rejection (Jan 8-9, 2026):**
- Guideline 2.1 - Purchase flow race condition
- ✅ FIXED: Added loading state checks and enhanced error handling

**3rd Rejection (Jan 12, 2026):**
- ❌ 6 NEW ISSUES (detailed below)

---

## Issue Breakdown

### Issue 1: Account Deletion Not Available (Guideline 5.1.1(v))

**Apple's Feedback:**
> "The app supports account creation but does not include an option to initiate account deletion."

**Requirements:**
- Account deactivation is insufficient - must provide FULL account deletion
- Can be implemented in-app OR via website (with direct link from app)
- Confirmation steps are allowed
- For non-regulated industries: Cannot require phone call or email to initiate deletion
- Must delete user's personal data associated with account

**Current State:**
- ❌ No account deletion option in Settings
- ❌ No link to web-based deletion flow
- ✅ User account creation exists (Settings → Create Account)

**Fix Required:**
- [ ] Code: Add "Delete Account" button in Settings page
- [ ] Code: Implement account deletion flow (confirm → delete user_preferences, subscriptions, invoices)
- [ ] Backend: Create Supabase edge function for account deletion
- [ ] OR: Create web page for deletion with link from Settings

**Priority:** HIGH (blocking approval)

---

### Issue 2: Missing Terms/Privacy Links in Subscription UI (Guideline 3.1.2)

**Apple's Feedback:**
> "The subscription purchase flow must include functional links to your Terms of Use and Privacy Policy."

**Requirements:**
- Links to Terms (EULA) and Privacy Policy must be visible in subscription purchase UI
- Must be functional (actually navigate to the pages)
- Apple suggests using `SubscriptionStoreView` or adding manually to pricing page

**Current State:**
- ✅ Privacy Policy exists at `/privacy`
- ❌ No Terms of Use / EULA page
- ❌ No links to these pages on `/pricing` page
- ✅ Footer links exist on home page but not in purchase flow

**Fix Required:**
- [ ] Code: Create Terms of Use page (`/terms`)
- [ ] Code: Add "Terms" and "Privacy Policy" links to `/pricing` page footer
- [ ] Code: Ensure links are visible BEFORE user taps "Start Free Trial"
- [ ] Content: Write Terms of Use / EULA content

**Priority:** HIGH (blocking approval)

---

### Issue 3: No Restore Purchases Button (Guideline 3.1.1)

**Apple's Feedback:**
> "The app must include a distinct 'Restore' button that users can tap to restore purchases."

**Requirements:**
- Must have a user-visible "Restore Purchases" button
- Auto-restore on launch does NOT satisfy this requirement
- Can be in Settings, Pricing page, or subscription management screen

**Current State:**
- ✅ `restorePurchases()` function exists in `lib/iap.ts`
- ❌ No user-facing button to trigger restore
- ❌ No restore option in Settings
- ❌ No restore option on Pricing page

**Fix Required:**
- [ ] Code: Add "Restore Purchases" button to Settings page
- [ ] Code: Add "Restore Purchases" link to Pricing page (below plans)
- [ ] Code: Wire button to `restorePurchases()` function
- [ ] Code: Show success/failure feedback after restore

**Priority:** HIGH (blocking approval)

---

### Issue 4: Trade Plan Purchase Error (Guideline 2.1)

**Apple's Feedback:**
> "The app displayed an error message when trying to purchase 'Trade' plan."

**Device:** iPad Air 11-inch (M3), iPadOS 26.2

**Current State:**
- ✅ Trade Monthly product exists: `com.yapmate.trade.monthly`
- ⚠️ Trade Monthly NOT in RevenueCat "default" offering (removed for safety)
- ⚠️ Trade Monthly status: "Waiting for Review" in App Store Connect
- ✅ Trade plan UI exists on Pricing page

**Root Cause:**
Trade Monthly was removed from RevenueCat offering after previous rejection. When user taps "Start Free Trial" on Trade plan:
1. App looks for `com.yapmate.trade.monthly` in offerings
2. Product not found in offerings
3. Purchase fails with "Product not found" error

**Fix Required:**
- [ ] App Store Connect: Submit Trade Monthly IAP for review (with screenshot)
- [ ] App Store Connect: Attach Trade Monthly to version 1.0
- [ ] RevenueCat: Add Trade Monthly back to "default" offering AFTER approval
- [ ] Code: Handle "product not available" gracefully (show "Coming Soon" instead of error)
- [ ] Decision: Remove Trade plan from UI entirely until approved OR show "Coming Soon"

**Priority:** HIGH (blocking approval)
**Blocker:** Trade IAP needs App Store Connect approval before it can work

---

### Issue 5: Trade IAP Not Submitted for Review (Guideline 2.1)

**Apple's Feedback:**
> "The app includes references to Trade subscription but the associated in-app purchase products have not been submitted for review. To resolve this issue, please submit your in-app purchase products for review using the 'Submit for Review' link in the In-App Purchases section of App Store Connect."

**Requirements:**
- Must submit Trade Monthly IAP with App Review screenshot
- Must attach IAP to app version being reviewed
- Screenshot must show how to access the IAP in the app

**Current State:**
- ⚠️ Trade Monthly exists but not attached to version 1.0
- ⚠️ Trade Monthly status: "Waiting for Review"
- ❌ Trade Monthly not submitted with App Review screenshot

**Fix Required:**
- [ ] App Store Connect: Go to In-App Purchases → Trade Monthly
- [ ] App Store Connect: Upload App Review screenshot showing Trade plan on Pricing page
- [ ] App Store Connect: Click "Submit for Review"
- [ ] App Store Connect: Go to version 1.0 → In-App Purchases section
- [ ] App Store Connect: Add Trade Monthly to version 1.0

**Priority:** CRITICAL (must be done in App Store Connect before resubmission)

---

### Issue 6: iPad Screenshots Show Only Login (Guideline 2.3.3)

**Apple's Feedback:**
> "The 13-inch iPad screenshots only display a login screen. Please update your screenshots to accurately reflect the app in use on the corresponding device."

**Requirements:**
- Screenshots must show core app functionality
- Must NOT show only splash screens, login screens, or empty states
- Must demonstrate app in use on iPad
- Screenshots must match device size (13-inch iPad Pro)

**Current State:**
- ❌ Current iPad screenshots only show login screen
- ✅ iPhone screenshots likely show proper functionality

**Fix Required:**
- [ ] Design: Take new iPad screenshots on 13-inch iPad Pro
- [ ] Screenshots needed:
  - Pricing page (showing subscription options)
  - Recording page (showing voice-to-invoice flow)
  - Invoice preview (showing generated PDF)
  - Settings page (showing account management)
  - Dashboard with invoices list
- [ ] App Store Connect: Upload new 13-inch iPad screenshots
- [ ] App Store Connect: Upload 11-inch iPad screenshots if required

**Priority:** CRITICAL (must be done before resubmission)

---

## Fix Categorization

### Code Changes (4 issues)
1. **Account Deletion** - New feature, moderate complexity
2. **Terms/Privacy Links** - Simple, add links to pricing page
3. **Restore Purchases Button** - Simple, wire existing function to UI
4. **Trade Plan Handling** - Either remove from UI or show "Coming Soon"

### App Store Connect Changes (2 issues)
5. **Trade IAP Submission** - Must submit with screenshot and attach to version
6. **iPad Screenshots** - Must take and upload proper screenshots

---

## Recommended Action Plan

### Phase 1: Documentation & Planning (CURRENT)
- [x] Document all 6 issues in this file
- [ ] Propose CLAUDE.md outline
- [ ] Get approval on approach

### Phase 2: App Store Connect Fixes (DO FIRST)
These must be done before code changes because they inform what to build:

**Issue 5 - Submit Trade IAP:**
1. Take screenshot of Pricing page on iPad showing Trade plan
2. Upload to Trade Monthly IAP in App Store Connect
3. Submit Trade Monthly for review
4. Attach to version 1.0

**Issue 6 - iPad Screenshots:**
1. Build current version on iPad
2. Take 5 screenshots showing functionality
3. Upload to App Store Connect

### Phase 3: Code Fixes (Critical Path)
Fix in this order:

**Issue 3 - Restore Purchases (30 min):**
- Add button to Settings page
- Wire to existing `restorePurchases()` function
- Test in sandbox

**Issue 2 - Terms/Privacy Links (1 hour):**
- Create `/terms` page with EULA content
- Add links to Pricing page footer
- Test navigation

**Issue 1 - Account Deletion (3-4 hours):**
- Add "Delete Account" to Settings
- Create deletion confirmation flow
- Create Supabase edge function to delete user data
- Test thoroughly (this is sensitive!)

**Issue 4 - Trade Plan Handling (30 min):**
- Decision: Remove Trade plan from UI until approved OR
- Show "Coming Soon" badge on Trade plan
- OR: Only show Trade after checking if available in offerings

### Phase 4: Build & Test
- Increment build number to 16
- Test all 6 fixes on iPad
- Submit to TestFlight
- Internal testing
- Resubmit to Apple

---

## Testing Checklist Before Resubmission

### Account Deletion Flow
- [ ] Delete account button visible in Settings
- [ ] Confirmation dialog appears
- [ ] Account deleted from Supabase
- [ ] User logged out after deletion
- [ ] Subscription cancelled or transferred properly

### Terms/Privacy Links
- [ ] Links visible on Pricing page
- [ ] Terms page loads and displays content
- [ ] Privacy Policy page loads
- [ ] Links work before purchase flow starts

### Restore Purchases
- [ ] Button visible in Settings
- [ ] Button works (calls RevenueCat restore)
- [ ] Success message shown if purchases restored
- [ ] Error message shown if restore fails

### Trade Plan
- [ ] Either removed from UI OR
- [ ] Shows "Coming Soon" OR
- [ ] Purchase works without error
- [ ] Error message is user-friendly if product unavailable

### iPad Screenshots
- [ ] 5+ screenshots uploaded to App Store Connect
- [ ] Screenshots show core functionality
- [ ] No login/splash screens
- [ ] Proper iPad dimensions (13-inch)

---

## Message to Apple (After Fixes)

**Suggested review notes:**

```
Dear App Review Team,

Thank you for your detailed feedback on submission de9fa1be-8a6c-4290-991d-56e8c26ea81b.

We have addressed all 6 issues identified in your review:

1. ✅ Account Deletion: Added "Delete Account" option in Settings with full data deletion
2. ✅ Terms & Privacy: Added functional links to Terms of Use and Privacy Policy on Pricing page
3. ✅ Restore Purchases: Added "Restore Purchases" button in Settings and Pricing page
4. ✅ Trade Plan: [Removed from UI / Added "Coming Soon" badge / Now functional]
5. ✅ Trade IAP: Submitted Trade Monthly subscription with App Review screenshot and attached to version 1.0
6. ✅ iPad Screenshots: Uploaded new screenshots showing core app functionality on 13-inch iPad Pro

Testing Instructions:
- Account Deletion: Settings → Account → Delete Account
- Restore Purchases: Settings → Restore Purchases OR Pricing page → "Restore Purchases" link
- Terms/Privacy: Pricing page → Links at bottom before purchase
- Trade Plan: Pricing page → [Should now work / Shows "Coming Soon"]

All changes have been tested on iPad Air 11-inch (M3) with iPadOS 26.2.

Thank you for your patience,
Connor Dahl
```

---

## Known Technical Debt (Related Issues)

These aren't blocking but should be addressed:

1. **Upgrade prompts when hitting limits** - Users must manually navigate to /pricing when they hit 3-invoice limit
2. **Mid-session subscription changes** - No real-time listener for trial expiry
3. **Offline handling** - Basic error handling, no retry logic or offline detection
4. **Trade plan availability** - Need to check offerings before showing plan in UI

---

## Related Files

- Previous rejection (Jan 8-9): `APPLE_ISSUE_BREAKDOWN_JAN_9_2026.md`
- Guideline 5.1.1 fix: `CHANGELOG_GUIDELINE_5_1_1.md`
- Build guide: `BUILD_AND_TEST_GUIDE.md`
- Sandbox testing: `SANDBOX_TESTING_GUIDE.md`

---

**Next Steps:**
1. ✅ Document rejection (this file)
2. ⏳ Create CLAUDE.md with architecture decisions and current blockers
3. ⏳ Get approval on fix approach
4. ⏳ Execute Phase 2 (App Store Connect fixes)
5. ⏳ Execute Phase 3 (Code fixes)
6. ⏳ Test, build, and resubmit
