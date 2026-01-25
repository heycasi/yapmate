"""Alerting system for City-Trade Sequencing Engine.

Sends email alerts to support@yapmate.co.uk when the engine hits
key failure or safety states.

Features:
- Uses Resend API for email delivery
- Rate limiting to prevent spam (same alert_key within 60 min = skip)
- Non-blocking: errors in alerting don't crash the engine
"""

import os
import hashlib
import traceback
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import requests
from dotenv import load_dotenv

load_dotenv()

# Alert configuration
ALERT_TO_EMAIL = "support@yapmate.co.uk"
ALERT_FROM_EMAIL = "YapMate Engine <support@yapmate.co.uk>"
RESEND_API_URL = "https://api.resend.com/emails"
ALERT_COOLDOWN_MINUTES = 60
REQUEST_TIMEOUT_SECONDS = 10


def _get_alert_key(subject: str, context: Optional[Dict[str, Any]] = None) -> str:
    """
    Generate a hash key for rate-limiting duplicate alerts.

    Uses subject + selected context fields to identify "same" alerts.
    """
    key_parts = [subject]

    if context:
        # Include key identifiers but not volatile data like timestamps
        for field in ["task_id", "trade", "city", "pause_reason"]:
            if field in context:
                key_parts.append(f"{field}={context[field]}")

    key_string = "|".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()[:16]


def _format_alert_body(
    body: str,
    severity: str,
    context: Optional[Dict[str, Any]] = None,
    run_id: Optional[str] = None,
    task_id: Optional[str] = None
) -> str:
    """Format the alert body with metadata."""
    lines = [
        f"Timestamp: {datetime.utcnow().isoformat()}Z",
        f"Severity: {severity.upper()}",
    ]

    if run_id:
        lines.append(f"Run ID: {run_id}")
    if task_id:
        lines.append(f"Task ID: {task_id}")

    lines.append("")
    lines.append(body)

    if context:
        lines.append("")
        lines.append("Context:")
        for key, value in context.items():
            if key not in ("run_id", "task_id"):  # Already shown above
                lines.append(f"  {key}: {value}")

    lines.append("")
    lines.append("---")
    lines.append("YapMate Lead Engine")

    return "\n".join(lines)


def send_alert(
    subject: str,
    body: str,
    severity: str = "warning",
    context: Optional[Dict[str, Any]] = None,
    sheets_manager=None
) -> bool:
    """
    Send an alert email via Resend API.

    Args:
        subject: Alert subject (will be prefixed with severity)
        body: Alert body text
        severity: "info", "warning", or "critical"
        context: Optional dict of key/values to include
        sheets_manager: Optional SequencerSheetsManager for rate-limiting via state tab

    Returns:
        True if alert was sent (or skipped due to rate limit), False on error
    """
    try:
        # Get API key
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            print("[Alert] RESEND_API_KEY not configured, skipping alert")
            return False

        # Generate alert key for rate limiting
        alert_key = _get_alert_key(subject, context)

        # Check rate limit via state tab if sheets_manager provided
        if sheets_manager:
            try:
                if _is_rate_limited(alert_key, sheets_manager):
                    print(f"[Alert] Rate-limited (same alert within {ALERT_COOLDOWN_MINUTES}min): {subject[:50]}...")
                    return True  # Return True since this is expected behavior
            except Exception as e:
                print(f"[Alert] Rate limit check failed: {e}")
                # Continue sending anyway if rate limit check fails

        # Extract run_id and task_id from context
        run_id = context.get("run_id") if context else None
        task_id = context.get("task_id") if context else None

        # Format subject and body
        full_subject = f"[Lead Engine][{severity.upper()}] {subject}"
        full_body = _format_alert_body(body, severity, context, run_id, task_id)

        # Send via Resend API
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "from": ALERT_FROM_EMAIL,
            "to": [ALERT_TO_EMAIL],
            "subject": full_subject,
            "text": full_body
        }

        response = requests.post(
            RESEND_API_URL,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS
        )

        if response.status_code in (200, 201):
            print(f"[Alert] Sent: {subject}")

            # Update rate limit state
            if sheets_manager:
                try:
                    _update_alert_state(alert_key, sheets_manager)
                except Exception as e:
                    print(f"[Alert] Failed to update state: {e}")

            return True
        else:
            print(f"[Alert] Resend API error {response.status_code}: {response.text[:200]}")
            return False

    except requests.exceptions.Timeout:
        print(f"[Alert] Timeout sending alert: {subject}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"[Alert] Request error: {e}")
        return False
    except Exception as e:
        print(f"[Alert] Unexpected error sending alert: {e}")
        return False


def _is_rate_limited(alert_key: str, sheets_manager) -> bool:
    """
    Check if this alert_key was sent recently.

    Returns True if alert should be skipped (rate limited).
    """
    try:
        state = sheets_manager.get_runner_state()

        # Check if same alert key and within cooldown period
        if hasattr(state, 'last_alert_key') and state.last_alert_key == alert_key:
            if hasattr(state, 'last_alert_at') and state.last_alert_at:
                cooldown = timedelta(minutes=ALERT_COOLDOWN_MINUTES)
                if datetime.utcnow() - state.last_alert_at < cooldown:
                    return True

        return False
    except Exception:
        return False


def _update_alert_state(alert_key: str, sheets_manager):
    """Update the state tab with the latest alert info."""
    try:
        state = sheets_manager.get_runner_state()
        state.last_alert_key = alert_key
        state.last_alert_at = datetime.utcnow()
        sheets_manager.save_runner_state(state)
    except Exception as e:
        print(f"[Alert] Failed to update alert state: {e}")


# =============================================================================
# CONVENIENCE ALERT FUNCTIONS
# =============================================================================

def alert_task_dead(
    task_id: str,
    trade: str,
    city: str,
    session: str,
    last_error: str,
    retry_count: int,
    sheets_manager=None
):
    """Alert when a task dies after max retries."""
    send_alert(
        subject="Task dead after max retries",
        body=(
            f"Task {task_id[:8]} has failed permanently after {retry_count} retries.\n\n"
            f"Trade: {trade}\n"
            f"City: {city}\n"
            f"Session: {session}\n"
            f"Last error: {last_error}"
        ),
        severity="critical",
        context={
            "task_id": task_id,
            "trade": trade,
            "city": city,
            "session": session,
            "retry_count": retry_count,
            "last_error": last_error
        },
        sheets_manager=sheets_manager
    )


def alert_zero_eligible_leads(
    run_id: str,
    task_id: str,
    trade: str,
    city: str,
    leads_found: int,
    leads_after_dedupe: int,
    leads_enriched: int,
    leads_eligible: int,
    sheets_manager=None
):
    """Alert when a run completes with zero send-eligible leads."""
    send_alert(
        subject="Zero send-eligible leads",
        body=(
            f"Run completed but produced 0 send-eligible leads.\n\n"
            f"Trade: {trade}\n"
            f"City: {city}\n\n"
            f"Pipeline breakdown:\n"
            f"  Found: {leads_found}\n"
            f"  After dedupe: {leads_after_dedupe}\n"
            f"  Enriched: {leads_enriched}\n"
            f"  Eligible: {leads_eligible}\n\n"
            f"Hint: Check website_email_extractor and eligibility rules.\n"
            f"If all leads lack email, website scraping may be failing."
        ),
        severity="warning",
        context={
            "run_id": run_id,
            "task_id": task_id,
            "trade": trade,
            "city": city,
            "leads_found": leads_found,
            "leads_after_dedupe": leads_after_dedupe,
            "leads_enriched": leads_enriched,
            "leads_eligible": leads_eligible
        },
        sheets_manager=sheets_manager
    )


def alert_sending_paused(
    bounce_rate: float,
    complaint_rate: float,
    total_sent: int,
    bounce_threshold: float,
    complaint_threshold: float,
    pause_reason: str,
    sheets_manager=None
):
    """Alert when sending is paused due to deliverability thresholds."""
    send_alert(
        subject="Sending paused due to deliverability safety threshold",
        body=(
            f"Email sending has been automatically paused.\n\n"
            f"Reason: {pause_reason}\n\n"
            f"Current metrics (last 7 days):\n"
            f"  Bounce rate: {bounce_rate:.2%} (threshold: {bounce_threshold:.2%})\n"
            f"  Complaint rate: {complaint_rate:.3%} (threshold: {complaint_threshold:.3%})\n"
            f"  Total sent: {total_sent}\n\n"
            f"Action required: Investigate bounces/complaints before resuming."
        ),
        severity="critical",
        context={
            "pause_reason": pause_reason,
            "bounce_rate": f"{bounce_rate:.2%}",
            "complaint_rate": f"{complaint_rate:.3%}",
            "total_sent": total_sent,
            "bounce_threshold": f"{bounce_threshold:.2%}",
            "complaint_threshold": f"{complaint_threshold:.3%}"
        },
        sheets_manager=sheets_manager
    )


def alert_sender_error(
    exception: Exception,
    sheets_manager=None
):
    """Alert on unexpected exception in email sender."""
    tb = traceback.format_exc()

    send_alert(
        subject="Email sender error",
        body=(
            f"An unexpected error occurred in the email sender.\n\n"
            f"Exception: {type(exception).__name__}: {exception}\n\n"
            f"Traceback:\n{tb}"
        ),
        severity="critical",
        context={
            "exception_type": type(exception).__name__,
            "exception_message": str(exception)
        },
        sheets_manager=sheets_manager
    )
