# Header System Fix - Summary

## What Was Wrong

Your Google Sheet headers weren't matching what the scripts expected. This happened because:

1. **Multiple definitions**: Headers were defined separately in different files
2. **No validation**: When `src/main.py` appended data to an empty sheet, it didn't create headers first
3. **Inconsistent order**: Different scripts expected columns in different orders

## What I Fixed

### 1. Created Centralized Header Definition

**File:** `config/headers.py`

This file now contains:
- `SHEET_HEADERS` - The single source of truth for all column names
- Column index constants (`COL_BUSINESS_NAME`, `COL_EMAIL`, etc.)
- `validate_headers()` - Function to check if headers are correct
- `get_column_index()` - Safe column lookup with error handling

### 2. Updated All Scripts

**Updated files:**
- `scripts/send_approved.py` - Now imports from `config/headers`
- `scripts/finish_setup.py` - Now imports from `config/headers`
- `src/sheets_manager.py` - Now validates headers on init, creates if missing

### 3. Created Fix Tool

**File:** `scripts/fix_headers.py`

Run this to fix your current sheet:

```bash
python3 scripts/fix_headers.py
```

This script will:
- ✅ Check current headers in your sheet
- ✅ Show what's wrong
- ✅ Offer to fix automatically
- ✅ Preserve all your data (only changes row 1)

## Expected Header Order

The correct headers (in order) are:

1. `timestamp`
2. `business_name`
3. `contact_name`
4. `email`
5. `phone`
6. `website`
7. `trade`
8. `city`
9. `ai_hook`
10. `lead_source`
11. `status`

## How to Fix Your Sheet

### Option 1: Use the Fix Tool (Recommended)

```bash
python3 scripts/fix_headers.py
```

This will:
- Show current vs. expected headers
- Ask for confirmation
- Fix headers while preserving all data

### Option 2: Manual Fix via send_approved.py

```bash
python3 scripts/send_approved.py
```

When it detects wrong headers, it will ask:
```
Fix headers now? [y/N]:
```

Type `y` and press Enter.

### Option 3: Manual Edit in Google Sheets

1. Open your Google Sheet
2. Delete row 1 (current headers)
3. Insert these headers in row 1 (A1 to K1):
   ```
   timestamp | business_name | contact_name | email | phone | website | trade | city | ai_hook | lead_source | status
   ```

## Testing the Fix

After fixing headers, test with:

```bash
# Should work without errors now
python3 scripts/send_approved.py
```

You should see:
```
🔍 Checking sheet headers...
✅ Headers verified
```

## Why This Won't Happen Again

1. **Single source of truth**: All scripts import from `config/headers.py`
2. **Auto-validation**: `SheetsManager` checks headers when initialized
3. **Auto-creation**: Empty sheets get headers automatically
4. **Better error messages**: Scripts now show exactly what's wrong and how to fix

## Files Changed

```
NEW:
  config/headers.py              ← Centralized header definitions
  scripts/fix_headers.py         ← Tool to fix your sheet

UPDATED:
  scripts/send_approved.py       ← Uses config/headers
  scripts/finish_setup.py        ← Uses config/headers
  src/sheets_manager.py          ← Auto-validates headers on init
```

## Next Steps

1. **Fix your sheet**: Run `python3 scripts/fix_headers.py`
2. **Test**: Run `python3 scripts/send_approved.py` (should work now)
3. **Continue**: Your workflow should work normally from here

---

**The Problem:** Different scripts had different header expectations
**The Solution:** Single source of truth in `config/headers.py`
**Your Action:** Run `python3 scripts/fix_headers.py` to fix your sheet
