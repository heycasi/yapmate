# YapMate Lead Automation - Verification Guide

Quick commands to verify the system is working correctly.

## Quick Verification Commands

### 1. Smoke Test (Local)

Run this to check system health and see lead counts:

cd yapmate-leads && python scripts/smoke_test.py

Expected output:
- Environment variables status (OK/MISSING)
- Google Sheets connection: OK
- All tabs: OK
- Lead counts by status
- Eligible leads count
- Task queue status
- Runner state

### 2. Manual Sequencer Run

Trigger the sequencer manually (bypasses time guard):

cd yapmate-leads && python scripts/run_sequencer.py

Or with status check:

cd yapmate-leads && python scripts/run_sequencer.py --status

### 3. Manual Email Sender (Dry Run)

Test email sender without actually sending:

cd yapmate-leads && python scripts/run_sequencer.py --send-only --send-limit 1 --dry-run

To actually send (if SEND_ENABLED=true):

cd yapmate-leads && python scripts/run_sequencer.py --send-only --send-limit 1

## GitHub Actions Verification

### Check Workflow Runs

1. Go to: https://github.com/heycasi/yapmate/actions
2. Check "Lead Sequencer" workflow - should show recent runs
3. Check "Email Sender" workflow - should show recent runs

### Manual Trigger (GitHub UI)

1. Go to Actions tab
2. Select "Lead Sequencer" workflow
3. Click "Run workflow" button
4. Set inputs:
   - skip_time_guard: true
   - dry_run: false
5. Click "Run workflow"

For Email Sender:
1. Select "Email Sender" workflow
2. Click "Run workflow"
3. Set inputs:
   - force_run: true
   - dry_run: false
   - send_limit: 1
4. Click "Run workflow"

### What Success Looks Like

**Lead Sequencer:**
- Job completes without hanging
- Shows heartbeat logs during Apify scraping (every 20s)
- Shows task completion with lead counts
- No timeout errors

**Email Sender:**
- Shows eligibility breakdown (counts only, no PII)
- Shows gate checks (SEND_ENABLED, DRY_RUN, etc.)
- Shows which gate blocked if no sends (or shows send count if successful)
- No secrets in logs

## Check Email Sends (Resend Dashboard)

1. Go to: https://resend.com/emails
2. Log in with your Resend account
3. Check recent emails sent
4. Verify email IDs match logs

## Troubleshooting

### "0 eligible leads" - Check Breakdown

The email sender now shows a breakdown when 0 eligible:
- Total leads
- Counts by status (NEW, APPROVED, SENT, etc.)
- Has email count
- Valid email count
- Top 3 reasons with counts

### "SEND_ENABLED gate is CLOSED"

This means SEND_ENABLED is not set to "true" in GitHub Secrets.
- Go to: https://github.com/heycasi/yapmate/settings/secrets/actions
- Check SEND_ENABLED value
- Must be exactly "true" (case-sensitive)

### "Daily limit reached"

This is expected if you've already sent 50 emails today.
- Check runner state in smoke test
- Daily limit resets at midnight UK time

### Sequencer "stuck" / timeout

The sequencer now has:
- Heartbeat logs every 20s during Apify scraping
- Hard timeout (180s default)
- Clean error on timeout (task marked as FAILED)

If you see timeout, check:
- Apify API token is valid
- Apify actor ID is correct
- Network connectivity

## Secrets Required

These must be set in GitHub Secrets (Settings → Secrets and variables → Actions):

- GOOGLE_SHEETS_CREDENTIALS_JSON
- GOOGLE_SHEET_ID
- RESEND_API_KEY
- EMAIL_FROM
- EMAIL_FROM_NAME (optional)
- EMAIL_REPLY_TO (optional)
- OPENAI_API_KEY
- APIFY_API_TOKEN
- APIFY_ACTOR_ID
- SEND_ENABLED (must be "true" to send)
- DAILY_LIMIT (optional, defaults to 50)
- SEND_LIMIT_PER_RUN (optional, defaults to 10)
- DELAY_BETWEEN_SENDS (optional, defaults to 0.6)
- AUTO_APPROVE_ENABLED (optional)
- AUTO_APPROVE_MAX_PER_RUN (optional)
- CRON_TRIGGER_TOKEN (for external triggers)

## Schedule Verification

Scheduled workflows run at:
- **Lead Sequencer**: 09:00, 13:00, 18:00, 21:00 UK time (every day)
- **Email Sender**: 09:00, 11:00, 13:00, 15:00, 17:00 UK time (weekdays only)

If schedules aren't triggering:
1. Check GitHub Actions tab for recent runs
2. GitHub schedules can take 24-48h to activate
3. Use external cron trigger (see CRON_EXTERNAL_TRIGGER_SETUP.md)

## External Cron Setup

If GitHub schedules aren't reliable, use external cron:
- See: yapmate-leads/CRON_EXTERNAL_TRIGGER_SETUP.md
- Uses cron-job.org to trigger workflows via API
- Requires CRON_TRIGGER_TOKEN secret
