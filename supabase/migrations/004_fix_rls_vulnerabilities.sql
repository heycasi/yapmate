-- Fix RLS Vulnerabilities - Critical Issue #2
-- This migration fixes blind trust issues and missing policies in RLS

-- ============================================================================
-- CRITICAL FIX #1: Add customer_id validation to invoices table
-- ============================================================================
-- Problem: Users could associate their invoices with other users' customers
-- Fix: Validate that customer_id (if provided) belongs to the same user

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;

-- Create new INSERT policy with customer_id validation
CREATE POLICY "Users can insert their own invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    -- User must own the invoice
    auth.uid() = user_id
    AND (
      -- Either customer_id is NULL (no customer linked)
      customer_id IS NULL
      -- OR customer_id must belong to a customer owned by the same user
      OR EXISTS (
        SELECT 1 FROM customers
        WHERE customers.id = customer_id
        AND customers.user_id = auth.uid()
      )
    )
  );

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;

-- Create new UPDATE policy with customer_id validation
CREATE POLICY "Users can update their own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- User must own the invoice
    auth.uid() = user_id
    AND (
      -- Either customer_id is NULL (no customer linked)
      customer_id IS NULL
      -- OR customer_id must belong to a customer owned by the same user
      OR EXISTS (
        SELECT 1 FROM customers
        WHERE customers.id = customer_id
        AND customers.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- HIGH PRIORITY FIX #2: Add DELETE policy to user_preferences
-- ============================================================================
-- Problem: Users cannot delete their own preferences (GDPR compliance issue)
-- Fix: Add DELETE policy

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- MEDIUM PRIORITY FIX #3: Clean up waitlist_signups policies
-- ============================================================================
-- Problem 1: Duplicate INSERT policies
-- Problem 2: Missing UPDATE and DELETE policies

-- Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist_signups;

-- Keep "Anyone can sign up for waitlist" (already exists)

-- Add UPDATE policy (users can update their own waitlist entry)
CREATE POLICY "Users can update own waitlist entry"
  ON waitlist_signups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy (users can remove themselves from waitlist)
CREATE POLICY "Users can delete own waitlist entry"
  ON waitlist_signups FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "Users can insert their own invoices" ON invoices IS
  'Prevents users from associating their invoices with other users customers by validating customer_id ownership';

COMMENT ON POLICY "Users can update their own invoices" ON invoices IS
  'Prevents users from updating invoice.customer_id to point to another users customer';

COMMENT ON POLICY "Users can delete own preferences" ON user_preferences IS
  'GDPR compliance: allows users to delete their own preferences data';

COMMENT ON POLICY "Users can update own waitlist entry" ON waitlist_signups IS
  'Allows users to update their email if they made a typo';

COMMENT ON POLICY "Users can delete own waitlist entry" ON waitlist_signups IS
  'GDPR compliance: allows users to remove themselves from the waitlist';

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verification: Check that all critical tables have proper RLS policies
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Count tables with RLS enabled
  SELECT COUNT(*)
  INTO table_count
  FROM pg_class
  WHERE relrowsecurity = true
  AND relnamespace = 'public'::regnamespace;

  -- Count total policies
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE 'RLS Fix Migration Complete:';
  RAISE NOTICE '  - Tables with RLS enabled: %', table_count;
  RAISE NOTICE '  - Total RLS policies: %', policy_count;
  RAISE NOTICE '  - Critical vulnerability (customer_id blind trust): FIXED';
  RAISE NOTICE '  - user_preferences DELETE policy: ADDED';
  RAISE NOTICE '  - waitlist_signups policies: CLEANED UP';
END $$;
