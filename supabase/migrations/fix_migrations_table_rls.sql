-- ============================================================================
-- Fix RLS on _migrations table
-- Date: 2026-01-15
-- ============================================================================
--
-- The _migrations table is used by Supabase to track which migrations have
-- been run. It doesn't contain user data, but Supabase linter requires RLS
-- to be enabled on all public tables.
--
-- ============================================================================

-- Enable RLS on _migrations table
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;

-- No policies needed - this table should not be accessible to regular users
-- Only service_role and postgres roles can access it

-- ============================================================================
-- DONE! Security warning resolved.
-- ============================================================================
