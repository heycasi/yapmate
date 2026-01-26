# Status: feat/rerecord-branding-copy-logo Branch

**Date:** 2026-01-14  
**Branch:** `feat/rerecord-branding-copy-logo`  
**Working Tree:** Clean (all changes committed)

---

## ✅ Completed Features

### Feature 1: Per-Field Re-Record in Invoice Review Screen
**Commit:** `01607e6`

- ✅ `lib/use-voice-input.ts` - Custom hook for field-level voice recording
- ✅ `components/VoiceInputButton.tsx` - Mic button component with recording/transcribing states
- ✅ `app/invoice/page.tsx` - Added voice input to:
  - Customer name field
  - Job Summary field
  - Notes field
  - Material description fields (per row)
- ✅ Global recording lock prevents concurrent recordings
- ✅ Error handling preserves old values on failure
- ✅ Discoverability polish (size="md" buttons, helper text)

**Files:**
- `lib/use-voice-input.ts` (291 lines)
- `components/VoiceInputButton.tsx` (216 lines)
- `app/invoice/page.tsx` (modified)

---

### Feature 2: Invoice Branding (Logo + Company Name)
**Commit:** `a0ed50e`

**Backend:**
- ✅ `supabase/migrations/011_add_invoice_branding.sql` - Migration adds:
  - `invoice_logo_url TEXT` column to `user_preferences`
  - `invoice_company_name TEXT` column to `user_preferences`

**Logo Upload:**
- ✅ `lib/logo-upload.ts` - Logo upload/delete/validation functions
  - Validates file type (PNG, JPG, WebP)
  - Validates file size (max 2MB)
  - Auto-resizes images (max 1024x1024px)
  - Uploads to Supabase Storage: `invoice-logos/{userId}/logo-{timestamp}.{ext}`
  - Deletes old logos before uploading new one

**Settings UI:**
- ✅ `app/settings/page.tsx` - Added "Invoice Branding" section:
  - Logo upload button with file picker
  - Company name input field
  - Preview of current logo
  - Delete logo button

**PDF Generation:**
- ✅ `components/InvoicePDF.tsx` - Accepts `branding` prop:
  - Shows user's logo if provided
  - Shows user's company name if provided
  - Falls back to YapMate logo if no user branding
- ✅ `app/invoice/page.tsx` - Fetches branding from `user_preferences` and passes to PDF

**Files:**
- `supabase/migrations/011_add_invoice_branding.sql` (35 lines)
- `lib/logo-upload.ts` (215 lines)
- `app/settings/page.tsx` (modified - added Invoice Branding section)
- `components/InvoicePDF.tsx` (modified - accepts branding prop)
- `app/invoice/page.tsx` (modified - fetches branding for PDF)

---

### Feature 3: British English Copy Sweep
**Commit:** `8125f35`

- ✅ Updated App Store links from `/us/` to `/gb/` in 3 files
- ✅ Verified codebase already uses British English (labour, tradies, etc.)

---

## ⚠️ Still Required (Before Merge)

### 1. Run SQL Migration in Supabase

**Migration File:** `supabase/migrations/011_add_invoice_branding.sql`

**SQL to Run:**
```sql
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;
```

**How to Run:**
- Option A: Supabase Dashboard → SQL Editor → Paste SQL → Run
- Option B: Supabase CLI → `supabase migration up`
- Option C: Manual SQL execution in Supabase

**Verify:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');
```

---

### 2. Create Supabase Storage Bucket

**Bucket Name:** `invoice-logos`  
**Public:** `true` (required for PDF generation to access logo URLs)

**Steps:**
1. Supabase Dashboard → Storage → New Bucket
2. Name: `invoice-logos`
3. Public: **Yes** (check this)
4. Create bucket

**RLS Policies (Storage):**

**SELECT Policy (Read):**
- Policy name: `Authenticated users can read all logos`
- Operation: `SELECT`
- Target roles: `authenticated`
- Policy: `true` (all authenticated users can read)

**INSERT Policy (Upload):**
- Policy name: `Users can upload to their own folder`
- Operation: `INSERT`
- Target roles: `authenticated`
- Policy: `bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text`

**UPDATE Policy (Update):**
- Policy name: `Users can update their own files`
- Operation: `UPDATE`
- Target roles: `authenticated`
- Policy: `bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text`

**DELETE Policy (Delete):**
- Policy name: `Users can delete their own files`
- Operation: `DELETE`
- Target roles: `authenticated`
- Policy: `bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text`

**Verify Bucket:**
- Check that bucket exists in Storage → `invoice-logos`
- Check that bucket is public (Public toggle should be ON)
- Try uploading a test file via Settings page

---

### 3. Test on Device (iOS/Web)

**Test Cases:**

**A. Per-Field Re-Record:**
1. Navigate to `/invoice?id={invoiceId}` (any existing invoice)
2. Click mic button on Customer field
3. Record: "John Smith"
4. Stop → Verify field updates with transcribed text
5. Repeat for Job Summary, Notes, and Material Description fields
6. Verify global lock (try starting recording on one field while another is active)

**B. Logo Upload:**
1. Navigate to `/settings`
2. Scroll to "Invoice Branding" section
3. Click "Upload Logo" → Select PNG/JPG file (< 2MB)
4. Verify logo uploads and preview appears
5. Verify `invoice_logo_url` is saved in `user_preferences` table

**C. Company Name:**
1. In Settings → Invoice Branding section
2. Enter company name: "ABC Plumbing Ltd"
3. Save settings
4. Verify `invoice_company_name` is saved in `user_preferences` table

**D. PDF Generation with Branding:**
1. Create or open an invoice
2. Click "Download PDF"
3. Verify PDF shows:
   - User's logo (if uploaded) OR YapMate logo (if not)
   - User's company name (if provided)
   - Fallback behavior works correctly

**Test Commands:**

**Web (DEV):**
```bash
npm run dev
# Navigate to http://localhost:3000/invoice?id={invoiceId}
# Navigate to http://localhost:3000/settings
```

**iOS (Capacitor - DEV):**
```bash
# Ensure capacitor.config.ts has DEV_MODE = true
npm run build
npx cap sync ios
npm run ios
# In Xcode: Product → Run (Cmd+R)
```

---

### 4. Merge to Main

**Before Merging:**
- [ ] SQL migration run successfully
- [ ] Storage bucket created with RLS policies
- [ ] All test cases pass (voice re-record, logo upload, PDF branding)
- [ ] No console errors in browser/device logs

**Merge Steps:**
```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge feature branch
git merge feat/rerecord-branding-copy-logo

# Push to remote
git push origin main
```

**After Merging:**
- Deploy to production (if auto-deploy is set up)
- Run migration on production Supabase instance
- Create storage bucket on production Supabase instance
- Test on production

---

## 📋 Quick Checklist

**Database:**
- [ ] Run migration `011_add_invoice_branding.sql` in Supabase
- [ ] Verify columns added: `invoice_logo_url`, `invoice_company_name`

**Storage:**
- [ ] Create bucket `invoice-logos` (public: true)
- [ ] Add RLS policies: SELECT, INSERT, UPDATE, DELETE

**Testing:**
- [ ] Voice re-record works on all 4 field types
- [ ] Logo upload works in Settings
- [ ] Company name saves correctly
- [ ] PDF shows custom branding (logo + company name)
- [ ] PDF fallback works (YapMate logo if no user branding)

**Code:**
- [x] All code committed and working tree clean
- [x] No linter errors
- [ ] Manual testing complete

---

## 🔍 File Inventory

**New Files:**
- `lib/use-voice-input.ts` (291 lines)
- `components/VoiceInputButton.tsx` (216 lines)
- `lib/logo-upload.ts` (215 lines)
- `supabase/migrations/011_add_invoice_branding.sql` (35 lines)

**Modified Files:**
- `app/invoice/page.tsx` (voice input + branding fetch)
- `app/settings/page.tsx` (logo upload UI)
- `components/InvoicePDF.tsx` (branding prop support)

**Total Lines Changed:** ~500 lines (mostly new code)

---

## 📝 Notes

- All code is committed and ready for testing
- Migration and storage bucket must be created manually in Supabase Dashboard
- No breaking changes to existing features
- All changes are backward compatible (new columns nullable, branding optional)

---

**Status:** ✅ Code complete, awaiting database/storage setup + manual testing
