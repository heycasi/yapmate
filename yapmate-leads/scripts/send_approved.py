"""Send emails to approved leads via Resend API."""

import argparse
import os
import sys
import time
from pathlib import Path

# Add parent directory to path so we can import from src
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))

from dotenv import load_dotenv
import resend
from src.sheets_manager import SheetsManager
from src.templates import generate_email_html, generate_email_text, generate_email_subject
from src.notifications import notify_send_complete


def send_approved_leads(auto: bool = False, limit: int = None):
    """
    Send emails to APPROVED leads in Google Sheets.

    Args:
        auto: If True, skip confirmation prompt (for scheduled sends)
        limit: If set, only process first N APPROVED leads
    """

    # Load environment variables
    load_dotenv()

    print("=" * 80)
    print("YapMate Lead Email Sender")
    print("=" * 80)

    if auto:
        print("   Mode: AUTO (no confirmation)")
    if limit:
        print(f"   Limit: {limit} leads max")

    # Check required env vars
    resend_key = os.getenv("RESEND_API_KEY")
    image_url = os.getenv("EMAIL_FOOTER_IMAGE_URL")
    email_from = os.getenv("EMAIL_FROM", "noreply@yapmate.co.uk")
    email_from_name = os.getenv("EMAIL_FROM_NAME", "YapMate")

    if not resend_key:
        print("❌ ERROR: RESEND_API_KEY not found in .env")
        sys.exit(1)

    if not image_url or image_url == "":
        print("❌ ERROR: EMAIL_FOOTER_IMAGE_URL not configured")
        print("\nPlease run the image upload script first:")
        print("   python scripts/upload_image.py")
        sys.exit(1)

    # Initialize Resend
    resend.api_key = resend_key
    print(f"✅ Resend API configured")
    print(f"   From: {email_from_name} <{email_from}>")
    print(f"   Footer image: {image_url}\n")

    # Initialize Google Sheets
    print("📊 Connecting to Google Sheets...")
    try:
        sheets = SheetsManager(
            credentials_file=os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE"),
            sheet_id=os.getenv("GOOGLE_SHEETS_MASTER_SHEET_ID"),
            worksheet_name=os.getenv("GOOGLE_SHEETS_WORKSHEET_NAME")
        )
        print("✅ Connected to Google Sheets\n")
    except Exception as e:
        print(f"❌ Failed to connect to Google Sheets: {str(e)}")
        sys.exit(1)

    # Get all rows from sheet
    print("🔍 Finding APPROVED leads...")
    all_rows = sheets.sheet.get_all_values()

    if len(all_rows) < 2:
        print("❌ No data found in sheet (only headers or empty)")
        sys.exit(1)

    # Parse headers
    headers = all_rows[0]
    data_rows = all_rows[1:]

    # Find column indices
    try:
        col_business_name = headers.index("business_name")
        col_email = headers.index("email")
        col_trade = headers.index("trade")
        col_city = headers.index("city")
        col_ai_hook = headers.index("ai_hook")
        col_status = headers.index("status")
    except ValueError as e:
        print(f"❌ Missing required column: {str(e)}")
        sys.exit(1)

    # Find APPROVED leads
    approved_leads = []
    for idx, row in enumerate(data_rows, start=2):  # Start at 2 (row 1 is header)
        if len(row) > col_status and row[col_status].strip().upper() == "APPROVED":
            lead = {
                "row_number": idx,
                "business_name": row[col_business_name],
                "email": row[col_email],
                "trade": row[col_trade],
                "city": row[col_city],
                "ai_hook": row[col_ai_hook]
            }
            approved_leads.append(lead)

    if not approved_leads:
        print("ℹ️  No APPROVED leads found")
        print("   (Set status to 'APPROVED' in Google Sheets to send)")
        sys.exit(0)

    total_approved = len(approved_leads)
    print(f"✅ Found {total_approved} APPROVED leads")

    # Apply limit if set
    if limit and limit < len(approved_leads):
        approved_leads = approved_leads[:limit]
        print(f"   (Limited to first {limit})\n")
    else:
        print()

    leads_to_process = len(approved_leads)

    # Confirmation (skip if auto mode)
    if not auto:
        print("=" * 80)
        print("PREVIEW")
        print("=" * 80)
        for i, lead in enumerate(approved_leads[:3], 1):
            print(f"{i}. {lead['business_name']} <{lead['email']}>")
            print(f"   Hook: {lead['ai_hook'][:60]}...")
            print()

        if leads_to_process > 3:
            print(f"   ... and {leads_to_process - 3} more\n")

        print("=" * 80)
        confirm = input(f"\nSend {leads_to_process} emails? [y/N]: ").strip().lower()
        if confirm != 'y':
            print("❌ Sending cancelled")
            sys.exit(0)

    # Send emails
    print("\n" + "=" * 80)
    print("SENDING EMAILS")
    print("=" * 80)

    sent_count = 0
    failed_count = 0

    for i, lead in enumerate(approved_leads, 1):
        business_name = lead["business_name"]
        email = lead["email"]
        trade = lead["trade"]
        hook = lead["ai_hook"]
        row_number = lead["row_number"]

        print(f"\n[{i}/{leads_to_process}] {business_name} <{email}>")

        # Generate email content (HTML + plain text for deliverability)
        html_content = generate_email_html(
            business_name=business_name,
            hook=hook,
            trade=trade,
            image_url=image_url
        )

        text_content = generate_email_text(
            business_name=business_name,
            hook=hook,
            trade=trade
        )

        subject = generate_email_subject(business_name, trade)

        # Send via Resend with multipart (HTML + text) and List-Unsubscribe headers
        try:
            params = {
                "from": f"{email_from_name} <{email_from}>",
                "to": [email],
                "subject": subject,
                "html": html_content,
                "text": text_content,
                "headers": {
                    "List-Unsubscribe": "<https://www.yapmate.co.uk/unsubscribe>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                }
            }

            response = resend.Emails.send(params)
            print(f"   ✅ Sent (ID: {response.get('id', 'unknown')})")
            sent_count += 1

            # Update status to SENT in Google Sheets
            try:
                sheets.sheet.update_cell(row_number, col_status + 1, "SENT")
                print(f"   ✅ Updated status to SENT")
            except Exception as e:
                print(f"   ⚠️  Failed to update status: {str(e)}")

            # Rate limiting (Resend has limits)
            time.sleep(0.5)

        except Exception as e:
            print(f"   ❌ Failed: {str(e)}")
            failed_count += 1

            # Update status to FAILED
            try:
                sheets.sheet.update_cell(row_number, col_status + 1, "FAILED")
            except:
                pass

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"✅ Sent: {sent_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"📊 Total: {leads_to_process}")
    print("=" * 80)

    # Send notification (non-blocking)
    notify_send_complete(
        total_processed=leads_to_process,
        sent=sent_count,
        failed=failed_count
    )

    # Return counts for programmatic use
    return {
        "total_approved": total_approved,
        "processed": leads_to_process,
        "sent": sent_count,
        "failed": failed_count
    }


def main():
    """CLI entry point with argparse."""
    parser = argparse.ArgumentParser(
        description="Send emails to APPROVED leads in Google Sheets"
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        default=False,
        help="Skip confirmation prompt (for scheduled/automated sends)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of APPROVED leads to process"
    )
    args = parser.parse_args()

    send_approved_leads(auto=args.auto, limit=args.limit)


if __name__ == "__main__":
    main()
