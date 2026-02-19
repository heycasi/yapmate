#!/usr/bin/env python3
"""
Follow-Up Email Sender for YapMate Leads Pipeline.

Sends follow-up emails to leads who were sent the initial email
but haven't converted:

- FOLLOW_UP_1: Sent 3 days after initial email (gentle nudge)
- FOLLOW_UP_2: Sent 7 days after initial email (value-add with blog CTA)

Usage:
    python scripts/send_followups.py              # Send due follow-ups
    python scripts/send_followups.py --dry-run     # Preview without sending
    python scripts/send_followups.py --status       # Show follow-up queue stats
"""

import os
import sys
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import resend
from src.config import get_config
from src.sequencer_sheets import SequencerSheetsManager
from src.email_sanitizer import sanitize_email
from src.templates import generate_followup1_content, generate_followup2_content, UNSUBSCRIBE_URL


# Follow-up timing (days after initial send)
FOLLOWUP_1_DELAY_DAYS = 3
FOLLOWUP_2_DELAY_DAYS = 7

# Limits
MAX_FOLLOWUPS_PER_RUN = 10
DELAY_BETWEEN_SENDS = 0.8  # seconds


def get_leads_needing_followup(sheets: SequencerSheetsManager):
    """
    Get leads that need follow-up emails.

    Returns:
        Dict with 'followup_1' and 'followup_2' lists of leads
    """
    all_rows = sheets.get_leads_tab().get_all_values()
    if not all_rows or len(all_rows) < 2:
        return {"followup_1": [], "followup_2": []}

    headers = all_rows[0]

    # Find column indices
    def col_idx(name):
        return headers.index(name) if name in headers else None

    idx_status = col_idx("status")
    idx_sent_at = col_idx("sent_at")
    idx_email = col_idx("email")
    idx_business = col_idx("business_name")
    idx_trade = col_idx("trade")
    idx_lead_id = col_idx("lead_id")
    idx_hook = col_idx("ai_hook")

    if idx_status is None or idx_sent_at is None:
        print("Missing required columns (status, sent_at)")
        return {"followup_1": [], "followup_2": []}

    now = datetime.utcnow()
    followup_1_leads = []
    followup_2_leads = []

    for row_num, row in enumerate(all_rows[1:], start=2):
        if len(row) <= max(filter(None, [idx_status, idx_sent_at, idx_email])):
            continue

        status = str(row[idx_status]).strip().upper()
        sent_at_str = str(row[idx_sent_at]).strip() if idx_sent_at and len(row) > idx_sent_at else ""

        if not sent_at_str:
            continue

        # Parse sent_at
        try:
            # Handle various date formats
            for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                try:
                    sent_at = datetime.strptime(sent_at_str[:26], fmt)
                    break
                except ValueError:
                    continue
            else:
                continue
        except Exception:
            continue

        days_since_sent = (now - sent_at).days

        lead_data = {
            "row_num": row_num,
            "lead_id": str(row[idx_lead_id]) if idx_lead_id and len(row) > idx_lead_id else "",
            "email": str(row[idx_email]) if idx_email and len(row) > idx_email else "",
            "business_name": str(row[idx_business]) if idx_business and len(row) > idx_business else "",
            "trade": str(row[idx_trade]) if idx_trade and len(row) > idx_trade else "",
            "sent_at": sent_at,
            "days_since_sent": days_since_sent,
        }

        # SENT leads that haven't had follow-up 1 yet (3+ days old)
        if status == "SENT" and days_since_sent >= FOLLOWUP_1_DELAY_DAYS:
            followup_1_leads.append(lead_data)

        # FOLLOW_UP_1 leads that haven't had follow-up 2 yet (7+ days since original send)
        elif status == "FOLLOW_UP_1" and days_since_sent >= FOLLOWUP_2_DELAY_DAYS:
            followup_2_leads.append(lead_data)

    return {"followup_1": followup_1_leads, "followup_2": followup_2_leads}


def send_followup(lead_data, followup_num, sheets, dry_run=False):
    """Send a single follow-up email."""
    config = get_config()
    email = lead_data["email"]
    business_name = lead_data["business_name"]
    trade = lead_data["trade"]
    lead_id = lead_data["lead_id"]

    # Validate email
    result = sanitize_email(email)
    if not result.valid:
        print(f"  ❌ Invalid email: {result.reason}")
        return False

    clean_email = result.sanitized

    # Generate content
    if followup_num == 1:
        subject, html_body, text_body = generate_followup1_content(business_name, trade=trade)
        new_status = "FOLLOW_UP_1"
    else:
        subject, html_body, text_body = generate_followup2_content(business_name, trade=trade)
        new_status = "FOLLOW_UP_2"

    if dry_run:
        print(f"  [DRY RUN] Would send follow-up {followup_num} to {clean_email}")
        print(f"  Subject: {subject}")
        return True

    # Send via Resend
    try:
        from_name = os.getenv("EMAIL_FROM_NAME", "Connor from YapMate")
        from_email = os.getenv("EMAIL_FROM", "support@yapmate.co.uk")
        reply_to = os.getenv("EMAIL_REPLY_TO", "support@yapmate.co.uk")

        params = {
            "from": f"{from_name} <{from_email}>",
            "to": [clean_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "reply_to": reply_to,
            "headers": {
                "List-Unsubscribe": f"<{UNSUBSCRIBE_URL}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        }

        response = resend.Emails.send(params)
        email_id = response.get("id", "unknown")
        print(f"  ✅ Sent (Resend ID: {email_id})")

        # Update status in sheet
        sheets.update_lead_status(
            lead_id,
            new_status,
            sent_at=datetime.utcnow(),
            resend_id=email_id,
        )

        return True

    except Exception as e:
        print(f"  ❌ Failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Send follow-up emails")
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending")
    parser.add_argument("--status", action="store_true", help="Show follow-up queue stats")
    parser.add_argument("--limit", type=int, default=MAX_FOLLOWUPS_PER_RUN, help="Max follow-ups to send")
    args = parser.parse_args()

    # Check SEND_ENABLED
    config = get_config()
    if not config.pipeline.send_enabled and not args.dry_run and not args.status:
        print("⚠️  SEND_ENABLED is not true — use --dry-run to preview")
        return

    # Init Resend
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        resend.api_key = resend_key

    # Connect to sheets
    print("Connecting to Google Sheets...")
    sheets = SequencerSheetsManager()
    sheets.ensure_all_tabs()

    # Get follow-up queue
    print("Scanning for leads needing follow-ups...")
    queue = get_leads_needing_followup(sheets)

    f1_count = len(queue["followup_1"])
    f2_count = len(queue["followup_2"])

    print(f"\n📊 Follow-up Queue:")
    print(f"  Follow-up 1 (3+ days, status=SENT): {f1_count} leads")
    print(f"  Follow-up 2 (7+ days, status=FOLLOW_UP_1): {f2_count} leads")

    if args.status:
        return

    if f1_count == 0 and f2_count == 0:
        print("\n✅ No follow-ups needed right now.")
        return

    # Send follow-up 1s first, then follow-up 2s
    sent = 0
    failed = 0

    for followup_num, key in [(1, "followup_1"), (2, "followup_2")]:
        leads = queue[key][:args.limit - sent]  # Respect total limit

        if not leads:
            continue

        print(f"\n{'='*50}")
        print(f"SENDING FOLLOW-UP {followup_num} ({len(leads)} leads)")
        print(f"{'='*50}")

        for lead in leads:
            if sent >= args.limit:
                print(f"\n⚠️  Hit per-run limit ({args.limit})")
                break

            print(f"\n[{sent+1}] {lead['business_name']} ({lead['email']})")
            print(f"    Sent {lead['days_since_sent']} days ago")

            success = send_followup(lead, followup_num, sheets, dry_run=args.dry_run)
            if success:
                sent += 1
            else:
                failed += 1

            if not args.dry_run:
                time.sleep(DELAY_BETWEEN_SENDS)

    print(f"\n{'='*50}")
    print(f"FOLLOW-UP SUMMARY")
    print(f"  Sent: {sent}")
    print(f"  Failed: {failed}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
