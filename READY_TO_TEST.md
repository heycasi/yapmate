# Ready to Test - feat/rerecord-branding-copy-logo

**Date:** 2026-01-14  
**Status:** ✅ Code complete, ready for database setup + testing

---

## ✅ What's Done (Code Complete)

### 1. Per-Field Voice Re-Record ✅
- `lib/use-voice-input.ts` - Hook for field-level recording
- `components/VoiceInputButton.tsx` - Mic button component
- `app/invoice/page.tsx` - Voice input on 4 field types:
  - Customer name
  - Job Summary
  - Notes
  - Material descriptions (per row)

**Test Status:** Ready to test (no migration needed)

---

### 2. Invoice Branding (Logo + Company Name) ✅
- `supabase/migrations/011_add_invoice_branding.sql` - Migration file ready
- `lib/logo-upload.ts` - Upload/delete/validate functions
- `app/settings/page.tsx` - Invoice Branding UI section:
  - Logo upload (PNG/JPG/WebP, max 2MB, auto-resize 1024px)
  - Company name input
  - Preview current logo
  - Remove logo button
- `components/InvoicePDF.tsx` - Shows user logo/company name or YapMate fallback
- `app/invoice/page.tsx` - Fetches branding and passes to PDF

**Test Status:** Ready after migration + storage bucket setup

---

## 🚀 Next Steps (In Order)

### Step 1: Test Voice Re-Record (No Setup Needed)

**Can do this right now!**

```bash
# Start dev server
npm run dev

# Navigate to:
# http://localhost:3000/invoice?id={anyInvoiceId}
```

**Test Checklist:**
- [ ] Click mic button on Customer field → Record → Stop → Field updates
- [ ] Click mic button on Job Summary → Record → Stop → Field updates
- [ ] Click mic button on Notes → Record → Stop → Field updates
- [ ] Click mic on Material description → Record → Stop → Field updates
- [ ] Try starting recording on one field while another is active → Should be blocked (global lock)
- [ ] Cancel during recording → No change to field
- [ ] Cancel during transcription → No change to field

**Expected Result:** All fields update with transcribed text when recording completes

---

### Step 2: Run Database Migration

**Option A: Using Migration Script (if DATABASE_URL set)**

```bash
# Check if .env.local has DATABASE_URL
# If yes, run:
npm run migrate
```

**Option B: Manual SQL in Supabase Dashboard**

1. Go to Supabase Dashboard → SQL Editor
2. Run:
   ```sql
   ALTER TABLE user_preferences
     ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
     ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;
   ```

**Verify Migration:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');
```

Should return 2 rows.

---

### Step 3: Create Storage Bucket

**In Supabase Dashboard:**

1. **Storage** → **New Bucket**
2. **Name:** `invoice-logos`
3. **Public:** ✅ Yes (check this - required for PDF generation)
4. **Create**

**RLS Policies (in Storage → invoice-logos → Policies):**

**1. SELECT Policy (Read All Logos)**
- Policy name: `Authenticated users can read all logos`
- Operation: `SELECT`
- Target roles: `authenticated`
- Policy: `true`

**2. INSERT Policy (Upload Own Logo)**
- Policy name: `Users can upload to their own folder`
- Operation: `INSERT`
- Target roles: `authenticated`
- Policy: `bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text`

**3. UPDATE Policy (Update Own Logo)**
- Policy name: `Users can update their own files`
- Operation: `UPDATE`
- Target roles: `authenticated`
- Policy: `bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text`

**4. DELETE Policy (Delete Own Logo)**
- Policy name: `Users can delete their own files`
- Operation: `DELETE`
- Target roles: `authenticated`
- Policy: `bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text`

---

### Step 4: Test Branding Features

**After Steps 2 & 3 are done:**

1. **Logo Upload:**
   - Go to `/settings`
   - Scroll to "Invoice Branding" section
   - Click "Tap to upload logo"
   - Select PNG/JPG file (< 2MB)
   - Verify logo uploads and preview appears

2. **Company Name:**
   - In Settings → Invoice Branding
   - Enter company name: "Test Company Ltd"
   - Click "Save" at bottom
   - Verify name saves

3. **PDF Generation:**
   - Open any invoice (`/invoice?id={invoiceId}`)
   - Click "Download PDF"
   - Verify PDF shows:
     - User's logo (if uploaded) OR YapMate logo (if not)
     - User's company name (if provided)

---

## 📋 Quick Status Check

**Code Status:**
- ✅ All code committed (`feat/rerecord-branding-copy-logo` branch)
- ✅ No linter errors
- ✅ Working tree clean

**Database Status:**
- ⚠️ Migration file ready (`011_add_invoice_branding.sql`)
- ❓ Columns need to be added (run migration)

**Storage Status:**
- ❓ Bucket `invoice-logos` needs to be created
- ❓ RLS policies need to be added

**Testing Status:**
- ❓ Voice re-record: Ready to test (no migration needed)
- ❓ Branding: Ready after migration + bucket setup

---

## 🎯 Recommended Action Now

**Start with Step 1 (Voice Re-Record Testing):**

This requires no database changes and can be tested immediately:

1. `npm run dev`
2. Navigate to an invoice page
3. Test all 4 mic buttons
4. Verify transcription and field updates work

**Then move to Steps 2 & 3 (Database + Storage):**

1. Run migration (SQL or script)
2. Create storage bucket + policies
3. Test branding features

---

## 📝 Files Ready

**New Files:**
- `lib/use-voice-input.ts` (291 lines)
- `components/VoiceInputButton.tsx` (216 lines)
- `lib/logo-upload.ts` (215 lines)
- `supabase/migrations/011_add_invoice_branding.sql` (35 lines)

**Modified Files:**
- `app/invoice/page.tsx` (voice input + branding)
- `app/settings/page.tsx` (logo upload UI)
- `components/InvoicePDF.tsx` (branding prop)

**All ready and committed!** ✅
