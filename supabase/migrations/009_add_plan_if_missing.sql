-- Emergency migration: Ensure plan column exists
-- This migration is idempotent and safe to run multiple times

-- Add plan column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'plan'
  ) THEN
    ALTER TABLE user_preferences
      ADD COLUMN plan TEXT DEFAULT 'free' NOT NULL;

    RAISE NOTICE 'Added plan column to user_preferences';
  ELSE
    RAISE NOTICE 'Plan column already exists';
  END IF;
END $$;

-- Ensure the check constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_plan_type'
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT valid_plan_type
      CHECK (plan IN ('free', 'pro', 'trade'));

    RAISE NOTICE 'Added valid_plan_type constraint';
  ELSE
    RAISE NOTICE 'valid_plan_type constraint already exists';
  END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_preferences_plan ON user_preferences(plan);

-- Update connordahl@hotmail.com to trade plan
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_preferences
  SET plan = 'trade', updated_at = NOW()
  WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'connordahl@hotmail.com'
  );

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Updated connordahl@hotmail.com to trade plan';
  ELSE
    RAISE NOTICE 'No user_preferences record found for connordahl@hotmail.com';
  END IF;

  RAISE NOTICE 'Migration complete: plan column ensured and user updated to trade';
END $$;
