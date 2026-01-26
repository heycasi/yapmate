# Google Sheet Schema Migration Report

## Schema Analysis

### Expected Schema (from `EnhancedLead.headers()`)
Total columns: **31**

1. lead_id
2. business_name
3. email
4. phone
5. website
6. trade
7. city
8. lead_source
9. place_id
10. source_url
11. **discovered_email** ⚠️ MISSING in CSV
12. **email_source** ⚠️ MISSING in CSV
13. **discovery_url** ⚠️ MISSING in CSV
14. ai_hook
15. enriched_at
16. send_eligible
17. eligibility_reason
18. generic_address
19. soft_match
20. soft_match_lead_id
21. status
22. created_at
23. updated_at
24. campaign_id
25. sent_at
26. opened_at
27. clicked_at
28. replied_at
29. bounced_at
30. complained_at
31. task_id

### Current CSV Schema
Total columns: **28** (plus many empty padding columns)

1. lead_id ✅
2. business_name ✅
3. email ✅
4. phone ✅
5. website ✅
6. trade ✅
7. city ✅
8. lead_source ✅
9. place_id ✅
10. source_url ✅
11. ai_hook ✅
12. enriched_at ✅
13. send_eligible ✅
14. eligibility_reason ✅
15. generic_address ✅
16. soft_match ✅
17. soft_match_lead_id ✅
18. status ✅
19. created_at ✅
20. updated_at ✅
21. campaign_id ✅
22. sent_at ✅
23. opened_at ✅
24. clicked_at ✅
25. replied_at ✅
26. bounced_at ✅
27. complained_at ✅
28. task_id ✅
29-100+ Empty/padding columns ❌

### Issues Detected

1. **Missing Columns** (will be added as empty):
   - `discovered_email` - Email found via website crawling
   - `email_source` - Source of email ("maps" | "website" | "none")
   - `discovery_url` - URL where email was found

2. **Column Order Mismatch**:
   - CSV has `ai_hook` and `enriched_at` before `send_eligible`
   - Expected schema has `discovered_email`, `email_source`, `discovery_url` between `source_url` and `ai_hook`

3. **Empty/Padding Columns**:
   - Many empty columns at the end (will be ignored during migration)

4. **Data Quality Issues**:
   - Some phone values are `#ERROR!` (will be cleaned to empty string)

### Migration Plan

1. ✅ Create new Google Sheet with correct 31-column schema
2. ✅ Map existing CSV columns to correct positions
3. ✅ Insert empty values for missing columns (`discovered_email`, `email_source`, `discovery_url`)
4. ✅ Clean `#ERROR!` values to empty strings
5. ✅ Migrate all valid data rows
6. ✅ Update `GOOGLE_SHEET_ID` in GitHub Secrets
7. ✅ Verify with `smoke_test.py`
8. ✅ Check eligibility breakdown

### Migration Script

Run:
```bash
cd yapmate-leads
python scripts/migrate_sheet_schema.py
```

The script will:
- Parse the CSV file
- Create a new Google Sheet with correct headers
- Migrate all data with proper column mapping
- Output the new sheet ID for updating secrets
