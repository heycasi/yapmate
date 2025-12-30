-- Add pricing plan support to user_preferences
-- This migration adds the `plan` field to enable plan-based access control

-- ============================================================================
-- Create user_preferences table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_labour_rate NUMERIC DEFAULT 45.00,
  default_vat_enabled BOOLEAN DEFAULT false,
  default_cis_enabled BOOLEAN DEFAULT false,
  bank_account_name TEXT,
  bank_sort_code TEXT,
  bank_account_number TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable Row Level Security if not already enabled
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  -- Policy: Users can view their own preferences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_preferences'
    AND policyname = 'Users can view own preferences'
  ) THEN
    CREATE POLICY "Users can view own preferences"
      ON user_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Policy: Users can insert their own preferences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_preferences'
    AND policyname = 'Users can insert own preferences'
  ) THEN
    CREATE POLICY "Users can insert own preferences"
      ON user_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policy: Users can update their own preferences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_preferences'
    AND policyname = 'Users can update own preferences'
  ) THEN
    CREATE POLICY "Users can update own preferences"
      ON user_preferences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- Add plan column to user_preferences
-- ============================================================================
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' NOT NULL;

-- Add check constraint for plan values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_plan_type'
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT valid_plan_type
      CHECK (plan IN ('free', 'pro', 'trade'));
  END IF;
END $$;

-- Create index on plan for fast plan-based queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_plan ON user_preferences(plan);

-- ============================================================================
-- Set default plan for all existing users
-- ============================================================================
-- Update any existing user_preferences records to have plan = 'free'
UPDATE user_preferences
SET plan = 'free'
WHERE plan IS NULL;

-- ============================================================================
-- Add comments for documentation
-- ============================================================================
COMMENT ON TABLE user_preferences IS 'User settings and preferences including pricing plan';
COMMENT ON COLUMN user_preferences.plan IS 'User pricing plan: free (limited invoices), pro (unlimited), or trade (unlimited + CIS features)';
COMMENT ON COLUMN user_preferences.user_id IS 'Reference to auth.users, one row per user';

-- ============================================================================
-- Create trigger for updated_at timestamp
-- ============================================================================
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration complete
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'User plans migration complete:';
  RAISE NOTICE '  - user_preferences table ensured';
  RAISE NOTICE '  - plan column added with constraint (free/pro/trade)';
  RAISE NOTICE '  - Default plan set to "free" for all users';
  RAISE NOTICE '  - RLS policies configured';
END $$;
