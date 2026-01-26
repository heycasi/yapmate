# How to Run Migration 011 - Invoice Branding

**File:** `MIGRATION_011_RUN_THIS.sql`

---

## ✅ Easiest Way: Copy-Paste SQL in Supabase Dashboard

**Steps:**

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project: `nidijdprgoauwkmuioer` (or your project)

2. **Open SQL Editor:**
   - Click **SQL Editor** in left sidebar
   - Click **New Query** (or use existing tab)

3. **Copy the SQL:**
   - Open file: `MIGRATION_011_RUN_THIS.sql`
   - Copy all the SQL text

4. **Paste and Run:**
   - Paste into SQL Editor
   - Click **Run** (or press Cmd+Enter / Ctrl+Enter)

5. **Verify:**
   - Should see: "Success. No rows returned" (for ALTER TABLE)
   - Then: 2 rows returned (for SELECT verification)
   - Rows: `invoice_logo_url | text` and `invoice_company_name | text`

**Done!** ✅

---

## Alternative: Add DATABASE_URL to .env.local

If you want to use the migration script:

1. **Get connection string from Supabase:**
   - Dashboard → Settings → Database
   - Scroll to "Connection string"
   - Select **Session mode**
   - Copy connection string

2. **Add to .env.local:**
   ```env
   DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

3. **Run migration:**
   ```bash
   npm run migrate
   ```

---

## Quick Check After Migration

**In Supabase SQL Editor, run:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');
```

**Should return 2 rows.** ✅

---

**I created `MIGRATION_011_RUN_THIS.sql` - just copy-paste into Supabase SQL Editor!** 🚀
