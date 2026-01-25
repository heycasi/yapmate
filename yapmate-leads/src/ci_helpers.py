"""CI/CD helpers for GitHub Actions automation.

Provides:
- DST-aware time window guard for UK scheduling
- Failure alert email via Resend
- Credential setup from environment variables
"""

import os
import sys
import json
import tempfile
from datetime import datetime
from typing import Optional, List, Set

import requests
from dotenv import load_dotenv

load_dotenv()


# =============================================================================
# TIMEZONE HANDLING
# =============================================================================

def get_uk_hour() -> int:
    """
    Get the current hour in UK time (Europe/London).

    Handles GMT/BST automatically using system timezone conversion.

    Returns:
        Hour (0-23) in UK local time
    """
    try:
        import pytz
        uk_tz = pytz.timezone("Europe/London")
        uk_now = datetime.now(uk_tz)
        return uk_now.hour
    except ImportError:
        # Fallback: use zoneinfo (Python 3.9+)
        try:
            from zoneinfo import ZoneInfo
            uk_tz = ZoneInfo("Europe/London")
            uk_now = datetime.now(uk_tz)
            return uk_now.hour
        except ImportError:
            # Last resort: assume UTC (will be wrong during BST)
            print("[CI] Warning: pytz/zoneinfo not available, using UTC")
            return datetime.utcnow().hour


def is_sequencer_window(allowed_hours: Set[int] = None) -> bool:
    """
    Check if current UK time is within the sequencer run window.

    Args:
        allowed_hours: Set of hours (0-23) when sequencer should run.
                      Defaults to {9, 13, 18, 21}

    Returns:
        True if current UK hour is in allowed_hours
    """
    if allowed_hours is None:
        allowed_hours = {9, 13, 18, 21}

    uk_hour = get_uk_hour()
    in_window = uk_hour in allowed_hours

    print(f"[CI] UK time check: hour={uk_hour}, allowed={sorted(allowed_hours)}, in_window={in_window}")

    return in_window


def time_guard(allowed_hours: Set[int] = None, mode: str = "sequencer") -> bool:
    """
    Guard function that exits cleanly if outside allowed time window.

    This allows GitHub Actions to run at multiple UTC times to cover
    both GMT and BST, while the script decides if it should actually execute.

    Args:
        allowed_hours: Set of hours when execution is allowed
        mode: "sequencer" or "email_sender" (for logging)

    Returns:
        True if should continue, exits with 0 if should skip
    """
    if allowed_hours is None:
        if mode == "sequencer":
            allowed_hours = {9, 13, 18, 21}
        else:
            # Email sender runs every 15 min, no time guard needed
            return True

    if not is_sequencer_window(allowed_hours):
        uk_hour = get_uk_hour()
        print(f"[CI] Skipping {mode} run: UK hour {uk_hour} not in {sorted(allowed_hours)}")
        print("[CI] This is expected behavior for DST-robust scheduling. Exiting cleanly.")
        sys.exit(0)

    print(f"[CI] Time guard passed for {mode}")
    return True


# =============================================================================
# CREDENTIALS SETUP
# =============================================================================

def setup_credentials_from_env() -> Optional[str]:
    """
    Write Google credentials JSON from environment variable to a temp file.

    Reads GOOGLE_SHEETS_CREDENTIALS_JSON env var and writes to a file
    that can be used by SequencerSheetsManager.

    Returns:
        Path to the credentials file, or None if env var not set
    """
    creds_json = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")

    if not creds_json:
        print("[CI] GOOGLE_SHEETS_CREDENTIALS_JSON not set, using local credentials.json")
        return None

    # Validate it's valid JSON
    try:
        json.loads(creds_json)
    except json.JSONDecodeError as e:
        print(f"[CI] Error: GOOGLE_SHEETS_CREDENTIALS_JSON is not valid JSON: {e}")
        sys.exit(1)

    # Write to credentials.json in current directory (where code expects it)
    creds_path = os.path.join(os.getcwd(), "credentials.json")

    with open(creds_path, "w") as f:
        f.write(creds_json)

    print(f"[CI] Wrote credentials to {creds_path}")
    return creds_path


# =============================================================================
# FAILURE ALERTS
# =============================================================================

def send_failure_alert(
    workflow_name: str,
    job_name: str,
    run_id: str,
    run_url: str,
    repo: str,
    branch: str,
    commit_sha: str,
    error_summary: str
) -> bool:
    """
    Send a failure alert email via Resend API.

    Args:
        workflow_name: Name of the GitHub Actions workflow
        job_name: Name of the job that failed
        run_id: GitHub run ID
        run_url: Full URL to the workflow run
        repo: Repository name (owner/repo)
        branch: Branch name (e.g., main)
        commit_sha: Full commit SHA
        error_summary: Brief description of the error

    Returns:
        True if alert sent successfully, False otherwise

    Raises:
        ValueError: If RESEND_API_KEY is not configured
    """
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        error_msg = "[CI Alert] ERROR: RESEND_API_KEY not configured. Cannot send failure alert."
        print(error_msg)
        raise ValueError(error_msg)

    to_email = os.getenv("ALERT_TO_EMAIL", "support@yapmate.co.uk")
    from_email = os.getenv("ALERT_FROM_EMAIL", "YapMate Leads CI <support@yapmate.co.uk>")

    subject = f"[YapMate Leads] CI Failure: {workflow_name}"

    # Build email body
    body = f"""GitHub Actions Workflow Failed

Workflow:    {workflow_name}
Job:         {job_name}
Status:      FAILED
Timestamp:   {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC

Repository:  {repo}
Branch:      {branch}
Commit:      {commit_sha[:8]}

Run ID:      {run_id}
View Logs:   {run_url}

Error Summary:
{error_summary}

---
This is an automated alert from YapMate Leads CI.
To investigate, click the "View Logs" link above.
"""

    print(f"[CI Alert] Sending failure alert...")
    print(f"[CI Alert]   To: {to_email}")
    print(f"[CI Alert]   From: {from_email}")
    print(f"[CI Alert]   Subject: {subject}")

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "text": body
        }

        response = requests.post(
            "https://api.resend.com/emails",
            headers=headers,
            json=payload,
            timeout=15
        )

        if response.status_code in (200, 201):
            result = response.json()
            email_id = result.get("id", "unknown")
            print(f"[CI Alert] SUCCESS: Alert sent (ID: {email_id})")
            return True
        else:
            print(f"[CI Alert] FAILED: Resend API returned {response.status_code}")
            print(f"[CI Alert] Response: {response.text[:500]}")
            return False

    except requests.exceptions.Timeout:
        print("[CI Alert] FAILED: Request timed out")
        return False
    except requests.exceptions.RequestException as e:
        print(f"[CI Alert] FAILED: Request error - {e}")
        return False
    except Exception as e:
        print(f"[CI Alert] FAILED: Unexpected error - {e}")
        return False


# =============================================================================
# CLI FOR TESTING
# =============================================================================

def main():
    """CLI for testing CI helpers."""
    import argparse

    parser = argparse.ArgumentParser(description="CI Helpers")
    parser.add_argument("--check-time", action="store_true", help="Check if in sequencer window")
    parser.add_argument("--setup-creds", action="store_true", help="Setup credentials from env")
    parser.add_argument("--test-alert", action="store_true", help="Send a test failure alert")
    parser.add_argument("--uk-hour", action="store_true", help="Show current UK hour")

    args = parser.parse_args()

    if args.uk_hour:
        print(f"Current UK hour: {get_uk_hour()}")
        return

    if args.check_time:
        in_window = is_sequencer_window()
        print(f"In sequencer window: {in_window}")
        return

    if args.setup_creds:
        path = setup_credentials_from_env()
        print(f"Credentials path: {path}")
        return

    if args.test_alert:
        send_failure_alert(
            workflow_name="test-workflow",
            job_name="test-job",
            run_id="12345",
            run_url="https://github.com/test/repo/actions/runs/12345",
            repo="test/repo",
            branch="main",
            commit_sha="abc123def456",
            error_summary="This is a test alert to verify CI alerting works."
        )
        return

    parser.print_help()


if __name__ == "__main__":
    main()
