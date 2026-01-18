# YapMate AI - Claude Code Developer Guide

**Last Updated:** January 14, 2026
**Purpose:** Comprehensive reference for iOS development, RevenueCat subscriptions, and App Store workflows

For UI/UX design patterns, see `DESIGN_GUIDELINES.md`

---

## Project Overview

### What is YapMate?
Voice-powered invoice assistant for UK tradespeople. Users speak job details, app generates professional invoices with VAT/CIS calculations.

**Tech Stack:**
- Frontend: Next.js 14 (static export)
- Mobile: Capacitor 6 (iOS native wrapper)
- Backend: Supabase (auth, database, edge functions)
- Monetization: iOS subscriptions via RevenueCat + StoreKit 2
- AI: OpenAI API (speech-to-text, invoice generation)

**Key Identifiers:**
- Bundle ID: `com.yapmate.app`
- App Store Name: YapMate AI
- Current Version: 1.0
- Subscription Group: YapMate Subscriptions (ID: 21571031)

**Current Status:**
- App Store: REJECTED (3rd time - Jan 12, 2026)
- Latest Build: 12-15 range
- Blocking Issues: 2 remaining (App Store Connect tasks - see Phase 1 below)
- Code Issues: 4/4 COMPLETED ✅ (see Phase 2 below)

---

## Current Blockers (HIGH PRIORITY)

**Status:** App rejected Jan 12, 2026. Must fix all 6 issues before resubmission.
**Full Details:** See `APPLE_ISSUE_BREAKDOWN_JAN_12_2026.md`

### Fix Priority Order

#### Phase 1: App Store Connect (Do First - No Code Needed)

**Issue 5: Trade IAP Not Submitted** ⚠️ CRITICAL
- Guideline 2.1
- Action: Submit Trade Monthly IAP with App Review screenshot, attach to version 1.0
- Steps:
  1. Take screenshot of Pricing page on iPad showing Trade plan
  2. App Store Connect → In-App Purchases → Trade Monthly
  3. Upload screenshot
  4. Click "Submit for Review"
  5. Go to version 1.0 → In-App Purchases section → Add Trade Monthly

**Issue 6: iPad Screenshots Show Only Login** ⚠️ CRITICAL
- Guideline 2.3.3
- Action: Take and upload 5 new screenshots on 13-inch iPad Pro
- Screenshots needed:
  - Pricing page (showing subscription options)
  - Recording page (showing voice-to-invoice)
  - Invoice preview (showing generated PDF)
  - Settings page (showing account management)
  - Dashboard with invoices list
- App Store Connect → version 1.0 → iPad Screenshots → Upload

#### Phase 2: Code Changes (COMPLETED ✅)

**Issue 1: Account Deletion Not Available** ✅ COMPLETED
- Guideline 5.1.1(v)
- Implementation:
  - Created edge function: `supabase/functions/delete-account/index.ts`
  - Added "Delete Account" section in Settings with confirmation dialog
  - Deletes auth user (cascades to all data tables automatically)
  - Edge function deployed to Supabase
- Files: `app/settings/page.tsx`, `supabase/functions/delete-account/index.ts`
- Test Path: Settings → Scroll to "Delete Account" → Confirm deletion

**Issue 2: Missing Terms/Privacy Links** ✅ COMPLETED
- Guideline 3.1.2
- Implementation:
  - Created Terms of Use page: `app/terms/page.tsx`
  - Added Terms & Privacy links to Pricing page (visible before purchase buttons)
  - Links appear in dedicated section above FAQ
- Files: `app/terms/page.tsx`, `app/pricing/page.tsx`
- Test Path: Pricing page → Scroll to bottom → Click "Terms of Use" or "Privacy Policy"

**Issue 3: No Restore Purchases Button** ✅ COMPLETED
- Guideline 3.1.1
- Implementation:
  - Added "Restore Purchases" button in Settings (iOS only)
  - Added "Restore Purchases" link on Pricing page (iOS only)
  - Wired to existing `restorePurchases()` in `lib/iap.ts`
  - Shows success/failure feedback
- Files: `app/settings/page.tsx`, `app/pricing/page.tsx`
- Test Path (Settings): Settings → "Subscription Management" section → "Restore Purchases" button
- Test Path (Pricing): Pricing page → Bottom section → "Restore Purchases" link

**Issue 4: Trade Plan Purchase Error** ✅ COMPLETED
- Guideline 2.1
- Implementation:
  - Added conditional rendering based on offering availability
  - Checks if Trade product exists in RevenueCat offerings on load
  - Shows "Coming Soon" badge if not available
  - Button disabled if product not found
  - Prevents purchase attempt errors
- Files: `app/pricing/page.tsx`
- Test Path: Pricing page → Trade plan card (shows "Coming Soon" if unavailable)

### Resubmission Checklist

Before building and resubmitting:

**App Store Connect:**
- [ ] Trade IAP submitted with screenshot
- [ ] Trade IAP attached to version 1.0
- [ ] 5 new iPad screenshots uploaded (13-inch iPad Pro)

**Code:**
- [✅] Terms of Use page created (`/terms`)
- [✅] Terms & Privacy links visible on Pricing page
- [✅] Restore Purchases button in Settings
- [✅] Restore Purchases link on Pricing page
- [✅] Delete Account button in Settings
- [✅] Delete Account edge function deployed
- [✅] Trade plan UI fixed (conditional rendering with "Coming Soon" badge)

**Testing:**
- [ ] Test account deletion flow on device
- [ ] Test restore purchases on device
- [ ] Test Terms/Privacy links work
- [ ] Test Trade plan doesn't error (or is hidden)
- [ ] All tests done on iPad Air or iPad Pro

---

## Architecture Decisions

### Why RevenueCat Instead of Native StoreKit 2?

**Reasons:**
1. **Server-side subscription state management**
   - Supabase edge function (`supabase/functions/sync-revenuecat/index.ts`) syncs RevenueCat customer info to database
   - Updates `subscriptions` table and `user_preferences.plan`

2. **Cross-platform ready**
   - Android setup present in `capacitor.config.ts` (`androidScheme: 'https'`)
   - RevenueCat SDK supports both iOS and Android

3. **Entitlement abstraction**
   - Maps product IDs → feature flags
   - Entitlements: `pro`, `trade` (configured in RevenueCat dashboard)
   - Easier to check `hasEntitlement('pro')` than managing product IDs

4. **Anonymous-to-authenticated user flow**
   - Critical for App Store Guideline 5.1.1 compliance
   - RevenueCat allows anonymous purchases, then merge with authenticated accounts via `linkUser()`
   - User can purchase without account, create account later

**What RevenueCat Does NOT Do:**
- No webhook handlers (sync is client-triggered after purchase)
- No automatic trial expiry notifications (we don't use customer info listeners yet)

### Subscription Products

**Pro Monthly:**
- Product ID: `com.yapmate.pro.monthly`
- Price: £15.00/month
- Trial: 7 days free
- Entitlement: `pro`
- Features: Unlimited invoices, VAT support, Reverse Charge, customer list, clean PDFs

**Trade Monthly:**
- Product ID: `com.yapmate.trade.monthly`
- Price: £25.00/month
- Trial: 7 days free
- Entitlement: `trade`
- Features: Everything in Pro + CIS deduction, bank details on invoice, priority support

**Configuration:**
- Subscription Group: YapMate Subscriptions (ID: 21571031)
- Locale: en_GB (UK)
- Currency: GBP
- Both products share same subscription group (users can upgrade/downgrade)

### Paywall Trigger Points

**Current Implementation:**
1. **Manual navigation** - "Pricing" link in header (always visible to all users)
2. **Feature gating exists** - `lib/plan-access.ts` implements limits:
   - Free plan: 3 invoices max
   - Pro/Trade: Unlimited invoices
   - VAT: Pro and Trade only
   - CIS: Trade only

**Current Limitation:**
When free user hits 3-invoice limit → sees error message → must manually navigate to `/pricing`

**RECOMMENDATION (Not Blocking):**
Add proactive upgrade prompts when limits hit. Implementation:
- In record flow, check `canCreateInvoice()` before processing
- If limit reached, show modal: "Upgrade to Pro for unlimited invoices"
- Modal has "Upgrade" button → navigates to `/pricing`
- User can dismiss and navigate manually

### Subscription Status Updates

**Current Implementation:**
- Check-on-mount only (no real-time listeners)
- Status loaded when `useSubscription()` hook mounts
- `getUserPlan()` queries RevenueCat/Supabase on-demand

**Limitation:**
If trial expires mid-session → features remain unlocked until app restart

**TECHNICAL DEBT (Not Blocking):**
Add RevenueCat customer info update listener for real-time status changes.

Implementation:
```
// In IAPProvider or similar
import { Purchases } from '@revenuecat/purchases-capacitor'

Purchases.addCustomerInfoUpdateListener((customerInfo) => {
  // Update React state
  // Trigger re-sync to Supabase
  // Show UI notification if subscription expired
})
```

### Offline/Network Error Handling

**Current Implementation:**
- Race condition fix: Prevents purchase while offerings load
- Single retry: If no offerings, attempts reload once
- Error messages shown for 8 seconds
- Purchase sync failure: Shows "Purchase succeeded but sync failed. Please contact support."

**Limitations:**
- No proactive offline detection (`navigator.onLine`)
- No automatic retry with exponential backoff
- If device is offline when paywall loads → offerings fail silently

**CRITICAL IMPROVEMENT NEEDED (Apple Feedback):**
Must improve offline handling before resubmission.

Recommended:
1. Check `navigator.onLine` before loading offerings
2. Show offline indicator if no network
3. Implement retry queue for failed operations
4. Add exponential backoff for network requests

---

## iOS Build & Deploy Workflow

### Prerequisites

- Xcode 15+
- Apple Developer Program active ($99/year)
- `.env.local` with production API keys:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  NEXT_PUBLIC_REVENUECAT_IOS_KEY=appl_UEgIczjDOxxBNzwMrWabgaKLnxy
  ```
- `capacitor.config.ts`: `DEV_MODE = false`

### Build Process (Manual - No Fastlane)

**Step 1: Build Next.js**
```bash
npm run lint                 # Check for errors (must pass)
npm run build                # Build static export to out/
```

**Step 2: Sync to iOS**
```bash
npx cap sync ios             # Copy out/ to ios/App/App/public/
```

**Step 3: Open Xcode**
```bash
open ios/App/App.xcworkspace  # Or: npm run ios
```

**CRITICAL:** Always use `App.xcworkspace`, NOT `App.xcodeproj` (CocoaPods dependency)

**Step 4: Configure Build**
1. Select "Any iOS Device (arm64)" from device dropdown (NOT a simulator)
2. Select "App" target in left sidebar
3. Go to General tab → Identity section
4. Update Build number (must increment each upload - cannot reuse)
5. Version stays 1.0 unless adding new features

**Step 5: Archive**
1. Product → Clean Build Folder (Cmd+Shift+K)
2. Product → Archive
3. Wait 5-10 minutes for archive to complete

**Step 6: Distribute**
1. Window → Organizer (opens automatically after archive)
2. Select latest archive
3. Click "Distribute App"
4. Choose "App Store Connect"
5. Select "Upload"
6. Choose automatic signing
7. Review summary → Upload
8. Wait 2-5 minutes for upload

**Step 7: Wait for Processing**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → YapMate AI → TestFlight
3. Wait 10-30 minutes for build to process
4. Status changes: Processing → Ready to Submit → Missing Compliance

**Step 8: Export Compliance**
1. Click on the build when it shows "Missing Compliance"
2. "Provide Export Compliance Information"
3. Answer: **"No"** to encryption question (HTTPS doesn't count)

**Step 9: Attach to Version**
1. My Apps → YapMate AI → version 1.0
2. Build section → Click "Select Build"
3. Choose the build you just uploaded
4. Save

**Step 10: Attach IAPs**
1. On version 1.0 page, scroll to "In-App Purchases and Subscriptions"
2. Click "+" to add
3. Select Pro Monthly (and Trade Monthly if ready)
4. Save

**Step 11: Submit for Review**
1. Click "Submit for Review"
2. Answer questionnaire
3. Add review notes (see Message to Apple template below)

### Build Number Reference

Current build number range: 12-15

Next build should be: **16** (increment from whatever is current in Xcode)

### DEV_MODE Toggle

**Location:** `capacitor.config.ts`

**For Production Builds:**
```typescript
const DEV_MODE = false  // MUST be false for TestFlight/App Store
```

**For Local Development:**
```typescript
const DEV_MODE = true   // Uses DEV_URL for live reload
```

When `DEV_MODE = true`, iOS app loads from `http://192.168.1.108:3000` (or your local IP).
When `DEV_MODE = false`, iOS app loads from bundled files in `ios/App/App/public/`.

**CRITICAL:** Always set to `false` before building for TestFlight/App Store.

---

## Sandbox Testing & RevenueCat Setup

### StoreKit Configuration File

**Location:** `ios/App/YapMate.storekit`

**Configured Products:**
- Pro Monthly: £15, 7-day trial, product ID matches App Store Connect
- Trade Monthly: £25, 7-day trial, product ID matches App Store Connect
- Subscription group: YapMate Subscriptions (ID: 21571031)
- Locale: en_GB, Storefront: GBR

**Purpose:**
Allows testing IAP in Xcode simulator without hitting App Store Connect sandbox. Useful for rapid development but ALWAYS test on real device with sandbox account before submitting.

### Sandbox Account Requirements

**Where to Create:**
- App Store Connect → Users and Access → Sandbox Testers
- Create sandbox tester accounts (NOT regular Apple IDs)
- Use fake email addresses (don't need to exist)

**Testing Setup:**
1. On iOS device: Settings → App Store → Sign Out (of real Apple ID)
2. Do NOT sign into sandbox account in Settings
3. Open YapMate app and attempt purchase
4. When Apple StoreKit sheet appears, sign in with sandbox account
5. Sandbox account will be used for this session only

### Testing Anonymous Purchase (Critical for Guideline 5.1.1)

**This is what Apple tests - must work perfectly:**

1. Delete YapMate app from device
2. Reinstall from TestFlight (fresh state, no login)
3. Do NOT log into YapMate
4. Navigate to Pricing page
5. Tap "Start Free Trial" on Pro plan
6. Apple StoreKit sheet appears
7. Sign in with sandbox account when prompted
8. Confirm 7-day free trial
9. Purchase completes
10. **VERIFY:** App redirects to `/finish-setup?plan=pro`
11. **VERIFY:** User can tap "Not Now - Start Using" (skip account creation)
12. **VERIFY:** Pro features are accessible (check VAT option in recording)
13. **VERIFY:** No forced login or blocking

### Testing Logged-In Purchase

1. Create account or log in first
2. Navigate to Pricing page
3. Tap "Start Free Trial" on Pro plan
4. Complete purchase
5. **VERIFY:** No redirect to `/finish-setup` (already logged in)
6. **VERIFY:** Purchase syncs to Supabase (check subscriptions table)
7. **VERIFY:** Pro features accessible

### Testing Restore Purchases

1. Install YapMate on second device (or delete and reinstall)
2. Do NOT log in
3. Go to Settings → Restore Purchases (when Issue 3 is fixed)
4. **VERIFY:** Previous subscription is restored
5. **VERIFY:** Pro features unlock without login
6. **VERIFY:** Success message shown

### Canceling Subscriptions for Testing

**On Test Device:**
1. Settings → Apple ID → Subscriptions
2. Find YapMate AI - Pro Monthly
3. Tap "Cancel Free Trial" or "Cancel Subscription"
4. Confirm cancellation

**Note:** You retain access until end of trial/period, but can re-purchase immediately for testing.

---

## App Store Submission Gotchas

### Hard-Learned Lessons (3 Rejections)

**Guideline 5.1.1 - IAP Without Account**
- Must allow purchases WITHOUT account creation
- Account creation must be optional after purchase (not forced)
- Test flow: Fresh install → Purchase → Skip account → Use features
- Implementation: Use RevenueCat anonymous mode, then `RevenueCat.logIn()` to merge when user creates account
- Files: `lib/iap.ts` (linkUser function), `app/finish-setup/page.tsx` (post-purchase page)

**Guideline 5.1.1(v) - Account Deletion**
- If app supports account creation, must support account deletion
- Deactivation is NOT sufficient - must be full deletion
- Can be in-app OR via website (with direct link)
- Must delete personal data (user_preferences, subscriptions, invoices)
- Cannot require phone call or email to initiate (non-regulated industries)

**Guideline 3.1.2 - Terms & Privacy in Purchase Flow**
- Not enough to have them in footer of home page
- Must be visible in subscription UI specifically
- Apple suggests using SubscriptionStoreView or adding manually
- Links must be functional (actually navigate to pages)
- Implementation: Add links to `/pricing` page footer, visible before user taps "Start Free Trial"

**Guideline 3.1.1 - Restore Purchases**
- Auto-restore on launch does NOT satisfy requirement
- Must have user-visible "Restore" button that user explicitly taps
- Can be in Settings, Pricing page, or subscription management screen
- Implementation: Wire button to existing `restorePurchases()` in `lib/iap.ts`

**Guideline 2.1 - IAP Configuration**
- Products in "Waiting for Review" CAN cause issues if not attached to version
- ALWAYS attach IAPs to app version in App Store Connect before submission
- Include App Review screenshot showing how to access IAP in app
- Apple tests on actual devices (iPad Air 11-inch M3 was used for our reviews)
- If product isn't in RevenueCat offering, purchase will fail with "Product not found"

**Guideline 2.3.3 - Screenshots**
- iPad screenshots CANNOT show only login/splash screens
- Must show core functionality in use
- Take screenshots on correct device sizes (13-inch iPad Pro, 11-inch iPad)
- Required screenshots: Pricing, Recording/main feature, Generated output, Settings, Dashboard
- Apple will reject if screenshots don't demonstrate app's value

**Guideline 2.1 - Race Conditions**
- User can tap button before async operations complete
- Always check if offerings are loaded before allowing purchase
- Add `isLoadingOfferings` state and disable button while loading
- Show loading indicator or helpful message
- Files: `app/pricing/page.tsx` (lines 114-131)

**General Lesson: Always Test on iPad**
- Apple consistently reviews on iPad Air 11-inch (M3) for our app
- UI must work perfectly on iPad (not just iPhone)
- Test purchase flow, navigation, and all features on iPad before submitting
- Screenshots must be iPad-appropriate

---

## Key Files & Directories

### iOS Configuration

**`ios/App/App.xcworkspace`**
- Xcode workspace (ALWAYS use this, not .xcodeproj)
- Contains App target and CocoaPods dependencies

**`ios/App/YapMate.storekit`**
- StoreKit configuration for local testing
- Contains both Pro and Trade products with 7-day trials

**`capacitor.config.ts`**
- Capacitor configuration
- DEV_MODE toggle (must be false for production)
- App ID, name, webDir

**`ios/App/App/Info.plist`**
- App permissions (microphone, etc.)
- Version and build number
- URL schemes

### Subscription Logic

**`lib/iap.ts`**
- RevenueCat wrapper (603 lines)
- Functions: `configureIAP`, `getOfferings`, `purchaseProduct`, `restorePurchases`, `getCustomerInfo`, `linkUser`
- Product IDs, entitlement IDs
- Extensive logging for debugging

**`lib/iap-sync.ts`**
- Syncs RevenueCat customer info to Supabase
- `syncSubscription()` - called after purchase/restore
- `checkSubscriptionStatus()` - queries Supabase subscriptions table

**`lib/plan-access.ts`**
- Entitlement checks and feature gating
- Functions: `getUserPlan`, `canCreateInvoice`, `canUseVAT`, `canUseCIS`, `getUserInvoiceCount`
- FREE_PLAN_INVOICE_LIMIT = 3
- Implements entitlement-first access (checks RevenueCat before Supabase)

**`lib/use-subscription.ts`**
- React hook for subscription status
- Returns: `{ plan, isActive, canUseVAT, canUseCIS, isLoading, expiresAt }`
- Loads on component mount (no real-time updates)

**`supabase/functions/sync-revenuecat/index.ts`**
- Edge function for server-side subscription sync
- Updates `subscriptions` table (provider, plan, status, expiration)
- Updates `user_preferences.plan`
- Called from client after purchase

### UI Components

**`app/pricing/page.tsx`**
- Pricing/subscription UI
- Shows Free, Pro, Trade plans
- Purchase flow with error handling
- Redirects to `/finish-setup` for logged-out users

**`app/finish-setup/page.tsx`**
- Post-purchase onboarding for logged-out users
- Shows subscription is active
- Optional account creation (skip allowed)
- Explains benefits of creating account

**`app/settings/page.tsx`**
- User settings
- TODO: Add "Delete Account" button (Issue 1)
- TODO: Add "Restore Purchases" button (Issue 3)

### Documentation

**Current Status:**
- `APPLE_ISSUE_BREAKDOWN_JAN_12_2026.md` - Latest rejection (6 issues)
- `APPLE_ISSUE_BREAKDOWN_JAN_9_2026.md` - Previous rejection

**Guides:**
- `BUILD_AND_TEST_GUIDE.md` - Build process and testing
- `SANDBOX_TESTING_GUIDE.md` - IAP testing procedures
- `REVENUECAT_VERIFICATION_CHECKLIST.md` - RevenueCat config verification
- `IMMEDIATE_ACTION_PLAN.md` - Previous action plan (Jan 9)
- `ADDING_TRADE_MONTHLY_GUIDE.md` - How to add Trade tier after approval

**Design:**
- `DESIGN_GUIDELINES.md` - UI/UX patterns and "Rugged Utility" design system

---

## Common Commands

### Development
```bash
npm run dev                  # Next.js dev server (localhost:3000)
npx cap sync ios            # Sync changes to iOS
npm run ios                 # Open Xcode workspace
```

### Production Build
```bash
npm run lint                # Check for errors (must pass)
npm run build               # Build static export to out/
npx cap sync ios            # Copy to iOS bundle
open ios/App/App.xcworkspace  # Archive in Xcode
```

### Database
```bash
npm run migrate             # Run Supabase migrations
```

### Supabase Edge Functions
```bash
npx supabase functions deploy sync-revenuecat
```

---

## Debugging & Troubleshooting

### Common Issues

**"Loading subscription options, please wait..."**
- Cause: Offerings still loading when user tapped button
- Expected: User should wait 2-3 seconds and retry
- Debug: Check console for `[IAP] Offerings fetched successfully`
- If persists: Check RevenueCat API key in `.env.local`, verify internet connection

**"Product not found: com.yapmate.pro.monthly"**
- Cause: Product not in RevenueCat offering or not synced
- Fix:
  1. RevenueCat dashboard → Offerings → default
  2. Verify product is in offering
  3. Verify offering is marked as "Current Offering"
  4. Wait 5 minutes for sync
  5. Rebuild: `npx cap sync ios`

**"Purchase failed" with no details**
- Cause: Multiple possible causes
- Debug:
  1. Check Xcode console for `[IAP] ===== PURCHASE FAILED =====`
  2. Look for error code in logs
  3. Verify sandbox account is valid (App Store Connect → Sandbox Testers)
  4. Check RevenueCat API key in `.env.local`
  5. Verify internet connection
  6. Try signing out and back into sandbox account

**Build appears in Xcode Organizer but not in App Store Connect**
- Cause: Upload succeeded but processing failed
- Fix:
  1. Wait 30-60 minutes (processing can be slow)
  2. Check email for errors from Apple
  3. Verify bundle ID matches exactly: `com.yapmate.app`
  4. Check version/build number is unique (not previously uploaded)

**"Cannot connect to iTunes Store" in sandbox**
- Cause: Sandbox account issue or network problem
- Fix:
  1. Check internet connection
  2. Sign out of sandbox account: Settings → App Store → Sign Out
  3. Kill YapMate app completely
  4. Reopen YapMate and try purchase again (will prompt for sandbox login)

**No console logs in Xcode**
- Cause: Running from TestFlight or not attached to debugger
- Fix:
  1. Connect device via USB
  2. Xcode → Select device from dropdown (not "Any iOS Device")
  3. Product → Run (Cmd+R)
  4. Console appears at bottom of Xcode

### Console Log Patterns

**Success Pattern:**
```
[IAP] Platform detected: ios
[IAP] API key present: true
[IAP] ✓ RevenueCat configured successfully
[IAP] Current offering ID: default
[IAP] Available packages: 1
[Pricing] Available packages:
  - pro: com.yapmate.pro.monthly (£15.00/month)
[IAP] ===== STARTING PURCHASE =====
[IAP] Product ID: com.yapmate.pro.monthly
[IAP] ✓ FOUND! Product found in offering: default
[IAP] Initiating purchase with StoreKit...
[IAP] ===== PURCHASE SUCCESSFUL =====
[Pricing] Purchase successful
```

**Failure Pattern (Product Not Found):**
```
[IAP] ❌ PRODUCT NOT FOUND
[IAP] Searched for: com.yapmate.pro.monthly
[IAP] Available products:
  - com.yapmate.trade.monthly
```

**Failure Pattern (Offerings Not Loaded):**
```
[IAP] Offerings fetched successfully
[IAP] Current offering: NONE
[IAP] Total offerings: 0
[IAP] ⚠️ No offerings available
[Pricing] ⚠️ No offerings available from RevenueCat
```

---

## Message to Apple Template

Use this template when resubmitting after fixing the 6 issues:

```
Dear App Review Team,

Thank you for your detailed feedback on submission de9fa1be-8a6c-4290-991d-56e8c26ea81b.

We have addressed all 6 issues identified in your review:

1. ✅ Account Deletion (Guideline 5.1.1v): Added "Delete Account" option in Settings → Account with full data deletion functionality. Users can now delete their account and all associated personal data.

2. ✅ Terms & Privacy Links (Guideline 3.1.2): Added functional links to Terms of Use and Privacy Policy on the Pricing page, visible before users tap "Start Free Trial."

3. ✅ Restore Purchases (Guideline 3.1.1): Added "Restore Purchases" button in Settings and on the Pricing page that users can tap to restore previous purchases.

4. ✅ Trade Plan Purchase (Guideline 2.1): [Fixed Trade plan purchase error / Removed Trade plan from UI pending approval / Added "Coming Soon" indicator]

5. ✅ Trade IAP Submission (Guideline 2.1): Submitted Trade Monthly subscription with App Review screenshot showing pricing page, and attached to version 1.0 in App Store Connect.

6. ✅ iPad Screenshots (Guideline 2.3.3): Uploaded new screenshots showing core app functionality (pricing, invoice recording, PDF generation, settings, dashboard) on 13-inch iPad Pro.

Testing Instructions:
- Account Deletion: Settings → Account → Delete Account → Confirm
- Restore Purchases: Settings → Restore Purchases OR Pricing page → "Restore Purchases" link
- Terms/Privacy: Pricing page → Links at bottom before purchase
- Pro Monthly Purchase: Pricing page → "Start Free Trial" on Pro plan
- Trade Plan: [Available for testing / Coming soon]

All changes have been tested on iPad Air 11-inch (M3) with iPadOS 26.2.

Thank you for your patience and thorough review process.

Best regards,
Connor Dahl
YapMate AI
```

---

## Next Steps After Approval

Once version 1.0 is approved:

1. **Monitor Crash Reports**
   - App Store Connect → Analytics → Crashes
   - Fix any critical issues immediately

2. **Gather User Feedback**
   - TestFlight external testers
   - App Store reviews
   - Direct support emails

3. **Plan Version 1.1**
   - Add Trade Monthly to offering (if not in 1.0)
   - Implement recommended improvements:
     - Proactive upgrade prompts when hitting limits
     - Real-time subscription status updates (customer info listener)
     - Improved offline handling
   - New features from user feedback

4. **Marketing Launch**
   - Public announcement
   - Social media
   - QR code flyers (/waitlist-flyer tracking)

---

**Last Updated:** January 12, 2026
**Maintained By:** Claude Code
**Next Review:** After resolving current rejection
