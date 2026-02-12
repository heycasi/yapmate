-- Beta invites table for no-card trial access
-- Allows granting Pro/Trade access by email without requiring payment

CREATE TABLE IF NOT EXISTS beta_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro', 'trade')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on lowercase email to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS beta_invites_email_unique ON beta_invites (lower(email));

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS beta_invites_email_lookup ON beta_invites (lower(email));

-- RLS Policies
ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only read their own invite (matched by email)
CREATE POLICY "Users can view their own beta invite"
  ON beta_invites
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- No insert/update/delete for regular users - only service role
-- (Admin script will use service role key)
