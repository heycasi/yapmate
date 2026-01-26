-- Create Storage Bucket for Invoice Logos
-- Run this in Supabase Dashboard → SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-logos', 'invoice-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Authenticated users can read all logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- RLS Policy 1: SELECT (Read) - All authenticated users can read all logos
-- This is needed for PDF generation to access logo URLs
CREATE POLICY "Authenticated users can read all logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-logos');

-- RLS Policy 2: INSERT (Upload) - Users can upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy 3: UPDATE - Users can update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoice-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'invoice-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy 4: DELETE - Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Verify bucket was created
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'invoice-logos';

-- Expected result: 1 row
-- invoice-logos | invoice-logos | true
