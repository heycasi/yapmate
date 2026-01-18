# Sandbox Testing Guide - IAP Purchase Flow

## How to Test the Purchase Flow Again

### Step 1: Cancel Your Current Subscription

**On your test device (iPhone/iPad):**

1. Open **Settings** app
2. Tap your **Apple ID** at the top
3. Tap **Subscriptions**
4. Find **YapMate AI - Pro Monthly**
5. Tap **Cancel Free Trial** (or **Cancel Subscription**)
6. Confirm cancellation

**Note:** You'll still have access until Jan 10, but you can re-purchase immediately.

---

### Step 2: Sign Out of YapMate App

**Option A: If your app has a sign-out button:**
1. Open YapMate
2. Go to Settings/Profile
3. Tap "Sign Out" or "Logout"

**Option B: If no sign-out button (recommended):**
1. Delete the YapMate app completely
2. Reinstall from TestFlight
3. This gives you a completely fresh state

---

### Step 3: Test the Purchase Flow

**Scenario 1: Anonymous Purchase (What Apple Tests)**

This is THE critical test - what Apple reviewers check:

1. Open YapMate (fresh install, not logged in)
2. You should be able to browse/use basic features
3. Go to **Pricing** page
4. Tap **"Start Free Trial"** on Pro plan
5. **DO NOT log into YapMate** - just proceed
6. Apple StoreKit purchase sheet appears
7. Sign in with sandbox tester account (in the Apple prompt)
8. Confirm 7-day free trial
9. Purchase completes ✅
10. **App redirects to `/finish-setup?plan=pro`**
11. `/finish-setup` page should:
    - Show "Purchase Successful" or similar message
    - Prompt to create a YapMate account (optional)
    - Allow user to continue using the app

**Expected Result:**
- ✅ User has active Pro subscription
- ✅ User was NOT forced to create YapMate account before purchasing
- ✅ User can choose to create account after (or skip)

---

**Scenario 2: Logged-In Purchase**

1. Open YapMate
2. Create account / Log in first
3. Go to Pricing page
4. Tap "Start Free Trial" on Pro plan
5. Purchase completes
6. Should stay on pricing page or go to dashboard
7. NO redirect to `/finish-setup` (already logged in)

---

## What `/finish-setup` Should Do

After successful anonymous purchase, the `/finish-setup` page should:

**✅ Good Implementations:**
- Welcome message: "Your Pro subscription is active!"
- Optional account creation form
- Button: "Create Account" (to save invoices, sync across devices)
- Button: "Skip for Now" or "Continue" (let them use app without account)
- Clear messaging: "Your subscription works without an account, but creating one lets you..."

**❌ Bad Implementations:**
- Forcing account creation (blocking access)
- No way to skip
- Unclear that subscription is already active

**Check:** Does your `/finish-setup` page let users skip account creation?

---

## Testing Checklist

### Anonymous Purchase Test (Apple's Test)
- [ ] App opens without forcing login
- [ ] Can navigate to Pricing page without login
- [ ] Can tap "Start Free Trial" without login
- [ ] Purchase sheet appears (Apple StoreKit)
- [ ] Can complete purchase with sandbox account
- [ ] Purchase succeeds
- [ ] Redirects to `/finish-setup`
- [ ] `/finish-setup` doesn't force account creation
- [ ] User can access Pro features without creating account

### Logged-In Purchase Test
- [ ] Log into YapMate first
- [ ] Go to Pricing page
- [ ] Tap "Start Free Trial"
- [ ] Purchase completes
- [ ] Subscription syncs to Supabase
- [ ] User can access Pro features

### Error Handling Test
- [ ] Cancel purchase → Shows cancellation message (not error)
- [ ] No internet → Shows helpful error
- [ ] Product not available → Shows helpful error

---

## Sandbox Testing Tips

### 1. Cancel Previous Subscriptions
Before re-testing, cancel any active trials:
- Settings → Apple ID → Subscriptions → Cancel

### 2. Use Fresh App State
Best way to simulate new user:
```bash
# Delete app from device
# Reinstall from TestFlight
# Opens fresh without any login state
```

### 3. Check Subscription Status
After purchase:
- Settings → Apple ID → Subscriptions
- Should show "YapMate AI - Pro Monthly" active
- Should show "You've subscribed through a free offer"

### 4. Sandbox Account Management
If you need multiple tests:
- Can cancel and re-subscribe multiple times
- Sandbox trials reset when you cancel
- Can create multiple sandbox tester accounts

---

## Common Issues

### Issue: "Cannot connect to iTunes Store"
**Fix:**
- Check internet connection
- Sign out and back into sandbox account
- Try again

### Issue: "Product not available"
**Fix:**
- Wait a few minutes (offerings might be syncing)
- Kill and reopen app
- Check RevenueCat dashboard

### Issue: Stuck on loading
**Fix:**
- Check console logs (if testing in Xcode)
- Verify Build 15 has latest code
- Check network connectivity

---

## What to Screenshot for Apple

If Apple asks for testing proof, screenshot:

1. **Pricing page** (before login) - shows you can browse
2. **Purchase sheet** - shows StoreKit popup
3. **Subscription active** - Settings → Subscriptions showing trial
4. **App working** - Shows Pro features accessible

---

## Debug Logs to Check

If testing in Xcode, watch for these logs:

**Good logs (success):**
```
[IAP] ===== STARTING PURCHASE =====
[IAP] Product ID: com.yapmate.pro.monthly
[IAP] ✓ FOUND! Product found in offering: default
[IAP] Initiating purchase with StoreKit...
[IAP] ===== PURCHASE SUCCESSFUL =====
[Pricing] Purchase successful, redirecting to /finish-setup...
```

**Bad logs (failure):**
```
[IAP] ❌ PRODUCT NOT FOUND
[Pricing] Purchase failed: [error message]
```

---

## Testing on Multiple Devices

**iPhone:**
- Test in portrait mode
- Verify button sizes are tap-friendly

**iPad:**
- Test in both orientations
- Verify layout looks good (this is what Apple tested on)

---

## After Testing Successfully

Once you confirm:
- ✅ Anonymous purchase works
- ✅ Redirects to `/finish-setup`
- ✅ User can skip account creation
- ✅ Pro features are accessible

**Then you're ready to submit Build 15 to Apple!**

The purchase flow is compliant with Guideline 5.1.1 because:
1. User CAN purchase without YapMate account ✅
2. Subscription is active before account creation ✅
3. Account creation is optional, not forced ✅

This is exactly what Apple wants to see.
