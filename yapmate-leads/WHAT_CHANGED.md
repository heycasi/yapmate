WHAT CHANGED

1. SHEET TAB CONFUSION FIXED
   - Tab name is now configurable via LEADS_SHEET_TAB environment variable
   - Default is "leads" (lowercase)
   - Added diagnostic script to list all tabs and identify correct one
   - Added header validation: fails clearly if required columns missing
   - Error messages show available tabs if configured tab is missing

2. send_eligible GATE FIXED
   - Auto-approval now sets send_eligible=True in Google Sheet (was only setting status)
   - Added computed eligibility fallback: if status=APPROVED and email is valid, treat as eligible even if send_eligible column is False/empty
   - Robust boolean parsing: handles TRUE/FALSE, true/false, Yes/No, 1/0, strips whitespace
   - update_lead_status() now accepts send_eligible parameter

3. STATUS NORMALIZATION
   - Status values normalized on read: "approved" -> "APPROVED", "new" -> "NEW"
   - Handles boolean status values: TRUE -> APPROVED, FALSE -> NEW (with warning)
   - Status comparison is case-insensitive but stores normalized uppercase

4. RESEND ID TRACKING
   - Added resend_id field to EnhancedLead model
   - Resend email ID is now saved to Google Sheet when email is sent
   - Can track emails in Resend dashboard using this ID

5. TEST MODE
   - Added LIVE_SEND_TEST_MODE environment variable
   - When enabled, sends exactly 1 email (safe for testing)
   - Logs lead identifier for verification

6. DIAGNOSTIC TOOLS
   - scripts/diagnose_sheet.py: Lists all tabs, shows eligibility breakdown
   - scripts/fix_send_eligible.py: Fixes send_eligible for APPROVED leads

WHAT I SHOULD DO NOW

1. Run diagnostic to see current state:
   cd yapmate-leads
   source venv/bin/activate
   python scripts/diagnose_sheet.py

2. If diagnostic shows APPROVED leads with send_eligible=False, fix them:
   python scripts/fix_send_eligible.py

3. If wrong tab is being used, set LEADS_SHEET_TAB in .env or GitHub Secrets:
   LEADS_SHEET_TAB=correct_tab_name

4. Trigger Email Sender workflow with test mode:
   gh workflow run "Email Sender" --ref main -f force_run=true -f dry_run=false -f send_limit=1 --repo heycasi/yapmate

5. Check logs for success:
   gh run list --workflow="Email Sender" --limit 1 --repo heycasi/yapmate
   gh run view <RUN_ID> --log --repo heycasi/yapmate

WHAT SUCCESS LOOKS LIKE

- Logs show "Eligible leads: 1" (or more, not 0)
- Logs show "Resend email ID: <id>"
- Logs show "STATUS: SENT"
- Logs show "REASON: Email sent successfully (Resend ID: <id>)"
- Resend dashboard shows email with that ID as "delivered" or "sent"
- Google Sheet row shows: status=SENT, sent_at=timestamp, resend_id=<id>

REMAINING RISKS

1. If there are truly two leads tabs with data, you may need to:
   - Identify which one has the correct data
   - Set LEADS_SHEET_TAB to that tab name
   - Or merge/delete the duplicate tab manually

2. If auto-approval is disabled (AUTO_APPROVE_ENABLED=false), leads will stay as NEW
   - Either enable auto-approval or manually approve leads in sheet
   - Or run fix_send_eligible.py to set send_eligible=True for APPROVED leads

3. If leads have invalid emails, they won't be eligible
   - Check eligibility breakdown in logs for reasons
   - Invalid emails are marked as INVALID status

4. Daily limit may block sends if already reached
   - Check "Remaining quota" in logs
   - Use force_run=true to bypass pause flags but not daily limits
