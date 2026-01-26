# iOS App Wrapper Sync Status

**Date:** 2026-01-14  
**Question:** Has iOS app been updated with recent code changes?

---

## Current Status

### Recent Changes (Web/React Code):
- ✅ Per-field voice re-record feature (`VoiceInputButton`, `use-voice-input.ts`)
- ✅ Invoice branding UI (`app/settings/page.tsx`, logo upload)
- ✅ Discoverability polish (mic button sizes, helper text)

**All code committed to:** `feat/rerecord-branding-copy-logo` branch

---

## How iOS App Gets Updates

**Two Modes:**

### 1. Development Mode (`DEV_MODE = true`)
- iOS app loads from **localhost:3000** (your dev server)
- Changes appear **instantly** (live reload)
- **No sync needed** - just refresh in iOS app
- **Current state:** `DEV_MODE = false` in `capacitor.config.ts`

### 2. Production Mode (`DEV_MODE = false`) ⚠️ CURRENT
- iOS app loads from **bundled files** in `ios/App/App/public/`
- Changes require: **build Next.js** + **sync to iOS**
- **Current state:** Bundle is OUTDATED (only has old file)

---

## Current Status Check

**Check 1: Is Next.js built?**
- Need `out/` directory with built files
- Status: ❓ (checking...)

**Check 2: Is iOS bundle synced?**
- Need `ios/App/App/public/` with latest files
- Status: ❌ **OUTDATED** (only has old `1stinstapost.jpg`)

---

## Answer: iOS App NOT Updated Yet

**Reason:** With `DEV_MODE = false`, iOS uses bundled files, and bundle is old.

**To Update iOS App:**

### Option A: Switch to Dev Mode (For Testing)
```bash
# 1. Edit capacitor.config.ts
# Change: DEV_MODE = true

# 2. Make sure dev server is running
npm run dev

# 3. Sync Capacitor config
npx cap sync ios

# 4. Run iOS app
npm run ios
# iOS app will load from localhost:3000 (your dev server)
```

### Option B: Build & Sync (For Production/TestFlight)
```bash
# 1. Build Next.js
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open Xcode
npm run ios
# iOS app will use bundled files from ios/App/App/public/
```

---

## Recommendation

**For Development/Testing:**
- Switch `DEV_MODE = true` in `capacitor.config.ts`
- Run `npm run dev`
- Run `npx cap sync ios`
- Changes appear instantly in iOS app (live reload)

**For Production/TestFlight:**
- Keep `DEV_MODE = false`
- Run `npm run build` + `npx cap sync ios`
- Bundle latest code into iOS app

---

## What Needs Sync

**Files that need to be in iOS bundle:**
- New components: `VoiceInputButton.tsx`
- New hooks: `use-voice-input.ts`
- Modified pages: `app/invoice/page.tsx`, `app/settings/page.tsx`
- Logo upload: `lib/logo-upload.ts`

**All are in your Next.js code, just need to build + sync!**

---

## Quick Check Command

```bash
# Check if out/ exists (built Next.js)
ls -la out/

# Check iOS public directory (should have built files)
ls -la ios/App/App/public/
```

**If `out/` is empty or missing → Need `npm run build`**  
**If `ios/App/App/public/` only has old files → Need `npx cap sync ios`**
