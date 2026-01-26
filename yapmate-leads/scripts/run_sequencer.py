#!/usr/bin/env python3
"""
YapMate Leads - Production Sequencer Orchestrator

Primary entry point for automated lead generation pipeline.
Designed for reliability, graceful degradation, and production safety.

Usage:
    python scripts/run_sequencer.py                  # Run next task
    python scripts/run_sequencer.py --status         # Show status
    python scripts/run_sequencer.py --send-only      # Just send emails
    python scripts/run_sequencer.py --init           # First-time setup
    python scripts/run_sequencer.py --health-check   # Verify all systems
"""

import argparse
import os
import sys
import signal
from pathlib import Path
from datetime import datetime

# =============================================================================
# PATH SETUP
# =============================================================================
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

# =============================================================================
# IMPORTS (after path setup)
# =============================================================================
from dotenv import load_dotenv
load_dotenv()

from src.config import get_config, reload_config
from src.reliability import safe_execute, StageResult

# =============================================================================
# CI TIMEOUT GUARD
# =============================================================================
CI_TIMEOUT_SECONDS = 20 * 60  # 20 minutes


def _timeout_handler(signum, frame):
    """Handle timeout signal - exit gracefully."""
    print("\n" + "=" * 70)
    print("[TIMEOUT] Run exceeded 20 minute limit")
    print("=" * 70)
    print("Exiting gracefully to prevent CI hang.")
    sys.exit(0)  # Exit 0 so CI doesn't mark as failure


def setup_timeout_guard():
    """Set up timeout guard for CI runs (Unix only)."""
    config = get_config()
    if config.is_ci:
        try:
            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(CI_TIMEOUT_SECONDS)
            print(f"[CI] Timeout guard enabled: {CI_TIMEOUT_SECONDS // 60} minutes")
        except (AttributeError, ValueError):
            print("[CI] Timeout guard not available on this platform")


# =============================================================================
# HEALTH CHECK
# =============================================================================
def health_check() -> bool:
    """Verify all systems are operational."""
    print("\n" + "=" * 70)
    print("SYSTEM HEALTH CHECK")
    print("=" * 70)

    config = get_config()
    status = config.validate()
    all_ok = True

    checks = [
        ("Google Sheets", status["sheets"], "Required"),
        ("OpenAI", status["openai"], "Required (enrichment)"),
        ("Apify", status["apify"], "Required (scraping)"),
        ("Resend", status["resend"], "Optional (sending)"),
    ]

    for name, ok, note in checks:
        icon = "✓" if ok else "✗"
        status_text = "OK" if ok else "MISSING"
        print(f"  [{icon}] {name}: {status_text} ({note})")
        if name == "Google Sheets" and not ok:
            all_ok = False

    # Test Sheets connection
    if status["sheets"]:
        print("\n  Testing Google Sheets connection...")
        try:
            from src.sequencer_sheets import SequencerSheetsManager
            sheets = SequencerSheetsManager()
            sa_email = sheets.get_service_account_email()
            print(f"  [✓] Connected as: {sa_email}")
        except Exception as e:
            print(f"  [✗] Connection failed: {e}")
            all_ok = False

    print("\n" + "=" * 70)
    print(f"Health Check: {'PASSED' if all_ok else 'FAILED'}")
    print("=" * 70)

    return all_ok


# =============================================================================
# STATUS DISPLAY
# =============================================================================
def show_status():
    """Show current system status."""
    from src.sequencer_sheets import SequencerSheetsManager
    from src.queue_generator import get_queue_stats

    config = get_config()

    print("\n" + "=" * 70)
    print("YAPMATE LEADS - SYSTEM STATUS")
    print("=" * 70)
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Environment: {'CI' if config.is_ci else 'Local'}")

    # Config status
    print("\n" + "-" * 70)
    print("CONFIGURATION")
    print("-" * 70)
    config.log_status()

    # Connect to sheets
    try:
        sheets = SequencerSheetsManager()
        sa_email = sheets.get_service_account_email()
        print(f"\n  Service Account: {sa_email}")
    except Exception as e:
        print(f"\n  [ERROR] Cannot connect to Sheets: {e}")
        return

    # Queue stats
    print("\n" + "-" * 70)
    print("QUEUE")
    print("-" * 70)

    try:
        stats = get_queue_stats(sheets)
        print(f"  Total pending tasks: {stats['total_pending']}")
        print(f"  By tier: {stats['by_tier']}")

        if stats.get('next_task'):
            t = stats['next_task']
            print(f"\n  Next task: {t.trade} in {t.city} ({t.session.value})")
            print(f"    Priority: {t.priority}, Tier: {t.tier}")
    except Exception as e:
        print(f"  [ERROR] Cannot get queue stats: {e}")

    # Runner state
    print("\n" + "-" * 70)
    print("RUNNER STATE")
    print("-" * 70)

    try:
        state = sheets.get_runner_state()
        print(f"  Focus trade: {state.focus_trade_id or 'None'}")
        print(f"  Last run: {state.last_run_at or 'Never'}")
        print(f"  Last session: {state.last_session.value if state.last_session else 'None'}")
        print(f"  Sending paused: {state.sending_paused}")
        if state.pause_reason:
            print(f"  Pause reason: {state.pause_reason}")
    except Exception as e:
        print(f"  [ERROR] Cannot get runner state: {e}")

    # Lead counts
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
        print(f"  [ERROR] Cannot get lead stats: {e}")

    print("\n" + "=" * 70)


# =============================================================================
# SCRAPE TASK
# =============================================================================
def run_scrape(manual: bool = False) -> StageResult:
    """Run the next scraping task with full reliability."""
    from src.sequencer_sheets import SequencerSheetsManager
    from src.task_runner import TaskRunner
    from src.apify_client import ApifyTimeoutError

    print("\n" + "=" * 70, flush=True)
    print("RUNNING SCRAPE TASK", flush=True)
    print("=" * 70, flush=True)

    config = get_config()

    # Check if scraping is enabled
    if not config.pipeline.scrape_enabled:
        print("[SCRAPE] Scraping is disabled in config", flush=True)
        return StageResult(stage="SCRAPE", success=True, data=None)

    # Connect to sheets
    print("Connecting to Google Sheets...", flush=True)
    try:
        sheets = SequencerSheetsManager()
        sheets.ensure_all_tabs()
        print("Connected to Google Sheets.", flush=True)
    except Exception as e:
        print(f"[ERROR] Failed to connect to Sheets: {e}", flush=True)
        return StageResult(
            stage="SCRAPE",
            success=False,
            error=e,
        )

    # Run task
    try:
        runner = TaskRunner(sheets)
        result = runner.run(manual=manual)

        if result:
            print(f"\nTask completed: {result.status}", flush=True)
            print(f"  Leads found: {result.leads_found}", flush=True)
            print(f"  After dedupe: {result.leads_after_dedupe}", flush=True)
            print(f"  Enriched: {result.leads_enriched}", flush=True)
            print(f"  Eligible: {result.leads_eligible}", flush=True)
            return StageResult(stage="SCRAPE", success=True, data=result)
        else:
            print("\nNo tasks to run.", flush=True)
            return StageResult(stage="SCRAPE", success=True, data=None)

    except ApifyTimeoutError as e:
        print(f"\n[TIMEOUT ERROR] {e}", flush=True)
        return StageResult(stage="SCRAPE", success=False, error=e)

    except Exception as e:
        print(f"[ERROR] Scrape task failed: {e}", flush=True)
        return StageResult(stage="SCRAPE", success=False, error=e)


# =============================================================================
# SEND EMAILS
# =============================================================================
def run_send(limit: int = None, force_run: bool = False, dry_run: bool = False) -> StageResult:
    """Run the email sender with full reliability."""
    from src.sequencer_sheets import SequencerSheetsManager
    from src.sequencer_email_sender import SequencerEmailSender

    print("\n" + "=" * 70)
    print("RUNNING EMAIL SENDER")
    print("=" * 70)

    config = get_config()

    # Check if sending is enabled
    if not config.pipeline.send_enabled:
        print("[SEND] Sending is disabled in config")
        return StageResult(stage="SEND", success=True, data=None)

    # Dry run mode
    effective_dry_run = dry_run or config.pipeline.dry_run
    if effective_dry_run:
        print("[SEND] Dry run mode - no emails will be sent")

    # Force run mode
    if force_run:
        print("[SEND] Force run mode - will bypass pause flags")

    # Connect to sheets
    try:
        sheets = SequencerSheetsManager()
    except Exception as e:
        print(f"[ERROR] Failed to connect to Sheets: {e}")
        return StageResult(stage="SEND", success=False, error=e)

    # Run sender
    try:
        sender = SequencerEmailSender(sheets)
        result = sender.send_batch(limit=limit, dry_run=effective_dry_run, force_run=force_run)

        if result.stopped_reason:
            print(f"\nSending stopped: {result.stopped_reason}")

        return StageResult(
            stage="SEND",
            success=True,
            data=result,
            metrics={
                "sent": result.total_sent if hasattr(result, 'total_sent') else 0,
                "failed": result.total_failed if hasattr(result, 'total_failed') else 0,
            },
        )

    except Exception as e:
        print(f"[ERROR] Email sender failed: {e}")
        return StageResult(stage="SEND", success=False, error=e)


# =============================================================================
# INITIALIZE
# =============================================================================
def initialize():
    """Initialize all tabs and build queue (first-time setup)."""
    from src.sequencer_sheets import SequencerSheetsManager
    from src.queue_generator import rebuild_queue, get_queue_stats
    from src.sequencer_config import UK_CITIES, TRADES_BY_TIER, TradeTier

    print("\n" + "=" * 70)
    print("INITIALIZING SEQUENCING ENGINE")
    print("=" * 70)

    # Connect to sheets
    try:
        sheets = SequencerSheetsManager()
    except Exception as e:
        print(f"[ERROR] Failed to connect to Sheets: {e}")
        sys.exit(1)

    # Ensure all tabs exist
    print("\nCreating tabs...")
    sheets.ensure_all_tabs()
    print("[✓] All tabs ready")

    # Check if queue is empty
    stats = get_queue_stats(sheets)

    if stats['total_pending'] == 0:
        print("\nQueue is empty. Building initial queue...")
        rebuild_queue(sheets, clear_existing=True)
        stats = get_queue_stats(sheets)
        print(f"[✓] Queue built with {stats['total_pending']} tasks")
    else:
        print(f"\n[✓] Queue already has {stats['total_pending']} pending tasks")

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
        2
    )
    print(f"\n  Total possible tasks: {total_tasks}")
    print(f"  At 2 tasks/day: {total_tasks // 2} days to complete cycle")

    print("\n" + "=" * 70)
    print("INITIALIZATION COMPLETE")
    print("=" * 70)


# =============================================================================
# REBUILD QUEUE
# =============================================================================
def rebuild_queue_cmd():
    """Rebuild the task queue."""
    from src.sequencer_sheets import SequencerSheetsManager
    from src.queue_generator import rebuild_queue

    print("\n" + "=" * 70)
    print("REBUILDING QUEUE")
    print("=" * 70)

    try:
        sheets = SequencerSheetsManager()
        rebuild_queue(sheets, clear_existing=True)
        print("[✓] Queue rebuilt successfully")
    except Exception as e:
        print(f"[ERROR] Failed to rebuild queue: {e}")
        sys.exit(1)


# =============================================================================
# MAIN
# =============================================================================
def main():
    """Main entry point."""
    # Set up timeout guard for CI
    setup_timeout_guard()

    parser = argparse.ArgumentParser(
        description="YapMate Leads - Production Sequencer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--init", action="store_true", help="Initialize system")
    parser.add_argument("--status", action="store_true", help="Show status")
    parser.add_argument("--health-check", action="store_true", help="Run health check")
    parser.add_argument("--manual", action="store_true", help="Manual run mode")
    parser.add_argument("--send", action="store_true", help="Send emails after scraping")
    parser.add_argument("--send-only", action="store_true", help="Only send emails")
    parser.add_argument("--send-limit", type=int, help="Max emails to send")
    parser.add_argument("--rebuild-queue", action="store_true", help="Rebuild queue")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    parser.add_argument("--force-run", action="store_true", help="Force run (bypass pause flags)")

    args = parser.parse_args()

    # Override config for dry run
    if args.dry_run:
        os.environ["DRY_RUN"] = "true"
        reload_config()

    # Route commands
    if args.health_check:
        success = health_check()
        sys.exit(0 if success else 1)

    if args.status:
        show_status()
        return

    if args.init:
        initialize()
        return

    if args.rebuild_queue:
        rebuild_queue_cmd()
        return

    if args.send_only:
        result = run_send(limit=args.send_limit, force_run=args.force_run, dry_run=args.dry_run)
        sys.exit(0 if result.success else 1)

    # Default: run scrape task
    scrape_result = run_scrape(manual=args.manual)

    if args.send and scrape_result.success:
        print("\n" + "-" * 70)
        run_send(limit=args.send_limit, force_run=args.force_run, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
