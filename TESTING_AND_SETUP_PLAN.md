# Testing and Setup Plan - feat/rerecord-branding-copy-logo

**Date:** 2026-01-14  
**Goal:** Get all features working and tested before merge

---

## 🎯 Execution Order

### Step 1: Test Voice Re-Record (No Migration Needed) ✅
**Status:** Ready to test  
**Dependencies:** None (uses existing transcription edge function)

**Test:**
1. Start dev server: `npm run dev`
2. Navigate to `/invoice?id={invoiceId}` (any existing invoice)
3. Test mic buttons on Customer, Job Summary, Notes, Material fields
4. Verify transcription works and fields update

**Why First:** No database changes needed, can verify code works immediately

---

### Step 2: Run Database Migration ⚠️
**Status:** Needs DATABASE_URL in `.env.local`  
**Command:** `npm run migrate`

**Prerequisites:**
- `.env.local` file exists with `DATABASE_URL`
- OR manually run SQL in Supabase Dashboard

**Verify:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');
```

**Why Second:** Branding features won't work without these columns

---

### Step 3: Create Storage Bucket ⚠️
**Status:** Manual in Supabase Dashboard  
**Action:** Create `invoice-logos` bucket (public: true) + RLS policies

**Why Third:** Logo upload will fail without bucket

---

### Step 4: Test Branding Features ✅
**Status:** Ready after Step 2 & 3  
**Test:**
1. Settings → Invoice Branding → Upload logo
2. Settings → Invoice Branding → Enter company name
3. Invoice → Download PDF → Verify branding appears

---

## 📋 Current Status

Let me check what we can do right now...
