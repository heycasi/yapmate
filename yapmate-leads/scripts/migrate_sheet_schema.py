#!/usr/bin/env python3
"""
Migrate Google Sheet schema to match expected EnhancedLead structure.

This script:
1. Reads the current CSV export
2. Maps columns to expected schema
3. Creates a new Google Sheet with correct headers
4. Migrates all valid data
5. Outputs the new sheet ID for updating secrets
"""

import os
import sys
import csv
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

# Add project root to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

from dotenv import load_dotenv
load_dotenv()

from src.ci_helpers import setup_credentials_from_env
from src.sequencer_models import EnhancedLead
from src.sequencer_sheets import SequencerSheetsManager
import gspread
from google.oauth2.service_account import Credentials


# Expected schema (from EnhancedLead.headers())
EXPECTED_HEADERS = EnhancedLead.headers()

# Column mapping from CSV to expected schema
# CSV column name -> expected column index
CSV_COLUMN_MAP = {
    "lead_id": "lead_id",
    "business_name": "business_name",
    "email": "email",
    "phone": "phone",
    "website": "website",
    "trade": "trade",
    "city": "city",
    "lead_source": "lead_source",
    "place_id": "place_id",
    "source_url": "source_url",
    "ai_hook": "ai_hook",
    "enriched_at": "enriched_at",
    "send_eligible": "send_eligible",
    "eligibility_reason": "eligibility_reason",
    "generic_address": "generic_address",
    "soft_match": "soft_match",
    "soft_match_lead_id": "soft_match_lead_id",
    "status": "status",
    "created_at": "created_at",
    "updated_at": "updated_at",
    "campaign_id": "campaign_id",
    "sent_at": "sent_at",
    "opened_at": "opened_at",
    "clicked_at": "clicked_at",
    "replied_at": "replied_at",
    "bounced_at": "bounced_at",
    "complained_at": "complained_at",
    "task_id": "task_id",
    # Missing columns (will be empty):
    # discovered_email, email_source, discovery_url
}


def parse_csv(csv_path: str) -> tuple[List[str], List[List[Any]]]:
    """Parse CSV file and return headers and rows."""
    headers = []
    rows = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Find where actual data ends (skip empty padding columns)
        for row in reader:
            # Stop if row is completely empty or only has empty values
            if not any(cell.strip() for cell in row if cell):
                break
            rows.append(row)
    
    return headers, rows


def map_row_to_expected(csv_headers: List[str], csv_row: List[Any]) -> List[Any]:
    """Map a CSV row to expected schema order."""
    # Create mapping: csv_header -> csv_index
    csv_header_to_index = {h: i for i, h in enumerate(csv_headers)}
    
    # Create mapping: expected_header -> csv_index (or None if missing)
    expected_to_csv_index = {}
    for expected_header in EXPECTED_HEADERS:
        csv_header = CSV_COLUMN_MAP.get(expected_header)
        if csv_header and csv_header in csv_header_to_index:
            expected_to_csv_index[expected_header] = csv_header_to_index[csv_header]
        else:
            expected_to_csv_index[expected_header] = None
    
    # Build row in expected order
    mapped_row = []
    for expected_header in EXPECTED_HEADERS:
        csv_index = expected_to_csv_index[expected_header]
        if csv_index is not None and csv_index < len(csv_row):
            value = csv_row[csv_index]
            # Clean up values
            if value == "#ERROR!":
                value = ""
            elif isinstance(value, str):
                value = value.strip()
            mapped_row.append(value)
        else:
            # Missing column - use default
            mapped_row.append("")
    
    return mapped_row


def fix_existing_sheet(sheets_manager: SequencerSheetsManager) -> str:
    """Fix schema in existing sheet by creating a new 'leads_migrated' tab."""
    print(f"\nFixing schema in existing sheet...")
    
    spreadsheet = sheets_manager.spreadsheet
    sheet_id = spreadsheet.id
    
    # Create backup of current leads tab
    try:
        old_worksheet = spreadsheet.worksheet("leads")
        backup_title = f"leads_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        print(f"  Creating backup: {backup_title}")
        old_worksheet.duplicate(new_sheet_name=backup_title)
    except Exception as e:
        print(f"  Warning: Could not create backup: {e}")
    
    # Create new leads tab with correct schema
    try:
        # Delete old leads tab if it exists (after backup)
        try:
            worksheet = spreadsheet.worksheet("leads")
            spreadsheet.del_worksheet(worksheet)
        except:
            pass
        
        # Create new leads tab with correct headers
        worksheet = spreadsheet.add_worksheet(title="leads", rows=1, cols=len(EXPECTED_HEADERS))
        worksheet.append_row(EXPECTED_HEADERS)
        print(f"  Created new 'leads' tab with {len(EXPECTED_HEADERS)} columns")
    except Exception as e:
        print(f"  Error creating leads tab: {e}")
        raise
    
    print(f"  Sheet ID: {sheet_id}")
    print(f"  URL: https://docs.google.com/spreadsheets/d/{sheet_id}")
    
    return sheet_id


def migrate_data(sheets_manager: SequencerSheetsManager, csv_path: str, new_sheet_id: str):
    """Migrate data from CSV to new sheet."""
    print(f"\nMigrating data from {csv_path}...")
    
    # Parse CSV
    csv_headers, csv_rows = parse_csv(csv_path)
    print(f"  Found {len(csv_rows)} rows in CSV")
    print(f"  CSV has {len(csv_headers)} columns")
    print(f"  Expected schema has {len(EXPECTED_HEADERS)} columns")
    
    # Detect issues
    print(f"\n  Column Analysis:")
    missing_cols = []
    extra_cols = []
    
    for expected in EXPECTED_HEADERS:
        csv_col = CSV_COLUMN_MAP.get(expected)
        if csv_col and csv_col not in csv_headers:
            missing_cols.append(expected)
    
    for csv_col in csv_headers:
        if csv_col and csv_col.strip() and csv_col not in CSV_COLUMN_MAP.values():
            # Check if it's an empty/padding column
            if not csv_col.startswith("Unnamed") and csv_col.strip():
                extra_cols.append(csv_col)
    
    if missing_cols:
        print(f"    Missing columns (will be empty): {', '.join(missing_cols)}")
    if extra_cols:
        print(f"    Extra columns (will be ignored): {', '.join(extra_cols[:10])}{'...' if len(extra_cols) > 10 else ''}")
    
    # Open new sheet
    spreadsheet = sheets_manager.client.open_by_key(new_sheet_id)
    worksheet = spreadsheet.worksheet("leads")
    
    # Migrate rows in batches
    batch_size = 100
    migrated_count = 0
    error_count = 0
    
    print(f"\n  Migrating rows...")
    for i in range(0, len(csv_rows), batch_size):
        batch = csv_rows[i:i+batch_size]
        mapped_batch = []
        
        for csv_row in batch:
            try:
                mapped_row = map_row_to_expected(csv_headers, csv_row)
                mapped_batch.append(mapped_row)
            except Exception as e:
                error_count += 1
                print(f"    Error mapping row {i + len(mapped_batch)}: {e}")
                continue
        
        if mapped_batch:
            try:
                worksheet.append_rows(mapped_batch, value_input_option="USER_ENTERED")
                migrated_count += len(mapped_batch)
                print(f"    Migrated {migrated_count}/{len(csv_rows)} rows...", end='\r')
            except Exception as e:
                error_count += len(mapped_batch)
                print(f"\n    Error appending batch: {e}")
    
    print(f"\n  Migration complete:")
    print(f"    Migrated: {migrated_count}")
    print(f"    Errors: {error_count}")
    
    return migrated_count, error_count


def main():
    """Main migration function."""
    print("=" * 70)
    print("YAPMATE SHEET SCHEMA MIGRATION")
    print("=" * 70)
    
    # Check for CSV file
    csv_path = os.getenv("CSV_PATH", "/Users/conzo/Downloads/YapMate Leads - leads.csv")
    if not os.path.exists(csv_path):
        print(f"\nERROR: CSV file not found at: {csv_path}")
        print("Set CSV_PATH environment variable to specify CSV location")
        sys.exit(1)
    
    print(f"\nCSV file: {csv_path}")
    
    # Setup credentials
    setup_credentials_from_env()
    sheets_manager = SequencerSheetsManager()
    
    # Fix existing sheet (creates backup and new leads tab)
    sheet_id = fix_existing_sheet(sheets_manager)
    
    # Migrate data
    migrated_count, error_count = migrate_data(sheets_manager, csv_path, sheet_id)
    
    # Output results
    print("\n" + "=" * 70)
    print("MIGRATION COMPLETE")
    print("=" * 70)
    print(f"\nSheet ID: {sheet_id}")
    print(f"URL: https://docs.google.com/spreadsheets/d/{sheet_id}")
    print(f"\nNext steps:")
    print(f"1. Verify the migrated data in the 'leads' tab")
    print(f"2. Run smoke_test.py to verify")
    print(f"3. Check eligibility breakdown")
    print(f"4. Delete backup tab if migration looks good")
    
    return sheet_id


if __name__ == "__main__":
    try:
        sheet_id = main()
        sys.exit(0)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
