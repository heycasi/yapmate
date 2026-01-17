"""Send emails to approved leads via Resend API."""

import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
import resend
from src.sheets_manager import SheetsManager
from src.templates import generate_email_html, generate_email_text, generate_email_subject


def send_approved_leads():
    """Send emails to all APPROVED leads in Google Sheets"""

    # Load environment variables
    load_dotenv()

    print("=" * 80)
    print("YapMate Lead Email Sender")
    print("=" * 80)

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
    all_rows = sheets.worksheet.get_all_values()

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

    print(f"✅ Found {len(approved_leads)} APPROVED leads\n")

    # Confirmation
    print("=" * 80)
    print("PREVIEW")
    print("=" * 80)
    for i, lead in enumerate(approved_leads[:3], 1):
        print(f"{i}. {lead['business_name']} <{lead['email']}>")
        print(f"   Hook: {lead['ai_hook'][:60]}...")
        print()

    if len(approved_leads) > 3:
        print(f"   ... and {len(approved_leads) - 3} more\n")

    print("=" * 80)
    confirm = input(f"\nSend {len(approved_leads)} emails? [y/N]: ").strip().lower()
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

        print(f"\n[{i}/{len(approved_leads)}] {business_name} <{email}>")

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
                sheets.worksheet.update_cell(row_number, col_status + 1, "SENT")
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
                sheets.worksheet.update_cell(row_number, col_status + 1, "FAILED")
            except:
                pass

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"✅ Sent: {sent_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"📊 Total: {len(approved_leads)}")
    print("=" * 80)


if __name__ == "__main__":
    send_approved_leads()
