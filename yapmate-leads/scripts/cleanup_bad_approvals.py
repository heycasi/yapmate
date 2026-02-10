#!/usr/bin/env python3
"""
Cleanup script: Fix APPROVED leads that don't have valid emails.

This script finds all leads with status=APPROVED that would fail the full
auto_approve validation, and marks them as SKIPPED with a reason.

Run this ONCE to clean up bad data from previous weak approval logic.

Usage:
    python scripts/cleanup_bad_approvals.py --dry-run   # Preview changes
    python scripts/cleanup_bad_approvals.py             # Apply changes
"""

import os
import sys
import argparse

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.sequencer_sheets import SequencerSheetsManager
from src.auto_approve import check_auto_approval
from src.config import get_config


def main():
    parser = argparse.ArgumentParser(description="Cleanup bad APPROVED leads")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    args = parser.parse_args()

    print("=" * 70)
    print("CLEANUP: Bad APPROVED Leads")
    print("=" * 70)
    print(f"Mode: {'DRY RUN (preview only)' if args.dry_run else 'LIVE (will update sheet)'}")
    print()

    # Connect to sheets
    sheets = SequencerSheetsManager()

    # Get all leads
    print("Fetching all leads...")
    all_leads = sheets.get_all_leads()
    print(f"Total leads: {len(all_leads)}")

    # Find APPROVED leads
    approved_leads = [l for l in all_leads if (l.status or "").upper() == "APPROVED"]
    print(f"APPROVED leads: {len(approved_leads)}")

    # Check each APPROVED lead with full validation
    bad_leads = []
    good_leads = []

    config = get_config()
    sole_trader_mode = config.auto_approve.sole_trader_mode

    print("\nValidating APPROVED leads...")
    print(f"  Sole Trader Mode: {sole_trader_mode}")
    print("-" * 70)

    for lead in approved_leads:
        # Extract review count from raw_data if available
        review_count = None
        if hasattr(lead, 'raw_data') and lead.raw_data:
            review_count = lead.raw_data.get('reviewsCount') or lead.raw_data.get('totalScore')

        result = check_auto_approval(
            email=lead.email,
            website=getattr(lead, 'website', None),
            send_eligible=getattr(lead, 'send_eligible', False),
            business_name=lead.business_name,
            allow_free_emails=False,
            phone=getattr(lead, 'phone', None),
            review_count=review_count,
            sole_trader_mode=sole_trader_mode,
        )

        if result.approved:
            good_leads.append(lead)
        else:
            bad_leads.append({
                'lead': lead,
                'reason': result.reason,
                'checks_failed': result.checks_failed,
            })
            print(f"  BAD: {lead.business_name}")
            print(f"       Email: {lead.email or '(none)'}")
            print(f"       Reason: {result.reason}")

    print("-" * 70)
    print(f"\nSummary:")
    print(f"  Valid APPROVED leads: {len(good_leads)}")
    print(f"  Invalid APPROVED leads: {len(bad_leads)}")

    if not bad_leads:
        print("\nNo bad leads found. Nothing to clean up.")
        return

    # Fix bad leads
    if args.dry_run:
        print(f"\n[DRY RUN] Would mark {len(bad_leads)} leads as SKIPPED")
        print("\nBad leads that would be fixed:")
        for item in bad_leads[:10]:  # Show first 10
            print(f"  - {item['lead'].business_name}: {item['reason']}")
        if len(bad_leads) > 10:
            print(f"  ... and {len(bad_leads) - 10} more")
    else:
        print(f"\nMarking {len(bad_leads)} bad leads as SKIPPED...")

        # Batch update
        updates = []
        for item in bad_leads:
            updates.append({
                'lead_id': item['lead'].lead_id,
                'status': 'SKIPPED',
                'eligibility_reason': f"Cleanup: {item['reason']}",
            })

        try:
            updated = sheets.batch_update_leads(updates)
            print(f"Successfully updated {updated} leads")
        except Exception as e:
            print(f"Batch update failed: {e}")
            print("Falling back to individual updates...")

            import time
            updated = 0
            for i, update in enumerate(updates):
                try:
                    sheets.update_lead_status(
                        update['lead_id'],
                        update['status'],
                        eligibility_reason=update['eligibility_reason'],
                    )
                    updated += 1
                    if i < len(updates) - 1:
                        time.sleep(1.5)  # Rate limiting
                except Exception as inner_e:
                    print(f"  Failed: {update['lead_id']}: {inner_e}")

            print(f"Updated {updated} leads via fallback")

    print("\nDone!")


if __name__ == "__main__":
    main()
