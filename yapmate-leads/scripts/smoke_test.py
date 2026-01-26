#!/usr/bin/env python3
"""
Smoke test script for YapMate Lead Engine.

Quick verification that:
1. Google Sheets connection works
2. All required tabs exist
3. Counts of leads in various states

Usage:
    python scripts/smoke_test.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

from dotenv import load_dotenv
load_dotenv()


def main():
    """Run smoke tests."""
    print("=" * 60)
    print("YAPMATE LEAD ENGINE - SMOKE TEST")
    print("=" * 60)
    print(f"Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print()

    # Check environment variables
    print("1. Checking environment variables...")
    env_checks = {
        "GOOGLE_SHEETS_CREDENTIALS_JSON": bool(os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")),
        "GOOGLE_SHEET_ID": bool(os.getenv("GOOGLE_SHEET_ID")),
        "RESEND_API_KEY": bool(os.getenv("RESEND_API_KEY")),
        "APIFY_API_TOKEN": bool(os.getenv("APIFY_API_TOKEN")),
        "APIFY_ACTOR_ID": bool(os.getenv("APIFY_ACTOR_ID")),
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
    }

    for var, present in env_checks.items():
        status = "OK" if present else "MISSING"
        print(f"   {var}: {status}")

    missing = [k for k, v in env_checks.items() if not v]
    if missing:
        print(f"\n   WARNING: {len(missing)} environment variable(s) missing")
    print()

    # Connect to Google Sheets
    print("2. Connecting to Google Sheets...")
    try:
        from src.ci_helpers import setup_credentials_from_env
        setup_credentials_from_env()

        from src.sequencer_sheets import SequencerSheetsManager
        sheets = SequencerSheetsManager()
        print("   Connection: OK")
    except Exception as e:
        print(f"   Connection: FAILED - {e}")
        sys.exit(1)
    print()

    # Ensure all tabs exist
    print("3. Checking required tabs...")
    try:
        sheets.ensure_all_tabs()
        print("   All tabs: OK")
    except Exception as e:
        print(f"   Tab check: FAILED - {e}")
        sys.exit(1)
    print()

    # Get lead counts by status
    print("4. Lead counts by status...")
    try:
        all_leads = sheets.get_all_leads()
        status_counts = {}
        for lead in all_leads:
            status = lead.status or "UNKNOWN"
            status_counts[status] = status_counts.get(status, 0) + 1

        total = len(all_leads)
        print(f"   Total leads: {total}")
        for status in sorted(status_counts.keys()):
            count = status_counts[status]
            print(f"   {status}: {count}")
    except Exception as e:
        print(f"   Lead counts: FAILED - {e}")
    print()

    # Get eligible leads count with breakdown
    print("5. Eligible leads (ready to send)...")
    try:
        eligible = sheets.get_eligible_leads(limit=1000)
        print(f"   Eligible leads: {len(eligible)}")

        # Show breakdown if 0 eligible
        if len(eligible) == 0:
            print("\n   Eligibility breakdown:")
            try:
                all_leads = sheets.get_all_leads(limit=1000)
                status_counts = {}
                has_email_count = 0
                valid_email_count = 0

                from src.email_sanitizer import sanitize_email
                for lead in all_leads:
                    status = (lead.status or "UNKNOWN").upper()
                    status_counts[status] = status_counts.get(status, 0) + 1
                    if lead.email and lead.email.strip():
                        has_email_count += 1
                        if sanitize_email(lead.email).valid:
                            valid_email_count += 1

                print(f"     Total leads checked: {len(all_leads)}")
                print(f"     By status:")
                for status in sorted(status_counts.keys()):
                    print(f"       {status}: {status_counts[status]}")
                print(f"     Has email: {has_email_count}")
                print(f"     Valid email: {valid_email_count}")
            except Exception as e:
                print(f"     Breakdown failed: {e}")
    except Exception as e:
        print(f"   Eligible check: FAILED - {e}")
    print()

    # Get queue status
    print("6. Task queue status...")
    try:
        pending = sheets.get_pending_tasks(limit=100)
        print(f"   Pending tasks: {len(pending)}")
        if pending:
            # Show first few
            for task in pending[:3]:
                print(f"     - {task.trade} in {task.city} ({task.session.value})")
            if len(pending) > 3:
                print(f"     ... and {len(pending) - 3} more")
    except Exception as e:
        print(f"   Queue check: FAILED - {e}")
    print()

    # Get runner state
    print("7. Runner state...")
    try:
        state = sheets.get_runner_state()
        print(f"   Emails sent today: {state.emails_sent_today}")
        print(f"   Sending paused: {state.sending_paused}")
        if state.pause_reason:
            print(f"   Pause reason: {state.pause_reason}")
        print(f"   Focus trade: {state.focus_trade_id or 'None'}")
        print(f"   Focus date: {state.focus_trade_date or 'None'}")
    except Exception as e:
        print(f"   State check: FAILED - {e}")
    print()

    # Summary
    print("=" * 60)
    print("SMOKE TEST COMPLETE")
    print("=" * 60)

    # Return success
    return 0


if __name__ == "__main__":
    sys.exit(main())
