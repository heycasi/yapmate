-- Make CIS and VAT fields nullable to support "unknown" state
-- Previously these defaulted to false, which caused hallucination

-- Drop existing defaults and make columns nullable
ALTER TABLE invoices
  ALTER COLUMN cis_job DROP DEFAULT,
  ALTER COLUMN cis_job DROP NOT NULL;

ALTER TABLE invoices
  ALTER COLUMN vat_registered DROP DEFAULT,
  ALTER COLUMN vat_registered DROP NOT NULL;

-- Add comment explaining the three states
COMMENT ON COLUMN invoices.cis_job IS 'null = unknown/not mentioned, true = CIS applies, false = CIS does not apply';
COMMENT ON COLUMN invoices.vat_registered IS 'null = unknown/not mentioned, true = VAT registered, false = not VAT registered';
