# YapMate TestFlight Build & Upload Checklist

This guide walks you through building and uploading YapMate to TestFlight for beta testing.

## Prerequisites

- [ ] Apple Developer Program membership ($99/year) - active and paid
- [ ] Xcode 15+ installed
- [ ] App Store Connect app created with Bundle ID: `com.yapmate.app`
- [ ] All code committed to git
- [ ] `.env.local` configured with production API keys

---

## Part 1: Configure for Production Build

### 1.1 Set Production Mode in Capacitor

**File:** `capacitor.config.ts`

```typescript
const DEV_MODE = false  // ✓ Must be false for TestFlight
```

This ensures the iOS app loads from bundled files, not your local dev server.

### 1.2 Verify Environment Variables

**Check `.env.local` has production keys:**

```bash
# Required for app to function
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key
```

⚠️ **Warning:** Never commit `.env.local` to git. Only `.env.local.example` should be tracked.

---

## Part 2: Build the Web Assets

### 2.1 Run Production Build

```bash
npm run lint
npm run build
```

**Expected output:**
- ✔ No ESLint warnings or errors
- ✔ All pages compiled successfully
- Static export created in `out/` directory

### 2.2 Sync to iOS

```bash
npx cap sync ios
```

**This copies your built web assets to the iOS app bundle.**

Expected output:
```
✔ Copying web assets from out to ios/App/App/public
✔ Sync finished in X.XXs
```

---

## Part 3: Update Version Numbers

### 3.1 Decide Version Strategy

For your **first TestFlight build:**
- Marketing Version: `1.0`
- Build Number: `1`

For **subsequent builds:**
- **Same features, bug fixes only:** Increment Build Number (e.g., 1 → 2)
- **New features, public release:** Increment Marketing Version (e.g., 1.0 → 1.1)

### 3.2 Update in Xcode

1. Open Xcode:
   ```bash
   npm run ios
   # Or: open ios/App/App.xcworkspace
   ```

2. Select **App** target in left sidebar

3. Go to **General** tab → **Identity** section

4. Update:
   - **Version:** `1.0` (Marketing Version - user-facing)
   - **Build:** `1` (Build Number - must increment for each upload)

**⚠️ Important:** TestFlight requires **unique build numbers**. You cannot upload build `1` twice, even if you change the version.

### 3.3 Keep package.json in Sync (Optional)

Update `package.json` version to match:

```json
{
  "version": "1.0.0"
}
```

This helps with internal tracking but doesn't affect TestFlight.

---

## Part 4: Archive the App

### 4.1 Select Device Target

In Xcode toolbar (top left):

**Select:** `Any iOS Device (arm64)`

**NOT:** A simulator or specific device.

### 4.2 Create Archive

1. Menu: **Product → Archive**

2. Wait for build to complete (1-3 minutes)

3. **Xcode Organizer** window opens automatically

**Troubleshooting:**
- **"Signing requires a development team"** → Add your Apple ID in Xcode Preferences → Accounts
- **"Provisioning profile errors"** → Select "Automatically manage signing" in General tab

---

## Part 5: Upload to App Store Connect

### 5.1 Distribute Archive

In **Xcode Organizer:**

1. Select your archive
2. Click **"Distribute App"**
3. Select **"App Store Connect"** → Next
4. Select **"Upload"** → Next
5. Choose **automatic signing** → Next
6. Review summary → **Upload**

**Upload takes 2-5 minutes.**

### 5.2 Wait for Processing

1. Upload completes in Xcode ✓

2. Go to [App Store Connect](https://appstoreconnect.apple.com)

3. **My Apps → YapMate → TestFlight**

4. Wait 10-30 minutes for build to process

**Status changes:**
- Processing → Ready to Submit → Missing Compliance

### 5.3 Export Compliance

When the build shows **"Missing Compliance":**

1. Click on the build
2. **Provide Export Compliance Information**
3. Answer questions:
   - **Does your app use encryption?** → **No** (HTTPS doesn't count)
   - (Or follow the wizard if you use custom encryption)

---

## Part 6: Add TestFlight Testers

### 6.1 Internal Testing (Fastest)

**No App Review Required - Instant**

1. TestFlight → Internal Testing → Create Group
2. Add up to 100 testers (must have App Store Connect access)
3. Testers receive email invite immediately

### 6.2 External Testing (For Real Users)

**Requires Apple Review (~24-48 hours)**

1. TestFlight → External Testing → Create Group
2. Add testers by email (unlimited)
3. Fill in "What to Test" notes
4. Submit for review
5. Wait for approval
6. Testers receive invite

---

## Part 7: Testing Checklist

Have testers verify:

- [ ] Voice recording works (microphone permission prompts)
- [ ] Invoice creation via voice
- [ ] PDF generation and sharing
- [ ] Bank details appear on invoices
- [ ] VAT calculations correct
- [ ] CIS calculations correct (if applicable)
- [ ] Settings save and persist
- [ ] Logout works

---

## Quick Command Reference

```bash
# Development mode (live reload from Mac)
# Edit capacitor.config.ts: DEV_MODE = true
npm run dev                    # Start dev server
npx cap sync ios              # Sync changes
npm run ios                   # Open Xcode

# Production mode (bundled files for TestFlight)
# Edit capacitor.config.ts: DEV_MODE = false
npm run lint                  # Check for errors
npm run build                 # Build static export
npx cap sync ios              # Copy to iOS
npm run ios                   # Open Xcode
# Then: Product → Archive → Distribute
```

---

## Troubleshooting

### Build Fails with TypeScript Errors

```bash
npm run lint
npm run build
```

Fix all errors before proceeding.

### "No accounts with App Store Connect access"

Add your Apple ID:
1. Xcode → Preferences → Accounts
2. Click **+** → Add Apple ID
3. Sign in

### Upload Succeeds but Build Never Appears

- Wait 30-60 minutes
- Check email for errors from Apple
- Verify bundle ID matches App Store Connect: `com.yapmate.app`

### "This build number has already been uploaded"

Increment the **Build Number** in Xcode (General → Identity → Build).

You cannot reuse build numbers, even if you delete the old build.

---

## Current Configuration

**Bundle ID:** `com.yapmate.app`

**Current Version:** `1.0` (Marketing Version)

**Current Build:** `1` (Build Number)

**Permissions Required:**
- Microphone (for voice recording)

**Capacitor Plugins:**
- @capacitor/filesystem (for PDF caching)
- @capacitor/share (for PDF sharing)

---

## Before Each Upload

- [ ] DEV_MODE = false in capacitor.config.ts
- [ ] npm run lint passes
- [ ] npm run build succeeds
- [ ] npx cap sync ios completes
- [ ] Version/Build numbers incremented
- [ ] Git commit with version tag

---

## Post-Upload

After TestFlight approval:

1. Invite testers
2. Send test instructions
3. Monitor crash reports in App Store Connect
4. Collect feedback
5. Iterate!

---

**Questions?**

- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [TestFlight Beta Testing Guide](https://developer.apple.com/testflight/)
