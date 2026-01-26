# Fix: Logo Overlap + Missing Supabase Schema

**Date:** 2026-01-14  
**Issues:**
1. Logo rendering over another logo on home page
2. Missing Supabase schema for invoice branding

---

## Issue 1: Logo Overlap

**Problem:** Logo appears to be rendering over another logo element.

**Likely Cause:** The logo image file (`yapmatetransparetnew112.png`) might have its own background/text, and it's being rendered inside an amber circle background, causing visual overlap.

**Solution Options:**

### Option A: Remove Background Circle (If Logo Has Its Own Background)
If the logo PNG already has a background/design, remove the amber circle wrapper.

### Option B: Adjust Logo Image
Use a transparent logo without background text/design.

### Option C: Fix Z-Index/Layering
Ensure proper layering so only one logo shows.

**Need to see:** What the logo file actually contains to determine best fix.

---

## Issue 2: Missing Supabase Schema

**Problem:** `invoice_logo_url` and `invoice_company_name` columns don't exist in `user_preferences` table.

**Solution:** Run the migration.

**Migration File:** `supabase/migrations/011_add_invoice_branding.sql`

**SQL to Run:**
```sql
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;
```

**How to Run:**

### Option A: Using Migration Script
```bash
# Make sure DATABASE_URL is in .env.local
npm run migrate
```

### Option B: Manual in Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL above
3. Click "Run"

**Verify:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');
```

Should return 2 rows.

---

## Next Steps

1. **Fix logo overlap** - Need to see what's causing it (check logo file)
2. **Run Supabase migration** - Add branding columns
3. **Create storage bucket** - For logo uploads (separate step)
