COMMANDS TO RUN

STEP 1: DIAGNOSE SHEET TABS
Run this to see all tabs and identify which one is correct:

cd yapmate-leads
source venv/bin/activate
python scripts/diagnose_sheet.py

This will show:
- All worksheet tabs in your Google Sheet
- Which tab is expected (based on LEADS_SHEET_TAB env var, default: "leads")
- Row counts and column counts for each tab
- Eligibility breakdown

STEP 2: FIX send_eligible FOR APPROVED LEADS
If diagnostic shows APPROVED leads with email but send_eligible=False, run:

python scripts/fix_send_eligible.py --dry-run

This shows what would be changed. To actually fix:

python scripts/fix_send_eligible.py

STEP 3: SET CORRECT TAB NAME (if needed)
If diagnostic shows the wrong tab is being used, set environment variable:

export LEADS_SHEET_TAB="correct_tab_name"

Or add to .env file:
LEADS_SHEET_TAB=correct_tab_name

STEP 4: COMMIT AND PUSH CHANGES
cd /Users/conzo/dev/yapmate
git add -A
git commit -m "Fix send_eligible gate and sheet tab confusion

- Make leads tab name configurable via LEADS_SHEET_TAB env var
- Add header validation and tab listing diagnostics
- Fix auto-approval to set send_eligible=True in sheet
- Add computed eligibility fallback for APPROVED leads
- Normalize status values (handle lowercase, boolean)
- Robust boolean parsing (TRUE/FALSE, Yes/No, 1/0)
- Add resend_id field for email tracking
- Add LIVE_SEND_TEST_MODE for safe testing
- Add diagnostic and fix scripts"

git push origin main

STEP 5: TRIGGER WORKFLOWS FOR TESTING

First, trigger Lead Sequencer to ensure leads are APPROVED:

gh workflow run "Lead Sequencer" --ref main -f skip_time_guard=true -f dry_run=false --repo heycasi/yapmate

Wait for it to complete, then trigger Email Sender with test mode:

gh workflow run "Email Sender" --ref main -f force_run=true -f dry_run=false -f send_limit=1 --repo heycasi/yapmate

Or with LIVE_SEND_TEST_MODE (sends exactly 1 email):

Add to GitHub Secrets:
LIVE_SEND_TEST_MODE=true

Then trigger:
gh workflow run "Email Sender" --ref main -f force_run=true -f dry_run=false --repo heycasi/yapmate

STEP 6: CHECK LOGS

Get the latest run ID:
gh run list --workflow="Email Sender" --limit 1 --repo heycasi/yapmate

View logs:
gh run view <RUN_ID> --log --repo heycasi/yapmate

Look for these key lines:
- "Eligible leads (status=APPROVED/NEW + email + send_eligible=True): <N>"
- "Resend email ID: <id>"
- "STATUS: SENT"
- "REASON: Email sent successfully (Resend ID: <id>)"

STEP 7: VERIFY IN RESEND DASHBOARD

1. Go to https://resend.com/emails
2. Find email with ID from logs
3. Verify delivery status

STEP 8: VERIFY IN GOOGLE SHEET

1. Open Google Sheet
2. Go to leads tab (or tab specified by LEADS_SHEET_TAB)
3. Find lead that was sent (look for status=SENT)
4. Verify:
   - status column = "SENT"
   - sent_at column = timestamp
   - resend_id column = Resend email ID from logs
   - updated_at column = timestamp

GITHUB SECRETS REQUIRED

SEND_ENABLED=true
RESEND_API_KEY=<your_resend_key>
GOOGLE_SHEET_ID=<your_sheet_id>
GOOGLE_SHEETS_CREDENTIALS_JSON=<your_credentials_json>
EMAIL_FROM=<your_from_email>
EMAIL_FROM_NAME=<your_from_name>
EMAIL_REPLY_TO=<your_reply_to>

Optional:
LEADS_SHEET_TAB=<tab_name> (default: "leads")
LIVE_SEND_TEST_MODE=true (for test mode - sends exactly 1 email)
AUTO_APPROVE_ENABLED=true (to enable auto-approval)

HOW TO CONFIRM EMAILS ARE SENDING

1. Check workflow logs for:
   - "Eligible leads: <N>" where N > 0
   - "Resend email ID: <id>"
   - "STATUS: SENT"

2. Check Resend dashboard:
   - Go to https://resend.com/emails
   - Find email with ID from logs
   - Status should be "delivered" or "sent"

3. Check Google Sheet:
   - Open leads tab
   - Find row with status="SENT"
   - sent_at column should have timestamp
   - resend_id column should have Resend email ID

WHAT SUCCESS LOOKS LIKE

- Workflow completes without errors
- Logs show "Eligible leads: 1" (or more)
- Logs show "Resend email ID: <id>"
- Logs show "STATUS: SENT"
- Resend dashboard shows email delivered
- Google Sheet row updated: status=SENT, sent_at=timestamp, resend_id=<id>
