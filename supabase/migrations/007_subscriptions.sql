-- Subscriptions Table
-- Tracks user subscription status from both Stripe (web) and Apple IAP (iOS)

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Payment provider identifiers
  stripe_subscription_id TEXT,
  apple_transaction_id TEXT,

  -- Subscription details
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'trade')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),

  -- Period tracking
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  UNIQUE(user_id), -- One subscription per user
  CHECK (
    -- Must have either Stripe OR Apple transaction ID (not both, not neither for paid plans)
    (plan = 'free') OR
    (stripe_subscription_id IS NOT NULL AND apple_transaction_id IS NULL) OR
    (stripe_subscription_id IS NULL AND apple_transaction_id IS NOT NULL)
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_id_idx ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_apple_id_idx ON subscriptions(apple_transaction_id) WHERE apple_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_period_end_idx ON subscriptions(current_period_end);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all subscriptions (for webhook handlers)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

COMMENT ON TABLE subscriptions IS 'User subscription status from Stripe or Apple IAP';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe subscription ID for web payments';
COMMENT ON COLUMN subscriptions.apple_transaction_id IS 'Apple original transaction ID for IAP';
COMMENT ON COLUMN subscriptions.status IS 'active, cancelled, expired, or trial';
