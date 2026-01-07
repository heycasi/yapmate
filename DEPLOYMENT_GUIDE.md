# YapMate iOS Deployment Guide
## App Review Guideline 5.1.1 Compliance Build

**Build Date:** January 7, 2026
**Changes:** Allow in-app purchases without account creation

---

## 1. TERMINAL COMMANDS (Run in order)

### Step 1: Sync Capacitor (Update iOS app with latest web build)
```bash
cd /Users/conzo/dev/yapmate

# Build Next.js static export
npm run build

# Copy to iOS app
npx cap sync ios
```

### Step 2: Open Xcode Project
```bash
npx cap open ios
```

### Step 3: Increment Build Number in Xcode
1. In Xcode, select **App** target in left sidebar
2. Go to **General** tab
3. Under **Identity**, find **Build** field
4. Increment from current value (e.g., 10 → 11)
5. Keep **Version** as is (e.g., 1.0)

### Step 4: Clean Build Folder
In Xcode menu:
- **Product** → **Clean Build Folder** (or press `Shift+Cmd+K`)

### Step 5: Archive the App
In Xcode menu:
- **Product** → **Archive**
- Wait for archive to complete (2-5 minutes)

---

## 2. XCODE MANUAL STEPS

### After Archive Completes:

**Organizer Window Opens Automatically**

1. Select the latest archive (should be at the top)
2. Click **Distribute App** button (right side)
3. Choose **App Store Connect**
4. Click **Next**
5. Choose **Upload**
6. Click **Next**
7. Ensure these options are selected:
   - ✅ Upload symbols for Apple
   - ✅ Manage Version and Build Number
8. Click **Next**
9. **Automatically manage signing** should be selected
10. Click **Next**
11. Review the summary
12. Click **Upload**
13. Wait for upload to complete (5-10 minutes)

---

## 3. APP STORE CONNECT STEPS

### After Upload Completes:

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps**
3. Select **YapMate AI**
4. Click the **+** button next to **iOS App** (left sidebar)
5. Select **1.0** (or current version)
6. Wait 5-15 minutes for build to process (check email for notification)

### When Build Appears:

7. Click **Build** section (under App Store tab)
8. Click **+** next to Build
9. Select the new build (e.g., 1.0 (11))
10. Click **Done**

### Update Version Information:

11. Scroll to **What's New in This Version**
12. Enter release notes:
```
- You can now start a free trial without creating an account
- Create your account anytime to save invoices to the cloud
- Improved subscription management
- Bug fixes and performance improvements
```

13. Scroll to **App Review Information**
14. Ensure **Notes** section includes the IAP location info (see Section 4 below)

### Submit for Review:

15. Click **Save** (top right)
16. Click **Submit for Review**
17. Answer the Export Compliance questions:
    - Does your app use encryption? **NO** (we use HTTPS which is exempt)
18. Click **Submit**

---

## 4. APP REVIEW NOTES (Copy this to "Notes" field)

```
=== IN-APP PURCHASE LOCATION ===

This app contains auto-renewable subscriptions (Pro and Trade plans).

IMPORTANT: You can now purchase subscriptions WITHOUT creating an account first.

How to locate the in-app purchases:

1. Launch YapMate AI
2. On the home screen, tap "Pricing" at the bottom navigation
3. You will see three plans:
   - Free (£0)
   - Pro (£15/month) - marked "Recommended"
   - Trade (£25/month)

4. To start a 7-day free trial:
   - Tap "Start Free Trial" on Pro or Trade
   - Confirm with Face ID/Touch ID
   - Trial begins immediately (no account required)

5. After purchase, you'll be prompted to create an account to save invoices to the cloud. This is optional - you can use "Not Now" and create an account later.

6. All purchases are managed through Settings → [Your Apple ID] → Subscriptions

=== TEST CREDENTIALS (If Needed) ===

Test account: reviewer@yapmate.co.uk
Password: [Provided in separate field]

Note: You do NOT need to log in to test purchases. Anonymous purchases work as intended per Guideline 5.1.1.

=== ADDITIONAL INFO ===

- Subscriptions use RevenueCat for receipt validation
- All billing is handled by Apple In-App Purchase
- Users can restore purchases without logging in
- Invoices created while logged out are stored locally until user creates account
```

---

## 5. VERIFICATION CHECKLIST

Before submitting, verify in TestFlight or Simulator:

- [ ] Can tap "Start Free Trial" on pricing page WITHOUT logging in
- [ ] After purchase (not logged in), redirected to /finish-setup page
- [ ] /finish-setup page shows "Create Account", "Log In", "Not Now" buttons
- [ ] "Not Now" allows using premium features without account
- [ ] Can create account later and purchases are preserved
- [ ] Can restore purchases without logging in (Settings → Restore Purchases)
- [ ] Console logs show "[IAP] Configuring RevenueCat..." on app start
- [ ] Console logs show purchase flow and linking when user logs in

---

## 6. ROLLBACK PLAN (If Needed)

If App Review still rejects:

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Rebuild and resubmit
npm run build
npx cap sync ios
# Follow steps 2-3 above
```

---

## 7. COMMON ISSUES & SOLUTIONS

### Issue: Build fails with "Provisioning profile doesn't match"
**Solution:** In Xcode → Signing & Capabilities → Change "Automatically manage signing" to OFF then back to ON

### Issue: Archive button is greyed out
**Solution:** Ensure "Any iOS Device (arm64)" is selected in the device dropdown (not a simulator)

### Issue: Upload gets stuck at "Authenticating with App Store Connect"
**Solution:** Check your Apple ID is signed in: Xcode → Settings → Accounts

### Issue: Build doesn't appear in App Store Connect
**Solution:** Wait 15 minutes, then check email for processing notification. If still missing, re-upload.

---

## 8. CONTACT

If you encounter issues during deployment:
- Check Xcode console for errors
- Review logs in Console.app (filter: "YapMate" or "IAP")
- Contact: connordahl@hotmail.com

---

**Document Version:** 1.0
**Last Updated:** January 7, 2026
