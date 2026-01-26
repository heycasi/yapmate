EXACT COMMANDS TO RUN

STEP 1: FIX SHEET HEADERS (if not already done)
cd /Users/conzo/dev/yapmate/yapmate-leads
source venv/bin/activate
python scripts/fix_sheet_headers.py

Expected output:
- Shows missing column: resend_id
- Inserts column after sent_at
- Verifies all headers are present

STEP 2: VERIFY DIAGNOSTIC WORKS
python scripts/diagnose_sheet.py

Expected output:
- Shows all tabs (including leads_backup_20260126_112821)
- Shows leads tab has 32 columns (including resend_id)
- Shows eligible leads count > 0

STEP 3: COMMIT AND PUSH (already done)
cd /Users/conzo/dev/yapmate
git add -A
git commit -m "Fix _normalize_status call in EnhancedLead.from_sheets_row"
git push origin main

Commit hash: <will be shown after push>

STEP 4: TRIGGER EMAIL SENDER WORKFLOW
gh workflow run "Email Sender" --ref main -f force_run=true -f dry_run=false -f send_limit=1 --repo heycasi/yapmate

STEP 5: GET RUN ID AND CHECK LOGS
gh run list --workflow="Email Sender" --limit 1 --repo heycasi/yapmate

Copy the run ID from the output, then:
gh run view <RUN_ID> --log --repo heycasi/yapmate

WHAT TO CHECK IN LOGS

Look for these key lines:

1. Gate checks:
   SEND_ALLOWED: True
   EFFECTIVE MODE: LIVE SEND

2. Eligibility breakdown:
   Total leads: <N> (should be > 0)
   By status:
     APPROVED: <N>
   send_eligible = True: <N>
   Final eligible: <N> (should be > 0)

3. Processing:
   Found <N> eligible leads (should be > 0)
   [1/1] <Business Name>
   Lead ID: <id>...
   Email: <email>
   Status: APPROVED

4. Success:
   ✓ Resend email ID: <id>
   STATUS: SENT
   REASON: Email sent successfully (Resend ID: <id>)

5. Summary:
   SENT: 1
   Total processed: 1

VERIFY IN RESEND DASHBOARD

1. Go to https://resend.com/emails
2. Find email with ID from logs
3. Status should be "delivered" or "sent"

VERIFY IN GOOGLE SHEET

1. Open Google Sheet
2. Go to leads tab
3. Find row with status=SENT
4. Check:
   - status column = "SENT"
   - sent_at column = timestamp
   - resend_id column = Resend email ID from logs
   - updated_at column = timestamp

GITHUB SECRETS REQUIRED

SEND_ENABLED=true
RESEND_API_KEY=<your_resend_key>
GOOGLE_SHEET_ID=1vtrw0-6cvNYhGtzRgm1M4BfpxpTEP3Hrrdqx2GbNfK4
GOOGLE_SHEETS_CREDENTIALS_JSON=<your_credentials_json>
EMAIL_FROM=<your_from_email>
EMAIL_FROM_NAME=<your_from_name>
EMAIL_REPLY_TO=<your_reply_to>

Optional:
LEADS_SHEET_TAB=leads (default, can override if needed)
AUTO_APPROVE_ENABLED=true (to enable auto-approval)
