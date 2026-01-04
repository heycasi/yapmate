-- Create API usage tracking table for rate limiting
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast rate limit queries
CREATE INDEX idx_api_usage_user_endpoint_time ON api_usage(user_id, endpoint, created_at DESC);

-- Enable RLS
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view their own usage
CREATE POLICY "Users can view their own API usage"
  ON api_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage (Edge Functions will insert)
CREATE POLICY "Users can insert their own API usage"
  ON api_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Prevent updates/deletes (append-only log)
CREATE POLICY "No updates to API usage"
  ON api_usage
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes of API usage"
  ON api_usage
  FOR DELETE
  USING (false);
