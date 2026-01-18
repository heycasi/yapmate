"""Cleanup script: mark APPROVED rows with blank email as REJECTED_NO_EMAIL."""

import os
import sys
from pathlib import Path

# Add parent directory to path so we can import from src
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))

from dotenv import load_dotenv
from src.sheets_manager import SheetsManager


def main():
    """Find APPROVED rows with blank email and update to REJECTED_NO_EMAIL."""
    # Change to project directory for credentials.json
    os.chdir(project_dir)
    load_dotenv()

    print("=" * 60)
    print("CLEANUP: APPROVED rows with missing email")
    print("=" * 60)

    try:
        sheets = SheetsManager()
    except Exception as e:
        print(f"❌ Failed to connect to Google Sheets: {e}")
        sys.exit(1)

    # Get headers
    headers = sheets.sheet.row_values(1)

    # Check required columns exist
    if "status" not in headers:
        print("❌ 'status' column not found in sheet")
        sys.exit(1)
    if "email" not in headers:
        print("❌ 'email' column not found in sheet")
        sys.exit(1)

    status_col = headers.index("status") + 1
    email_col = headers.index("email") + 1

    print(f"   Status column: {status_col}")
    print(f"   Email column: {email_col}")
    print()

    # Get all data rows
    all_rows = sheets.sheet.get_all_records()
    print(f"   Total rows: {len(all_rows)}")

    updated = 0
    for i, row in enumerate(all_rows):
        status = str(row.get("status", "")).strip().upper()
        email = str(row.get("email", "")).strip()

        # Sheet row number: +2 (header row + 0-index)
        sheet_row = i + 2

        # If APPROVED but email missing -> set to REJECTED_NO_EMAIL
        if status == "APPROVED" and not email:
            try:
                sheets.sheet.update_cell(sheet_row, status_col, "REJECTED_NO_EMAIL")
                business = row.get("business_name", "Unknown")[:30]
                print(f"   Row {sheet_row}: {business} -> REJECTED_NO_EMAIL")
                updated += 1
            except Exception as e:
                print(f"   ⚠️ Failed to update row {sheet_row}: {e}")

    print()
    print("=" * 60)
    print(f"✅ Updated {updated} rows: APPROVED -> REJECTED_NO_EMAIL")
    print("=" * 60)


if __name__ == "__main__":
    main()
