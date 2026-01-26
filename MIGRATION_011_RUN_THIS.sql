-- Migration 011: Add Invoice Branding Fields
-- Copy and paste this entire file into Supabase Dashboard → SQL Editor → Run

-- Add branding columns to user_preferences table
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_preferences.invoice_logo_url IS 'URL to user-uploaded logo for invoice header (stored in Supabase Storage)';
COMMENT ON COLUMN user_preferences.invoice_company_name IS 'Company or trading name displayed on invoice header if no logo';

-- Verify the columns were added (optional check)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN ('invoice_logo_url', 'invoice_company_name');

-- Expected result: 2 rows
-- invoice_logo_url | text
-- invoice_company_name | text
