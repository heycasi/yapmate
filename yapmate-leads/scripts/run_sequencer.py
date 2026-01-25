#!/usr/bin/env python3
"""Main Orchestrator for City-Trade Sequencing Engine.

This script is the primary entry point for automated lead generation.
It can be triggered by cron or a scheduler to run AM and PM sessions.

Usage:
    # Run next task (automated - uses trigger time for session)
    python scripts/run_sequencer.py

    # Run next task (manual - uses time windows)
    python scripts/run_sequencer.py --manual

    # Run and then send emails
    python scripts/run_sequencer.py --send

    # Just send emails (no scraping)
    python scripts/run_sequencer.py --send-only

    # Show status
    python scripts/run_sequencer.py --status

    # Rebuild queue
    python scripts/run_sequencer.py --rebuild-queue

    # Initialize all tabs (first-time setup)
    python scripts/run_sequencer.py --init

Alerting:
    The engine sends email alerts to support@yapmate.co.uk for critical events:
    - Task dead after max retries (critical)
    - Zero send-eligible leads (warning)
    - Sending paused due to bounce/complaint thresholds (critical)
    - Unexpected errors in email sender (critical)

    Alerts are rate-limited: same alert won't be sent twice within 60 minutes.
    Requires RESEND_API_KEY in environment for alerts to be delivered.
"""

import argparse
import os
import sys
import signal
from pathlib import Path
from datetime import datetime

# CI timeout guard (20 minutes)
CI_TIMEOUT_SECONDS = 20 * 60


def _timeout_handler(signum, frame):
    """Handle timeout signal - exit gracefully."""
    print("\n" + "=" * 70)
    print("TIMEOUT: Run exceeded 20 minute limit")
    print("=" * 70)
    print("Exiting gracefully to prevent CI hang.")
    print("This may indicate slow API responses or network issues.")
    sys.exit(1)


def setup_timeout_guard():
    """Set up timeout guard for CI runs (Unix only)."""
    if os.getenv("CI") or os.getenv("GITHUB_ACTIONS"):
        try:
            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(CI_TIMEOUT_SECONDS)
            print(f"[CI] Timeout guard enabled: {CI_TIMEOUT_SECONDS // 60} minutes")
        except (AttributeError, ValueError):
            # Windows or signal not available
            print("[CI] Timeout guard not available on this platform")


# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

from dotenv import load_dotenv
load_dotenv()

from src.sequencer_sheets import SequencerSheetsManager
from src.sequencer_config import (
    UK_CITIES, TRADES_BY_TIER, TradeTier,
    DEFAULT_EMAIL_SENDER_CONFIG
)


def show_status(sheets: SequencerSheetsManager):
    """Show current system status."""
    from src.queue_generator import get_queue_stats
    from src.sequencer_email_sender import SequencerEmailSender

    print("\n" + "=" * 70)
    print("CITY-TRADE SEQUENCING ENGINE STATUS")
    print("=" * 70)
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Service account info
    sa_email = sheets.get_service_account_email()
    if sa_email:
        print(f"  Service Account: {sa_email}")
        print(f"  ⚠️  Ensure your Google Sheet is shared with this email!")
    else:
        print("  Service Account: (unknown)")

    # Queue stats
    print("\n" + "-" * 70)
    print("QUEUE")
    print("-" * 70)

    stats = get_queue_stats(sheets)
    print(f"  Total pending tasks: {stats['total_pending']}")
    print(f"  By tier: {stats['by_tier']}")

    if stats['next_task']:
        t = stats['next_task']
        print(f"\n  Next task: {t.trade} in {t.city} ({t.session.value})")
        print(f"    Priority: {t.priority}, Tier: {t.tier}")

    # State
    print("\n" + "-" * 70)
    print("RUNNER STATE")
    print("-" * 70)

    state = sheets.get_runner_state()
    print(f"  Focus trade: {state.focus_trade_id or 'None'}")
    print(f"  Focus date: {state.focus_trade_date or 'None'}")
    print(f"  Last run: {state.last_run_at or 'Never'}")
    print(f"  Last session: {state.last_session.value if state.last_session else 'None'}")

    # Email stats
    print("\n" + "-" * 70)
    print("EMAIL SENDER")
    print("-" * 70)

    try:
        sender = SequencerEmailSender(sheets)
        daily_limit = sender.calculate_daily_limit()
        remaining = sender.get_remaining_daily_quota()
        metrics = sheets.get_safety_metrics()

        print(f"  Paused: {state.sending_paused}")
        if state.pause_reason:
            print(f"  Pause reason: {state.pause_reason}")
        print(f"  Daily limit: {daily_limit}")
        print(f"  Sent today: {state.emails_sent_today}")
        print(f"  Remaining: {remaining}")
        print(f"\n  Safety (last 7 days):")
        print(f"    Sent: {metrics['total_sent']}")
        print(f"    Bounces: {metrics['bounce_count']} ({metrics['bounce_rate']:.1%})")
        print(f"    Complaints: {metrics['complaint_count']} ({metrics['complaint_rate']:.3%})")
    except Exception as e:
        print(f"  Error loading email stats: {e}")

    # Leads stats
    print("\n" + "-" * 70)
    print("LEADS")
    print("-" * 70)

    try:
        new_leads = sheets.get_leads_by_status("NEW", limit=10000)
        approved = sheets.get_leads_by_status("APPROVED", limit=10000)
        sent = sheets.get_leads_by_status("SENT", limit=10000)
        eligible = sheets.get_eligible_leads(limit=10000)

        print(f"  NEW: {len(new_leads)}")
        print(f"  APPROVED: {len(approved)}")
        print(f"  SENT: {len(sent)}")
        print(f"  Send-eligible: {len(eligible)}")
    except Exception as e:
        print(f"  Error loading lead stats: {e}")

    print("\n" + "=" * 70)


def run_scrape(sheets: SequencerSheetsManager, manual: bool = False):
    """Run the next scraping task."""
    from src.task_runner import TaskRunner

    print("\n" + "=" * 70)
    print("RUNNING SCRAPE TASK")
    print("=" * 70)

    runner = TaskRunner(sheets)
    result = runner.run(manual=manual)

    if result:
        print(f"\nTask completed: {result.status}")
        print(f"  Leads found: {result.leads_found}")
        print(f"  After dedupe: {result.leads_after_dedupe}")
        print(f"  Enriched: {result.leads_enriched}")
        print(f"  Eligible: {result.leads_eligible}")
        return True
    else:
        print("\nNo tasks to run.")
        return False


def run_send(sheets: SequencerSheetsManager, limit: int = None):
    """Run the email sender."""
    from src.sequencer_email_sender import SequencerEmailSender

    sender = SequencerEmailSender(sheets)
    result = sender.send_batch(limit=limit)

    if result.stopped_reason:
        print(f"\nSending stopped: {result.stopped_reason}")

    return result


def rebuild_queue(sheets: SequencerSheetsManager):
    """Rebuild the task queue."""
    from src.queue_generator import rebuild_queue as do_rebuild
    do_rebuild(sheets, clear_existing=True)


def initialize(sheets: SequencerSheetsManager):
    """Initialize all tabs (first-time setup)."""
    print("\n" + "=" * 70)
    print("INITIALIZING SEQUENCING ENGINE")
    print("=" * 70)

    # Ensure all tabs exist
    sheets.ensure_all_tabs()

    # Check if queue is empty
    from src.queue_generator import get_queue_stats
    stats = get_queue_stats(sheets)

    if stats['total_pending'] == 0:
        print("\nQueue is empty. Building initial queue...")
        rebuild_queue(sheets)
    else:
        print(f"\nQueue already has {stats['total_pending']} pending tasks.")
        print("Use --rebuild-queue to rebuild.")

    # Show configuration
    print("\n" + "-" * 70)
    print("CONFIGURATION")
    print("-" * 70)
    print(f"  Cities: {len(UK_CITIES)}")
    print(f"  Tier 1 trades: {len(TRADES_BY_TIER[TradeTier.TIER_1])}")
    print(f"  Tier 2 trades: {len(TRADES_BY_TIER[TradeTier.TIER_2])}")
    print(f"  Tier 3 trades: {len(TRADES_BY_TIER[TradeTier.TIER_3])}")

    total_tasks = (
        len(UK_CITIES) *
        (len(TRADES_BY_TIER[TradeTier.TIER_1]) +
         len(TRADES_BY_TIER[TradeTier.TIER_2]) +
         len(TRADES_BY_TIER[TradeTier.TIER_3])) *
        2  # AM + PM
    )
    print(f"\n  Total possible tasks: {total_tasks}")
    print(f"  At 2 tasks/day: {total_tasks // 2} days to complete cycle")

    print("\n" + "=" * 70)
    print("INITIALIZATION COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Run: python scripts/run_sequencer.py --status")
    print("  2. Test: python scripts/run_sequencer.py --manual")
    print("  3. Schedule: Set up cron for AM and PM triggers")
    print("\nCron examples (adjust timezone):")
    print("  # AM session at 8:00 AM")
    print("  0 8 * * * cd /path/to/yapmate-leads && python scripts/run_sequencer.py --send")
    print("  # PM session at 3:00 PM")
    print("  0 15 * * * cd /path/to/yapmate-leads && python scripts/run_sequencer.py --send")


def main():
    """Main entry point."""
    # Set up timeout guard for CI
    setup_timeout_guard()

    parser = argparse.ArgumentParser(
        description="City-Trade Sequencing Engine Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/run_sequencer.py --init           # First-time setup
  python scripts/run_sequencer.py --status         # Show status
  python scripts/run_sequencer.py                  # Run next task (automated)
  python scripts/run_sequencer.py --manual         # Run next task (manual)
  python scripts/run_sequencer.py --send           # Run task + send emails
  python scripts/run_sequencer.py --send-only      # Just send emails
  python scripts/run_sequencer.py --rebuild-queue  # Rebuild the queue
        """
    )

    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize all tabs and build queue (first-time setup)"
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show current system status"
    )
    parser.add_argument(
        "--manual",
        action="store_true",
        help="Use time-based session windows (for manual runs)"
    )
    parser.add_argument(
        "--send",
        action="store_true",
        help="Send emails after scraping"
    )
    parser.add_argument(
        "--send-only",
        action="store_true",
        help="Only send emails (skip scraping)"
    )
    parser.add_argument(
        "--send-limit",
        type=int,
        default=None,
        help="Maximum emails to send"
    )
    parser.add_argument(
        "--rebuild-queue",
        action="store_true",
        help="Rebuild the task queue"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without executing"
    )

    args = parser.parse_args()

    # Connect to sheets
    print("Connecting to Google Sheets...")
    try:
        sheets = SequencerSheetsManager()
    except Exception as e:
        print(f"Error connecting to Google Sheets: {e}")
        print("\nMake sure:")
        print("  1. credentials.json exists in the project root")
        print("  2. GOOGLE_SHEET_ID is set in .env")
        print("  3. The sheet is shared with the service account")
        sys.exit(1)

    # Handle commands
    if args.init:
        initialize(sheets)
        return

    # Ensure tabs exist for other commands
    sheets.ensure_all_tabs()

    if args.status:
        show_status(sheets)
        return

    if args.rebuild_queue:
        rebuild_queue(sheets)
        return

    if args.dry_run:
        from src.task_runner import TaskRunner

        runner = TaskRunner(sheets)
        session = runner.determine_session(manual=args.manual)
        print(f"\nDRY RUN - Session type: {session.value}")

        task = runner.get_next_task(session)
        if task:
            print(f"\nWould execute task:")
            print(f"  Trade: {task.trade}")
            print(f"  City: {task.city}")
            print(f"  Session: {task.session.value}")
            print(f"  Priority: {task.priority}")
        else:
            print("\nNo pending tasks.")

        if args.send or args.send_only:
            eligible = sheets.get_eligible_leads(limit=args.send_limit or 100)
            print(f"\nWould send to {len(eligible)} eligible leads")

        return

    # Execute based on flags
    if args.send_only:
        # Just send emails
        run_send(sheets, limit=args.send_limit)
    else:
        # Run scrape task
        scraped = run_scrape(sheets, manual=args.manual)

        # Optionally send emails
        if args.send:
            print("\n" + "-" * 70)
            run_send(sheets, limit=args.send_limit)


if __name__ == "__main__":
    main()
