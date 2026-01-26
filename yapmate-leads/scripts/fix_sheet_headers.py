#!/usr/bin/env python3
"""
Fix Google Sheet headers to match expected schema.

This script adds missing columns to the leads tab, specifically resend_id
which should come after sent_at.

Usage:
    python scripts/fix_sheet_headers.py [--dry-run]
"""

import os
import sys
import argparse
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

from dotenv import load_dotenv
load_dotenv()

from src.sequencer_sheets import SequencerSheetsManager
from src.sequencer_models import EnhancedLead
import gspread

def main():
    parser = argparse.ArgumentParser(description="Fix Google Sheet headers")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without updating")
    args = parser.parse_args()
    
    print("=" * 70)
    print("FIX GOOGLE SHEET HEADERS")
    print("=" * 70)
    
    if args.dry_run:
        print("\n🧪 DRY RUN MODE - No changes will be made")
    
    # Connect to sheets
    try:
        sheets = SequencerSheetsManager()
    except Exception as e:
        print(f"ERROR: Failed to connect to Google Sheets: {e}")
        sys.exit(1)
    
    # Get expected headers
    expected_headers = EnhancedLead.headers()
    print(f"\nExpected headers ({len(expected_headers)} columns):")
    for i, header in enumerate(expected_headers, 1):
        print(f"  {i:2d}. {header}")
    
    # Get leads tab (bypass validation by accessing directly)
    try:
        # Get tab name
        tab_name = os.getenv("LEADS_SHEET_TAB", "leads")
        # Access worksheet directly to bypass validation
        leads_tab = sheets.spreadsheet.worksheet(tab_name)
        print(f"\nUsing tab: '{leads_tab.title}'")
    except gspread.exceptions.WorksheetNotFound:
        print(f"ERROR: Tab '{tab_name}' not found")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    # Read current headers
    all_rows = leads_tab.get_all_values()
    if len(all_rows) == 0:
        print("\n⚠️  Sheet is empty - will create headers")
        if not args.dry_run:
            leads_tab.update('A1', [expected_headers])
            print("✅ Created headers")
        else:
            print("🧪 DRY RUN - Would create headers")
        return
    
    current_headers = [h.strip() for h in all_rows[0]]
    print(f"\nCurrent headers ({len(current_headers)} columns):")
    for i, header in enumerate(current_headers, 1):
        print(f"  {i:2d}. {header}")
    
    # Find missing headers
    missing_headers = []
    for expected in expected_headers:
        if expected not in current_headers:
            missing_headers.append(expected)
    
    if not missing_headers:
        print("\n✅ All required headers are present!")
        return
    
    print(f"\n⚠️  Missing headers ({len(missing_headers)}):")
    for header in missing_headers:
        print(f"  - {header}")
    
    # Find where to insert missing headers
    insertions = []
    for missing_header in missing_headers:
        # Find position in expected headers
        expected_idx = expected_headers.index(missing_header)
        
        # Find the header that should come before it
        if expected_idx > 0:
            prev_header = expected_headers[expected_idx - 1]
            if prev_header in current_headers:
                insert_after_idx = current_headers.index(prev_header)
                insertions.append({
                    'header': missing_header,
                    'insert_after': prev_header,
                    'insert_at_col': insert_after_idx + 1,  # +1 because we insert after
                    'expected_idx': expected_idx
                })
            else:
                # Previous header also missing, insert at expected position
                insertions.append({
                    'header': missing_header,
                    'insert_after': None,
                    'insert_at_col': expected_idx,
                    'expected_idx': expected_idx
                })
        else:
            # Insert at beginning
            insertions.append({
                'header': missing_header,
                'insert_after': None,
                'insert_at_col': 0,
                'expected_idx': 0
            })
    
    # Sort insertions by column index (insert from right to left to preserve indices)
    insertions.sort(key=lambda x: x['insert_at_col'], reverse=True)
    
    print(f"\nWill insert columns:")
    for ins in insertions:
        if ins['insert_after']:
            print(f"  - {ins['header']} after {ins['insert_after']} (column {ins['insert_at_col'] + 1})")
        else:
            print(f"  - {ins['header']} at column {ins['insert_at_col'] + 1}")
    
    if args.dry_run:
        print("\n🧪 DRY RUN - Would insert these columns but not making changes")
        return
    
    # Read all current data once
    print(f"\nReading current data...")
    all_data = leads_tab.get_all_values()
    num_rows = len(all_data)
    print(f"  Found {num_rows} rows (including header)")
    
    # Build new data with all missing columns inserted (from right to left)
    print(f"\nBuilding updated data with inserted columns...")
    new_data = []
    for row in all_data:
        new_row = list(row)
        new_data.append(new_row)
    
    # Insert missing columns (from right to left to preserve indices)
    for ins in insertions:
        col_letter = gspread.utils.rowcol_to_a1(1, ins['insert_at_col'] + 1)[0]
        print(f"  Inserting '{ins['header']}' at column {ins['insert_at_col'] + 1} ({col_letter})")
        
        # Insert empty column in all rows
        for row in new_data:
            # Pad row if needed to reach insertion point
            while len(row) < ins['insert_at_col']:
                row.append('')
            # Insert empty cell
            row.insert(ins['insert_at_col'], '')
        
        # Set header name in first row
        if len(new_data) > 0:
            new_data[0][ins['insert_at_col']] = ins['header']
    
    # Write back all data (preserves existing data, just adds new columns)
    print(f"\nWriting updated data back to sheet...")
    num_cols = len(new_data[0]) if new_data else 0
    end_cell = gspread.utils.rowcol_to_a1(num_rows, num_cols)
    range_str = f"A1:{end_cell}"
    
    print(f"  Range: {range_str} ({num_rows} rows x {num_cols} columns)")
    
    # Update in one batch (gspread handles large updates efficiently)
    leads_tab.update(range_name=range_str, values=new_data, value_input_option="USER_ENTERED")
    
    print(f"    ✅ Inserted {len(insertions)} column(s) successfully")
    
    # Verify headers are now correct
    print(f"\nVerifying headers...")
    all_rows = leads_tab.get_all_values()
    current_headers = [h.strip() for h in all_rows[0]]
    
    still_missing = []
    for expected in expected_headers:
        if expected not in current_headers:
            still_missing.append(expected)
    
    if still_missing:
        print(f"⚠️  Still missing: {', '.join(still_missing)}")
        sys.exit(1)
    else:
        print(f"✅ All headers are now present!")
        print(f"   Total columns: {len(current_headers)}")
    
    print("\n" + "=" * 70)
    print("HEADER FIX COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
