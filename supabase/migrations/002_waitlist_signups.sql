-- YapMate Waitlist Signups Table
-- This table stores email addresses from users interested in early access to YapMate.
-- Not production-critical data, but useful for launch planning and marketing.

-- Create the waitlist_signups table
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on email for faster lookups and unique constraint enforcement
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_email ON waitlist_signups(email);

-- Create index on user_id for filtering by authenticated users
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_user_id ON waitlist_signups(user_id);

-- Create index on created_at for sorting by signup date
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON waitlist_signups(created_at DESC);

-- Enable Row Level Security
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert into waitlist (public signup form)
CREATE POLICY "Anyone can sign up for waitlist"
  ON waitlist_signups
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own waitlist entry
CREATE POLICY "Users can view own waitlist entry"
  ON waitlist_signups
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Policy: Service role can view all entries (for admin dashboard)
-- Note: This is handled via service_role key, not via RLS policy

-- Add comment to table
COMMENT ON TABLE waitlist_signups IS 'Stores email signups for YapMate early access waitlist';
COMMENT ON COLUMN waitlist_signups.email IS 'Email address (unique, normalized to lowercase)';
COMMENT ON COLUMN waitlist_signups.user_id IS 'Optional reference to authenticated user if they signed up while logged in';
COMMENT ON COLUMN waitlist_signups.created_at IS 'Timestamp when the user joined the waitlist';
