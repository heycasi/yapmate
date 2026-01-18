"""Email notifications for pipeline visibility (non-blocking)."""

import os
from datetime import datetime

# Recipient for all notifications
NOTIFY_EMAIL = "connordahl@hotmail.com"


def notify_new_leads(trade: str, city: str, leads_added: int) -> None:
    """
    Send notification when new leads are added to Google Sheets.

    This is fire-and-forget: failures are logged but never block execution.
    """
    if leads_added < 1:
        return

    try:
        import resend
        from dotenv import load_dotenv

        load_dotenv()

        api_key = os.getenv("RESEND_API_KEY")
        email_from = os.getenv("EMAIL_FROM", "noreply@yapmate.co.uk")
        email_from_name = os.getenv("EMAIL_FROM_NAME", "YapMate")

        if not api_key:
            print("   [notify] Warning: RESEND_API_KEY not set, skipping notification")
            return

        resend.api_key = api_key

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        subject = f"YapMate: {leads_added} new leads ready for approval"

        body = f"""New leads have been added to Google Sheets.

Trade: {trade}
City: {city}
Leads added: {leads_added}
Timestamp: {timestamp}

Open Google Sheets and review leads with status=NEW
"""

        resend.Emails.send({
            "from": f"{email_from_name} <{email_from}>",
            "to": [NOTIFY_EMAIL],
            "subject": subject,
            "text": body
        })

        print(f"   [notify] Sent notification: {leads_added} new leads")

    except Exception as e:
        print(f"   [notify] Warning: Failed to send notification - {str(e)}")


def notify_send_complete(total_processed: int, sent: int, failed: int) -> None:
    """
    Send notification after send batch completes.

    This is fire-and-forget: failures are logged but never block execution.
    """
    if total_processed < 1:
        return

    try:
        import resend
        from dotenv import load_dotenv

        load_dotenv()

        api_key = os.getenv("RESEND_API_KEY")
        email_from = os.getenv("EMAIL_FROM", "noreply@yapmate.co.uk")
        email_from_name = os.getenv("EMAIL_FROM_NAME", "YapMate")

        if not api_key:
            print("   [notify] Warning: RESEND_API_KEY not set, skipping notification")
            return

        resend.api_key = api_key

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        subject = f"YapMate send complete: {sent} sent / {failed} failed"

        body = f"""Email send batch has completed.

Total APPROVED leads processed: {total_processed}
Sent: {sent}
Failed: {failed}
Timestamp: {timestamp}

Failed leads are marked FAILED in Google Sheets
"""

        resend.Emails.send({
            "from": f"{email_from_name} <{email_from}>",
            "to": [NOTIFY_EMAIL],
            "subject": subject,
            "text": body
        })

        print(f"   [notify] Sent summary notification")

    except Exception as e:
        print(f"   [notify] Warning: Failed to send notification - {str(e)}")
