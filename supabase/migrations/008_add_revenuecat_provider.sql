-- Add RevenueCat provider support to subscriptions table
-- Extends existing IAP support to use RevenueCat instead of direct Apple receipts

-- Add provider column
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IN ('stripe', 'apple', 'revenuecat'));

-- Update existing rows to have a provider
UPDATE subscriptions
SET provider = CASE
  WHEN stripe_subscription_id IS NOT NULL THEN 'stripe'
  WHEN apple_transaction_id IS NOT NULL THEN 'apple'
  ELSE 'stripe' -- Default for free plans
END
WHERE provider IS NULL;

-- Make provider required for non-free plans
ALTER TABLE subscriptions
  ADD CONSTRAINT provider_required_for_paid
  CHECK (
    plan = 'free' OR provider IS NOT NULL
  );

-- Add RevenueCat customer ID column (in addition to apple_transaction_id)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT;

-- Index for RevenueCat lookups
CREATE INDEX IF NOT EXISTS subscriptions_revenuecat_id_idx
  ON subscriptions(revenuecat_customer_id)
  WHERE revenuecat_customer_id IS NOT NULL;

-- Update check constraint to allow RevenueCat
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (
    (plan = 'free') OR
    (provider = 'stripe' AND stripe_subscription_id IS NOT NULL) OR
    (provider = 'apple' AND apple_transaction_id IS NOT NULL) OR
    (provider = 'revenuecat' AND revenuecat_customer_id IS NOT NULL)
  );

-- Add status 'trialing' as alias for 'trial'
-- (Keep 'trial' for backward compatibility)
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'trialing'));

COMMENT ON COLUMN subscriptions.provider IS 'Payment provider: stripe (web), apple (legacy), or revenuecat (iOS)';
COMMENT ON COLUMN subscriptions.revenuecat_customer_id IS 'RevenueCat customer ID (App User ID)';
