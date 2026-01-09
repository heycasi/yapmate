-- Add source column to waitlist_signups table
-- This tracks where signups came from (e.g., 'flyer', 'website', etc.)

ALTER TABLE waitlist_signups
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_source ON waitlist_signups(source);

-- Add comment for documentation
COMMENT ON COLUMN waitlist_signups.source IS 'Source of the signup (e.g., flyer, website, qr_code)';
