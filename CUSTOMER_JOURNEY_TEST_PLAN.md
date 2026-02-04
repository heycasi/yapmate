# YapMate Customer Journey Test Plan

**Purpose:** Comprehensive QA checklist for manual testing before App Store submission
**Last Updated:** February 4, 2026
**Recent Update:** Fixed anonymous purchase flow - /record now allows paid users without accounts

---

## 1. Customer Journey Map (as implemented)

### Journey A: App Store Discovery → iOS Purchase (No Account)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: App Store Discovery                                                │
│  User finds "YapMate AI" in App Store, downloads free app                  │
│  Location: Apple App Store                                                  │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 2: First Launch                                                       │
│  App loads, shows home/landing page                                         │
│  Code: app/page.tsx (or app/record/page.tsx if deep link)                  │
│  IAP Init: components/IAPProvider.tsx:23-45 (configureIAP called)          │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 3: Navigate to Pricing                                                │
│  User taps "Pricing" in header or CTA button                               │
│  Code: app/pricing/page.tsx                                                 │
│  - Offerings loaded: lines 65-111 (loadOfferings)                          │
│  - Console: "[Pricing] Loaded offerings: X"                                 │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 4: Tap "Start Free Trial" (Pro Plan)                                 │
│  Code: app/pricing/page.tsx:122-249 (handleUpgrade)                        │
│  Checks: isLoadingOfferings, offerings.length > 0                          │
│  Product ID: "com.yapmate.pro.monthly" (lib/iap.ts:69-72)                  │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 5: iOS Payment Sheet                                                  │
│  StoreKit 2 native sheet appears                                           │
│  User signs in with Apple ID (or sandbox account)                          │
│  Confirms 7-day free trial                                                  │
│  Code: lib/iap.ts:174-280 (purchase function)                              │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 6: Purchase Success (Not Logged In)                                  │
│  Code: app/pricing/page.tsx:242-246                                        │
│  Action: Redirect to /finish-setup?plan=pro                                │
│  Console: "[Pricing] Purchase successful, redirecting to /finish-setup..." │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 7: Finish Setup Page                                                  │
│  Code: app/finish-setup/page.tsx                                           │
│  Shows: "Trial Started" + 3 options:                                       │
│    - Create Account (→ /signup)                                            │
│    - Log In (→ /login)                                                     │
│    - Not Now - Start Using (→ /record)                                     │
│  RevenueCat check: lines 25-42 (verifies subscription active)              │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 8: Skip Account → Access Record Page                                 │
│  User taps "Not Now - Start Using"                                         │
│  Navigates to /record                                                       │
│  Code: app/record/page.tsx checkAuth() detects no session                  │
│  → Checks RevenueCat entitlement via getUserPlan()                         │
│  → Finds Pro entitlement active → allows page access                       │
│  Console: "[Record] no_session_entitlement_active=true, plan=pro"          │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 9: Tap Record Button → Account Prompt                                │
│  User sees record page UI, taps record button                              │
│  Code: app/record/page.tsx startRecording() detects isAnonymousPaidUser    │
│  Shows modal: "Quick Setup Required"                                        │
│  - Explains subscription will transfer                                      │
│  - "Create Account (30 sec)" button → /signup?return=/record               │
│  - "I Have an Account" button → /login?return=/record                      │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 10: Create Account → Subscription Linked                             │
│  User creates account on /signup                                            │
│  IAPProvider detects SIGNED_IN event                                        │
│  Code: components/IAPProvider.tsx onAuthStateChange                         │
│  → Calls linkUser() to merge RevenueCat anonymous → authenticated          │
│  → Syncs subscription to Supabase                                          │
│  User redirected back to /record, now with full access                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Journey B: iOS Purchase (Logged In User)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1-3: Same as Journey A                                               │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 4: User Logs In First                                                 │
│  Code: app/login/page.tsx                                                   │
│  Supabase auth: lib/supabase.ts                                            │
│  On success: session stored, IAPProvider links user                        │
│  Code: components/IAPProvider.tsx:60-85 (linkUserAfterAuth)                │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 5-6: Same purchase flow as Journey A                                 │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 7: Purchase Success (Logged In)                                      │
│  Code: app/pricing/page.tsx:224-241                                        │
│  Action: Sync to Supabase (NOT redirect to /finish-setup)                  │
│  Sync: lib/iap-sync.ts (syncSubscription)                                  │
│  Updates: subscriptions table + user_preferences.plan                      │
│  Console: "[Pricing] Syncing to Supabase..."                               │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 8: Stay on Pricing Page                                              │
│  Shows success message                                                      │
│  Plan updates in UI (checkUserPlan re-fetches)                             │
│  User can navigate to /record                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Journey C: Web Discovery (App Store Redirect)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Web Discovery                                                      │
│  User lands on https://yapmate.co.uk (marketing site)                      │
│  OR https://app.yapmate.co.uk (web app)                                    │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 2: Web Pricing Page                                                   │
│  Code: app/pricing/page.tsx                                                 │
│  isIAPAvailable() returns false (web)                                       │
│  Tap "Start Free Trial" → Shows App Store badge                            │
│  Code: lines 127-131 (isWeb() check)                                       │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 3: Redirect to App Store                                             │
│  User clicks App Store badge                                               │
│  Code: components/AppStoreBadge.tsx                                         │
│  Link: https://apps.apple.com/app/yapmate-ai/id[APP_ID]                    │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┘
│  STEP 4: Continue with Journey A                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Journey D: Invoice Creation (Core Product Path)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Navigate to Record                                                 │
│  Code: app/record/page.tsx                                                  │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 2: Feature Gate Check                                                 │
│  Code: lib/plan-access.ts:144-174 (canCreateInvoice)                       │
│  Free: max 3 invoices                                                       │
│  Pro/Trade: unlimited                                                       │
│  If blocked: Error shown with upgrade prompt                               │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 3: Voice Recording                                                    │
│  User taps record button, speaks job details                               │
│  Uses microphone permission (Info.plist)                                    │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 4: AI Processing                                                      │
│  OpenAI Whisper: speech → text                                             │
│  OpenAI GPT: text → structured invoice                                     │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 5: Invoice Preview                                                    │
│  Code: app/invoice/[id]/page.tsx (or preview component)                    │
│  Shows generated invoice                                                    │
│  VAT options: lib/plan-access.ts:180-184 (canUseVAT)                       │
│  CIS options: lib/plan-access.ts:192-201 (canUseCIS) - Trade only          │
└───────────────────────────────────────────────┬─────────────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────┐
│  STEP 6: Export/Share                                                       │
│  Generate PDF                                                               │
│  Share via iOS share sheet                                                  │
│  Save to cloud (if logged in)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Manual QA Checklist

### 2.1 iOS App - First Launch & Setup

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 1.1 | Fresh install from TestFlight | App opens without crash | [ ] |
| 1.2 | Check console for IAP init | `[IAP] RevenueCat configured successfully` | [ ] |
| 1.3 | Navigate to Pricing page | Offerings load within 3 seconds | [ ] |
| 1.4 | Check console for offerings | `[Pricing] Loaded offerings: X` (X > 0) | [ ] |
| 1.5 | Verify Pro plan card visible | Shows £15/month, 7-day trial | [ ] |
| 1.6 | Verify Trade plan (if enabled) | Shows £25/month OR "Coming Soon" | [ ] |

### 2.2 iOS App - Purchase Flow (Anonymous) - UPDATED

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 2.1 | Tap "Start Free Trial" on Pro | Loading state shown | [ ] |
| 2.2 | iOS payment sheet appears | Shows product, price, trial info | [ ] |
| 2.3 | Sign in with sandbox account | Sheet accepts credentials | [ ] |
| 2.4 | Confirm trial | Transaction completes | [ ] |
| 2.5 | Redirect to /finish-setup | Shows "Trial Started" page | [ ] |
| 2.6 | Tap "Not Now - Start Using" | Navigates to /record (NOT /login) | [ ] |
| 2.7 | Check console | `[Record] no_session_entitlement_active=true` | [ ] |
| 2.8 | Record page loads | UI shows, NOT redirected to login | [ ] |
| 2.9 | Tap record button | Shows "Quick Setup Required" modal | [ ] |
| 2.10 | Modal shows correct info | "Your Pro subscription is active!" + benefits | [ ] |
| 2.11 | Tap "Create Account" | Navigates to /signup?return=/record | [ ] |
| 2.12 | Complete signup | Account created, redirected to /record | [ ] |
| 2.13 | Check console | `[IAP] User linked successfully` | [ ] |
| 2.14 | Tap record button again | Recording actually starts | [ ] |

### 2.3 iOS App - Purchase Flow (Logged In)

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 3.1 | Create account or log in first | Session established | [ ] |
| 3.2 | Navigate to Pricing | Current plan shown (if any) | [ ] |
| 3.3 | Tap "Start Free Trial" | Purchase flow starts | [ ] |
| 3.4 | Complete purchase | Success message on pricing page | [ ] |
| 3.5 | Check NO redirect to /finish-setup | Stay on pricing page | [ ] |
| 3.6 | Console shows sync | `[Pricing] Syncing to Supabase...` | [ ] |
| 3.7 | Plan updates in UI | Button text changes to "Current Plan" | [ ] |

### 2.4 iOS App - Restore Purchases

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 4.1 | Delete and reinstall app | Fresh install state | [ ] |
| 4.2 | Navigate to Settings | Find "Restore Purchases" button | [ ] |
| 4.3 | Tap "Restore Purchases" | Loading indicator shown | [ ] |
| 4.4 | Restore completes | Success message OR "No purchases found" | [ ] |
| 4.5 | If had subscription: Features unlocked | Pro features accessible | [ ] |

### 2.5 iOS App - Account Management

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 5.1 | Navigate to Settings | Settings page loads | [ ] |
| 5.2 | Find "Delete Account" button | Button visible in Account section | [ ] |
| 5.3 | Tap "Delete Account" | Confirmation dialog appears | [ ] |
| 5.4 | Confirm deletion | Account deleted, logged out | [ ] |
| 5.5 | Try to log in with same email | "User not found" or sign up prompt | [ ] |

### 2.6 Web App - Purchase Redirect

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 6.1 | Open web app in browser | App loads correctly | [ ] |
| 6.2 | Navigate to Pricing | Pricing page loads | [ ] |
| 6.3 | Tap "Start Free Trial" | App Store badge/link shown | [ ] |
| 6.4 | Click App Store link | Opens App Store listing | [ ] |

### 2.7 Auth Flows (Supabase)

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 7.1 | Sign up with email | Confirmation email sent | [ ] |
| 7.2 | Confirm email | Account activated | [ ] |
| 7.3 | Log in with correct password | Session established | [ ] |
| 7.4 | Log in with wrong password | Error: "Invalid credentials" | [ ] |
| 7.5 | Forgot password flow | Reset email sent | [ ] |
| 7.6 | Reset password | New password works | [ ] |
| 7.7 | Log out | Session cleared | [ ] |

### 2.8 Feature Gating

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 8.1 | Free user: Create 3 invoices | All 3 succeed | [ ] |
| 8.2 | Free user: Try 4th invoice | Error: "Reached limit" | [ ] |
| 8.3 | Free user: Toggle VAT | Toggle hidden or disabled | [ ] |
| 8.4 | Pro user: Create unlimited | No limit error | [ ] |
| 8.5 | Pro user: Toggle VAT | VAT works | [ ] |
| 8.6 | Pro user: CIS option | Hidden (Trade only) | [ ] |
| 8.7 | Trade user: CIS option | CIS works (if Trade enabled) | [ ] |

### 2.9 iPad-Specific Tests (Apple Reviews on iPad)

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 9.1 | Launch on iPad | UI scales correctly | [ ] |
| 9.2 | Pricing page on iPad | All plans visible, no overlap | [ ] |
| 9.3 | Purchase flow on iPad | Payment sheet appears correctly | [ ] |
| 9.4 | Recording on iPad | Microphone works | [ ] |
| 9.5 | Invoice preview on iPad | PDF renders correctly | [ ] |

### 2.10 Anonymous Purchase → Record Access (Critical Path)

| # | Test Case | Expected Result | Pass/Fail |
|---|-----------|-----------------|-----------|
| 10.1 | Free user (no account) tries /record | Redirected to /login | [ ] |
| 10.2 | Check console for free user | `[Record] redirecting_to_login_reason=free_no_session` | [ ] |
| 10.3 | Anonymous Pro user accesses /record | Page loads, NOT redirected | [ ] |
| 10.4 | Check console for Pro user | `[Record] no_session_entitlement_active=true` | [ ] |
| 10.5 | Anonymous Pro user taps record | "Quick Setup Required" modal shown | [ ] |
| 10.6 | Modal has correct buttons | "Create Account" + "I Have an Account" + Cancel | [ ] |
| 10.7 | Tap Cancel | Modal closes, back to record page | [ ] |
| 10.8 | Create account and return | Recording works after account creation | [ ] |

---

## 3. Top 10 Likely Blockers for Zero Trials

Based on the codebase analysis, these are the most likely reasons trials aren't converting:

### 1. RevenueCat API Key Missing/Invalid
**Symptom:** `[IAP] Configuration failed` or no offerings loaded
**Check:** `.env.local` → `NEXT_PUBLIC_REVENUECAT_IOS_KEY`
**File:** `lib/iap.ts:106-132`

### 2. Offerings Not Loaded (Race Condition)
**Symptom:** "Loading subscription options, please wait..."
**Check:** Console for `[Pricing] Loaded offerings: 0`
**File:** `app/pricing/page.tsx:154-172`

### 3. DEV_MODE=true in Production
**Symptom:** App tries to connect to localhost, fails
**Check:** `capacitor.config.ts` → `DEV_MODE` must be `false`
**File:** `capacitor.config.ts`

### 4. Product Not in RevenueCat Offering
**Symptom:** "Product not found: com.yapmate.pro.monthly"
**Check:** RevenueCat dashboard → Offerings → default → Packages
**File:** `lib/iap.ts:69-72` (product IDs)

### 5. Sandbox Account Not Valid
**Symptom:** "Cannot connect to iTunes Store"
**Check:** App Store Connect → Sandbox Testers
**Fix:** Create new sandbox tester account

### 6. iOS Payment Sheet Doesn't Appear
**Symptom:** Button spins forever, no native UI
**Check:** Xcode console for StoreKit errors
**File:** `lib/iap.ts:189-280`

### 7. Purchase Succeeds But No Redirect
**Symptom:** Console shows success, user stuck on pricing
**Check:** `isLoggedIn` state and redirect logic
**File:** `app/pricing/page.tsx:242-246`

### 8. /finish-setup Shows Wrong Plan
**Symptom:** Page says "free" when should be "pro"
**Check:** RevenueCat entitlements active
**File:** `app/finish-setup/page.tsx:25-42`

### 9. Network Timeout on Offerings Fetch
**Symptom:** Offerings never load, infinite loading
**Check:** Device internet connection, RevenueCat status
**File:** `lib/iap.ts:137-166`

### 10. App Review Mode Override Missing
**Symptom:** Trade plan errors in App Review
**Check:** `NEXT_PUBLIC_APP_REVIEW_MODE` env var
**File:** `app/pricing/page.tsx:29`

---

## 4. Quick Sanity Commands

### Check RevenueCat Configuration
```bash
# Verify API key is set
grep -r "REVENUECAT" .env*

# Expected output:
# NEXT_PUBLIC_REVENUECAT_IOS_KEY=appl_...
```

### Check DEV_MODE Setting
```bash
# Must be false for production
grep "DEV_MODE" capacitor.config.ts

# Expected output:
# const DEV_MODE = false
```

### Check Product IDs Match
```bash
# View configured product IDs
grep -A5 "IAP_PRODUCTS" lib/iap.ts

# Should show:
# PRO_MONTHLY: 'com.yapmate.pro.monthly',
# TRADE_MONTHLY: 'com.yapmate.trade.monthly',
```

### Build for Testing
```bash
# Full production build
npm run lint && npm run build && npx cap sync ios

# Then open Xcode
open ios/App/App.xcworkspace
```

### View Console Logs (Connected Device)
```bash
# In Xcode:
# 1. Connect device via USB
# 2. Select device from dropdown
# 3. Product → Run (Cmd+R)
# 4. View logs in bottom panel

# Filter for IAP/Pricing logs:
# Search: "[IAP]" or "[Pricing]"
```

### Check Supabase Subscription Sync
```bash
# Query subscriptions table (requires Supabase CLI)
npx supabase db query "SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 5"
```

### Verify RevenueCat Dashboard
```
1. Go to: https://app.revenuecat.com
2. Navigate to: Apps → YapMate AI
3. Check: Offerings → default → Packages
4. Verify: Pro Monthly is listed
5. Check: Entitlements → "pro" exists
```

---

## 5. Console Log Patterns to Watch

### Healthy Purchase Flow
```
[IAP] Platform detected: ios
[IAP] API key present: true
[IAP] RevenueCat configured successfully
[Pricing] Loaded offerings: 1
[Pricing] Available packages:
  - pro: com.yapmate.pro.monthly (£15.00/month)
[Pricing] Starting purchase flow (logged in: false)
[IAP] ===== STARTING PURCHASE =====
[IAP] Product ID: com.yapmate.pro.monthly
[IAP] ✓ FOUND! Product found in offering: default
[IAP] Initiating purchase with StoreKit...
[IAP] ===== PURCHASE SUCCESSFUL =====
[Pricing] Purchase successful, redirecting to /finish-setup...
[FinishSetup] Subscription verified: pro
```

### Failed - No Offerings
```
[IAP] RevenueCat configured successfully
[Pricing] Loaded offerings: 0
[Pricing] ⚠️ No offerings available from RevenueCat
```

### Failed - Product Not Found
```
[IAP] ===== STARTING PURCHASE =====
[IAP] Product ID: com.yapmate.pro.monthly
[IAP] ❌ PRODUCT NOT FOUND
[IAP] Searched for: com.yapmate.pro.monthly
[IAP] Available products: (none)
```

### Failed - User Cancelled
```
[IAP] ===== STARTING PURCHASE =====
[IAP] Purchase cancelled by user
[Pricing] Purchase cancelled by user
```

---

## 6. Pre-Submission Final Checklist

Before uploading to TestFlight/App Store:

- [ ] `DEV_MODE = false` in `capacitor.config.ts`
- [ ] `.env.local` has production keys
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` completes successfully
- [ ] `npx cap sync ios` completes
- [ ] Test purchase on real device with sandbox account
- [ ] Verify /finish-setup page works
- [ ] Verify "Restore Purchases" works
- [ ] Verify "Delete Account" works
- [ ] Test on iPad (Apple reviews on iPad)
- [ ] Build number incremented in Xcode
- [ ] Version matches App Store Connect

---

**Document maintained by:** Claude Code
**Review before each App Store submission**
