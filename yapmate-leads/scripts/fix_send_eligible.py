#!/usr/bin/env python3
"""
Fix send_eligible for APPROVED leads that have valid emails.

This script sets send_eligible=True for all APPROVED leads with valid emails.
Use this if auto-approval didn't set send_eligible correctly.

Usage:
    python scripts/fix_send_eligible.py [--dry-run]
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
from src.email_sanitizer import sanitize_email

def main():
    parser = argparse.ArgumentParser(description="Fix send_eligible for APPROVED leads")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without updating")
    args = parser.parse_args()
    
    print("=" * 70)
    print("FIX send_eligible FOR APPROVED LEADS")
    print("=" * 70)
    
    if args.dry_run:
        print("\n🧪 DRY RUN MODE - No changes will be made")
    
    # Connect to sheets
    try:
        sheets = SequencerSheetsManager()
    except Exception as e:
        print(f"ERROR: Failed to connect to Google Sheets: {e}")
        sys.exit(1)
    
    # Get all APPROVED leads
    approved_leads = sheets.get_leads_by_status("APPROVED", limit=10000)
    print(f"\nFound {len(approved_leads)} APPROVED leads")
    
    # Check which ones need fixing
    needs_fix = []
    for lead in approved_leads:
        has_email = bool(lead.email and lead.email.strip())
        if has_email:
            # Validate email
            sanitization = sanitize_email(lead.email)
            if sanitization.valid:
                # Check if send_eligible is False or missing
                if not lead.send_eligible:
                    needs_fix.append(lead)
    
    print(f"Leads that need send_eligible=True: {len(needs_fix)}")
    
    if len(needs_fix) == 0:
        print("\n✅ All APPROVED leads with valid emails already have send_eligible=True")
        return
    
    # Show what will be fixed
    print(f"\nWill update {len(needs_fix)} leads:")
    for i, lead in enumerate(needs_fix[:10], 1):
        print(f"  {i}. {lead.business_name} ({lead.email})")
    if len(needs_fix) > 10:
        print(f"  ... and {len(needs_fix) - 10} more")
    
    if args.dry_run:
        print("\n🧪 DRY RUN - Would update these leads but not making changes")
        return
    
    # Fix them
    print(f"\nUpdating {len(needs_fix)} leads...")
    updated = 0
    for lead in needs_fix:
        try:
            sheets.update_lead_status(
                lead.lead_id,
                "APPROVED",  # Keep status as APPROVED
                send_eligible=True
            )
            updated += 1
        except Exception as e:
            print(f"  ERROR updating {lead.lead_id}: {e}")
    
    print(f"\n✅ Updated {updated} leads with send_eligible=True")
    print("=" * 70)

if __name__ == "__main__":
    main()
