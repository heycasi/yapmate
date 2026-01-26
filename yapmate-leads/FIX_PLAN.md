PLAN TO FIX EMAIL SENDER AND SHEET CONFUSION

STEP 1: DIAGNOSE SHEET TAB CONFUSION
- Add diagnostic script to list all worksheet tabs
- Identify which tab has correct 31-column schema
- Identify which tab has most rows
- Make tab name configurable via LEADS_SHEET_TAB env var (default: "leads")
- Add safety check: fail if configured tab missing, list available tabs
- Add header validation: fail if required columns missing

STEP 2: FIX send_eligible GATE
- Problem: auto_approve updates status but NOT send_eligible in sheet
- Fix: Update update_lead_status() to accept send_eligible parameter
- Fix: When auto-approving, set send_eligible=True in sheet
- Fix: Make boolean parsing robust (TRUE/FALSE, true/false, Yes/No, 1/0, strip whitespace)
- Fix: Add computed eligibility fallback - if status=APPROVED and email valid, treat as eligible even if send_eligible column is False/empty

STEP 3: FIX STATUS NORMALIZATION
- Normalize status values on read: "approved" -> "APPROVED", "new" -> "NEW"
- Handle boolean status values: TRUE -> APPROVED, FALSE -> NEW (log warning)
- Make status comparison case-insensitive but store normalized

STEP 4: ADD DIAGNOSTIC SCRIPT
- Script to list all tabs, row counts, header validation
- Script to show eligibility breakdown with detailed reasons
- Script to fix send_eligible for APPROVED leads

STEP 5: TEST REAL SEND
- Add LIVE_SEND_TEST_MODE env var
- When enabled, send exactly 1 email to first eligible lead
- Log Resend ID and update sheet with resend_id field
- Print lead identifier for verification

CHECKLIST AFTER EACH STEP

After Step 1:
- [ ] Diagnostic script lists all tabs correctly
- [ ] Code uses correct tab name (configurable)
- [ ] Error message shows available tabs if configured tab missing
- [ ] Header validation fails clearly if columns missing

After Step 2:
- [ ] update_lead_status() accepts send_eligible parameter
- [ ] Auto-approval sets send_eligible=True in sheet
- [ ] Boolean parsing handles TRUE/FALSE/Yes/No/1/0
- [ ] Computed eligibility works as fallback
- [ ] Eligibility breakdown shows send_eligible counts correctly

After Step 3:
- [ ] Status normalization works (lowercase -> uppercase)
- [ ] Boolean status values handled safely
- [ ] Status comparison is case-insensitive

After Step 4:
- [ ] Diagnostic script runs successfully
- [ ] Shows tab confusion clearly
- [ ] Shows eligibility breakdown with reasons

After Step 5:
- [ ] Test mode sends exactly 1 email
- [ ] Resend ID logged and saved to sheet
- [ ] Lead identifier printed for verification
