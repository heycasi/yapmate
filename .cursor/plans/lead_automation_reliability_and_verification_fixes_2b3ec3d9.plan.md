---
name: Lead automation reliability and verification fixes
overview: Fix lead sequencer hangs, improve email sender eligibility logging, ensure secrets are never printed, add structured breakdown logging for "0 eligible leads", verify scheduling works, and provide clear verification commands.
todos: []
isProject: false
---

# Lead Automation System - Reliability & Verification Fixes

## Current State Analysis

**Workflows:**

- `sequencer.yml`: Runs scraping/enrichment/auto-approval (4x daily: 09:00, 13:00, 18:00, 21:00 UK)
- `email_sender.yml`: Sends emails (5x daily weekdays: 09:00, 11:00, 13:00, 15:00, 17:00 UK)
- `scheduler_trigger.yml`: External trigger wrapper (already exists)

**Key Files:**

- `yapmate-leads/scripts/run_sequencer.py`: Main orchestrator
- `yapmate-leads/src/task_runner.py`: Task execution with Apify scraping
- `yapmate-leads/src/apify_client.py`: Apify wrapper (already has heartbeat + timeout)
- `yapmate-leads/src/sequencer_email_sender.py`: Email sending logic
- `yapmate-leads/src/sequencer_sheets.py`: Sheets operations (get_eligible_leads at line 413)
- `yapmate-leads/src/config.py`: Central config (secrets handling)
- `yapmate-leads/scripts/smoke_test.py`: Smoke test (exists but needs enhancement)

**Issues Identified:**

1. Apify timeout exists but may need better error handling in task_runner
2. Eligibility logic exists but lacks breakdown logging when 0 eligible
3. Secrets may be printed in logs (need audit)
4. Volume config defaults exist but need verification
5. External cron trigger script exists but needs verification

## Implementation Plan

### PHASE 1: Fix Apify Timeout & Hangs

**Files to modify:**

- `yapmate-leads/src/task_runner.py` (lines 379-692)

**Changes:**

1. Wrap Apify call in try/except for `ApifyTimeoutError` (already imported at line 205)
2. On timeout, mark task as FAILED with clear message (not hang)
3. Ensure heartbeat continues even if Apify hangs internally
4. Add timeout check before starting Apify (if already past timeout, skip)

**Code location:** `task_runner.py` `run_task()` method, around line 441 where `scraper.scrape_leads()` is called.

### PHASE 2: Add Eligibility Breakdown Logging

**Files to modify:**

- `yapmate-leads/src/sequencer_email_sender.py` (lines 678-940)

**Changes:**

1. Before fetching eligible leads, get ALL leads and compute breakdown:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Total rows in leads tab
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Count by status (NEW, APPROVED, SENT, etc.)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Approved count
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Approved + not already sent
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Has email (not empty)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Email passes sanitization
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Domain allowed (if free email filtering exists)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Final eligible count

2. Log breakdown with masked PII (show counts, not emails)
3. If 0 eligible, show top 3 reasons with counts
4. Add this BEFORE line 788 where `get_eligible_leads()` is called

**New function to add:** `_log_eligibility_breakdown()` in `SequencerEmailSender` class.

### PHASE 3: Secrets Audit & Fail-Closed

**Files to audit:**

- `yapmate-leads/src/config.py`: Already handles secrets correctly (no printing)
- `yapmate-leads/src/sequencer_email_sender.py`: Check `_check_send_enabled()` (line 463) - already fail-closed
- `yapmate-leads/src/task_runner.py`: Check Apify/OpenAI initialization (lines 59-78) - already graceful
- `.github/workflows/sequencer.yml`: Check env var usage (lines 114-133)
- `.github/workflows/email_sender.yml`: Check env var usage (lines 134-152)

**Changes:**

1. Ensure `GOOGLE_SHEET_ID` is stripped (remove any whitespace/newlines)
2. Ensure `RESEND_API_KEY` is stripped (already done at line 140 of email_sender.py)
3. Ensure `EMAIL_FROM` and `EMAIL_FROM_NAME` treat empty string as missing (already done with `or` fallback)
4. Add validation in `config.py` to strip all string secrets
5. Add check: if `SEND_ENABLED` is not exactly "true", fail-closed (already done)

**New validation function:** Add `_validate_and_strip_secrets()` in `config.py` `load_config()`.

### PHASE 4: Volume Config Verification

**Files to verify:**

- `.github/workflows/email_sender.yml`: Lines 48-53 (env defaults)
- `yapmate-leads/src/config.py`: Lines 66-73 (LimitsConfig defaults)
- `yapmate-leads/src/sequencer_email_sender.py`: Lines 759-762 (uses config)

**Changes:**

1. Verify defaults: `DAILY_LIMIT=50`, `SEND_LIMIT_PER_RUN=10`, `DELAY_BETWEEN_SENDS=0.6`
2. Ensure workflow passes secrets correctly (lines 148-150 of email_sender.yml)
3. Add batch update logic if missing (check if `batch_update_size` is used)

**Verification:** Defaults already correct. Ensure workflow secrets override defaults.

### PHASE 5: Scheduling Verification

**Files to check:**

- `.github/workflows/sequencer.yml`: Schedule at line 17
- `.github/workflows/email_sender.yml`: Schedule at line 16
- `.github/workflows/scheduler_trigger.yml`: External trigger (already exists)
- `yapmate-leads/CRON_EXTERNAL_TRIGGER_SETUP.md`: Documentation (already exists)

**Changes:**

1. Verify cron schedules are correct for UK times with DST
2. Ensure `scheduler_trigger.yml` has correct logic (lines 38-61)
3. Add verification script: `yapmate-leads/scripts/verify_schedule.py` to test dispatch
4. Update `CRON_EXTERNAL_TRIGGER_SETUP.md` if needed

### PHASE 6: Enhanced Smoke Test

**Files to modify:**

- `yapmate-leads/scripts/smoke_test.py` (already exists, lines 1-148)

**Changes:**

1. Add eligibility breakdown (reuse logic from Phase 2)
2. Show counts by status tab
3. Show top 3 reasons if 0 eligible
4. Add check: verify no secrets in output (scan for common patterns)

### PHASE 7: Structured Logging for "0 Eligible"

**Files to modify:**

- `yapmate-leads/src/sequencer_email_sender.py` (lines 791-825)

**Changes:**

1. When `len(leads) == 0`, call eligibility breakdown logger
2. Show structured output:
   ```
   ELIGIBILITY BREAKDOWN:
     Total leads: X
     By status:
       NEW: Y
       APPROVED: Z
       SENT: W
     Approved + not sent: A
     Has email: B
     Valid email (sanitized): C
     Domain allowed: D
     Final eligible: 0
   
   TOP 3 REASONS (counts):
     1. No email address: X
     2. Already sent: Y
     3. Invalid email: Z
   ```

3. Mask all PII (no email addresses, only counts)

### PHASE 8: Verification Commands & Documentation

**New file:** `yapmate-leads/VERIFICATION_GUIDE.md`

**Content:**

1. Three copy/paste commands to verify:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Smoke test: `cd yapmate-leads && python scripts/smoke_test.py`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Manual sequencer: `cd yapmate-leads && python scripts/run_sequencer.py --status`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Manual sender (dry-run): `cd yapmate-leads && python scripts/run_sequencer.py --send-only --send-limit 1 --dry-run`

2. Where to check emails: Resend dashboard URL
3. How to verify schedules: Check GitHub Actions runs
4. How to test external trigger: Use `scheduler_trigger.yml` manual dispatch

## Files to Create/Modify

**Modify:**

1. `yapmate-leads/src/task_runner.py` - Better Apify timeout handling
2. `yapmate-leads/src/sequencer_email_sender.py` - Eligibility breakdown logging
3. `yapmate-leads/src/config.py` - Secret validation/stripping
4. `yapmate-leads/scripts/smoke_test.py` - Enhanced breakdown
5. `.github/workflows/email_sender.yml` - Verify secret handling (likely no changes)

**Create:**

1. `yapmate-leads/VERIFICATION_GUIDE.md` - Verification commands
2. `yapmate-leads/scripts/verify_schedule.py` - Schedule verification script (optional)

## Testing Checklist

After implementation:

1. Run smoke test: Should show eligibility breakdown
2. Trigger sequencer manually: Should not hang on Apify timeout
3. Trigger sender with 0 eligible: Should show breakdown with reasons
4. Check logs: No secrets printed
5. Verify volume: Defaults show 50/day, 10/run
6. Test external trigger: `scheduler_trigger.yml` manual dispatch works

## Secrets Required (Names Only)

- `GOOGLE_SHEETS_CREDENTIALS_JSON`
- `GOOGLE_SHEET_ID`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `EMAIL_REPLY_TO`
- `OPENAI_API_KEY`
- `APIFY_API_TOKEN`
- `APIFY_ACTOR_ID`
- `SEND_ENABLED`
- `DAILY_LIMIT` (optional, defaults to 50)
- `SEND_LIMIT_PER_RUN` (optional, defaults to 10)
- `DELAY_BETWEEN_SENDS` (optional, defaults to 0.6)
- `AUTO_APPROVE_ENABLED` (optional)
- `AUTO_APPROVE_MAX_PER_RUN` (optional)
- `CRON_TRIGGER_TOKEN` (for external triggers)