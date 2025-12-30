-- Usage Events Tracking
-- Track invoice creation and other user actions for pricing analytics

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON usage_events(user_id);

-- Index for event type queries
CREATE INDEX IF NOT EXISTS usage_events_event_type_idx ON usage_events(event_type);

-- Index for invoice lookups (to prevent duplicate logs)
CREATE INDEX IF NOT EXISTS usage_events_invoice_id_idx ON usage_events(invoice_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS usage_events_created_at_idx ON usage_events(created_at DESC);

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert their own usage events"
  ON usage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own events
CREATE POLICY "Users can view their own usage events"
  ON usage_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No update or delete policies - events are immutable

COMMENT ON TABLE usage_events IS 'Tracks user actions for analytics and billing purposes';
COMMENT ON COLUMN usage_events.event_type IS 'Event type: invoice_created, etc.';
COMMENT ON COLUMN usage_events.invoice_id IS 'Reference to related invoice (nullable)';
