# Run Supabase Migration for Invoice Branding

**Issue:** Missing `invoice_logo_url` and `invoice_company_name` columns in `user_preferences` table.

**Migration File:** `supabase/migrations/011_add_invoice_branding.sql`

---

## Quick Fix: Run Migration

### Option A: Using Migration Script (Easiest)

**Prerequisites:**
- `.env.local` file exists
- `DATABASE_URL` is set in `.env.local`

**Steps:**
```bash
# 1. Check if DATABASE_URL is set
grep DATABASE_URL .env.local

# 2. If not set, add it:
# Get connection string from Supabase Dashboard → Settings → Database
# Add to .env.local: DATABASE_URL=postgresql://...

# 3. Run migration
npm run migrate
```

**Expected Output:**
```
🚀 Starting migration process...
🔌 Connecting to database...
✅ Connected successfully!
📁 Found X migration file(s):
⏳ Running: 011_add_invoice_branding.sql...
   ✅ 011_add_invoice_branding.sql completed successfully
✨ All migrations completed successfully!
```

---

### Option B: Manual SQL in Supabase Dashboard

**Steps:**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to: **SQL Editor** (left sidebar)
4. Click **New Query**
5. Paste this SQL:
   ```sql
   ALTER TABLE user_preferences
     ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
     ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;
   ```
6. Click **Run** (or press Cmd+Enter)
7. Should see: "Success. No rows returned"

---

## Verify Migration Worked

**In Supabase SQL Editor, run:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');
```

**Expected Result:** 2 rows returned:
- `invoice_logo_url` | `text`
- `invoice_company_name` | `text`

---

## After Migration

Once columns are added:
1. ✅ Logo upload in Settings will work
2. ✅ Company name save will work
3. ✅ PDF generation will show branding

**Next Step:** Create storage bucket `invoice-logos` (separate task)

---

**Status:** Ready to run - choose Option A or B above! 🚀
