#!/usr/bin/env python3
"""
Diagnostic script to analyze Google Sheet tabs and eligibility.

Usage:
    python scripts/diagnose_sheet.py
"""

import os
import sys
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
from src.email_sanitizer import sanitize_email

def main():
    print("=" * 70)
    print("GOOGLE SHEET DIAGNOSTIC")
    print("=" * 70)
    
    # Connect to sheets
    try:
        sheets = SequencerSheetsManager()
    except Exception as e:
        print(f"ERROR: Failed to connect to Google Sheets: {e}")
        sys.exit(1)
    
    # List all tabs
    print("\n" + "=" * 70)
    print("ALL WORKSHEET TABS")
    print("=" * 70)
    tabs_info = sheets.list_all_tabs()
    
    expected_tab_name = os.getenv("LEADS_SHEET_TAB", "leads")
    expected_headers = EnhancedLead.headers()
    
    print(f"\nExpected leads tab name: '{expected_tab_name}'")
    print(f"Expected headers ({len(expected_headers)} columns):")
    for i, header in enumerate(expected_headers, 1):
        print(f"  {i:2d}. {header}")
    
    print(f"\nFound {len(tabs_info)} tabs:")
    for tab in tabs_info:
        is_leads = tab["title"].lower() == expected_tab_name.lower()
        marker = " <-- EXPECTED" if is_leads else ""
        print(f"\n  Tab: '{tab['title']}'{marker}")
        print(f"    Rows: {tab['row_count']}")
        print(f"    Columns: {tab['col_count']}")
        if tab['headers']:
            print(f"    Headers ({len(tab['headers'])}): {', '.join(tab['headers'][:5])}...")
    
    # Analyze leads tab
    print("\n" + "=" * 70)
    print("LEADS TAB ANALYSIS")
    print("=" * 70)
    
    try:
        leads_tab = sheets.get_leads_tab()
        print(f"Using tab: '{leads_tab.title}'")
        
        all_leads = sheets.get_all_leads(limit=10000)
        print(f"Total leads: {len(all_leads)}")
        
        # Count by status
        status_counts = {}
        send_eligible_counts = {"true": 0, "false": 0, "empty": 0}
        approved_with_email = 0
        approved_with_email_and_eligible = 0
        
        for lead in all_leads:
            status = (lead.status or "UNKNOWN").upper()
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if lead.send_eligible:
                send_eligible_counts["true"] += 1
            elif lead.send_eligible is False:
                send_eligible_counts["false"] += 1
            else:
                send_eligible_counts["empty"] += 1
            
            if status == "APPROVED" and lead.email:
                approved_with_email += 1
                if lead.send_eligible:
                    approved_with_email_and_eligible += 1
        
        print(f"\nBy status:")
        for status in sorted(status_counts.keys()):
            print(f"  {status}: {status_counts[status]}")
        
        print(f"\nsend_eligible counts:")
        print(f"  True: {send_eligible_counts['true']}")
        print(f"  False: {send_eligible_counts['false']}")
        print(f"  Empty/None: {send_eligible_counts['empty']}")
        
        print(f"\nAPPROVED leads with email: {approved_with_email}")
        print(f"APPROVED leads with email AND send_eligible=True: {approved_with_email_and_eligible}")
        
        # Eligibility breakdown
        print("\n" + "=" * 70)
        print("ELIGIBILITY BREAKDOWN")
        print("=" * 70)
        
        eligible = sheets.get_eligible_leads(limit=10000)
        print(f"Eligible leads (status=APPROVED/NEW + email + send_eligible=True): {len(eligible)}")
        
        if len(eligible) == 0 and approved_with_email > 0:
            print("\n⚠️  ISSUE: APPROVED leads with email exist but none are eligible!")
            print("   This means send_eligible is False or empty for APPROVED leads.")
            print("   Solution: Run auto-approval or fix send_eligible values in sheet.")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print("\n" + "=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
