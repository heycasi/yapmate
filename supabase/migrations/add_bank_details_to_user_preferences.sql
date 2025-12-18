-- Add bank details columns to user_preferences table
-- Run this migration in Supabase SQL Editor

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_sort_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Add check constraint for sort code format (XX-XX-XX)
ALTER TABLE user_preferences
  ADD CONSTRAINT sort_code_format
  CHECK (bank_sort_code IS NULL OR bank_sort_code ~ '^\d{2}-\d{2}-\d{2}$');

-- RLS is already enabled on user_preferences table from previous migrations
-- Policies already restrict users to their own rows via user_id

-- Migration complete
