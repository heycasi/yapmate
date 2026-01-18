-- Add invoice branding fields to user_preferences
-- Allows users to customise their invoice header with a logo and/or company name

-- Add branding columns
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_company_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_preferences.invoice_logo_url IS 'URL to user-uploaded logo for invoice header (stored in Supabase Storage)';
COMMENT ON COLUMN user_preferences.invoice_company_name IS 'Company or trading name displayed on invoice header if no logo';

-- Create storage bucket for invoice logos (if not exists)
-- Note: This needs to be run separately via Supabase Dashboard or CLI
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('invoice-logos', 'invoice-logos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Policy for invoice-logos bucket allowing authenticated users to upload their own logos
-- This should be configured in Supabase Dashboard:
-- 1. Create bucket: invoice-logos (public: true)
-- 2. Add RLS policies:
--    - SELECT: authenticated users can read all logos (for PDF generation)
--    - INSERT: authenticated users can upload to their own folder (user_id/*)
--    - UPDATE: authenticated users can update their own files
--    - DELETE: authenticated users can delete their own files

DO $$
BEGIN
  RAISE NOTICE 'Invoice branding migration complete:';
  RAISE NOTICE '  - Added invoice_logo_url column';
  RAISE NOTICE '  - Added invoice_company_name column';
  RAISE NOTICE '  - IMPORTANT: Create "invoice-logos" storage bucket manually in Supabase Dashboard';
END $$;
