#!/usr/bin/env python3
"""End-to-End Pipeline Runner.

Main entry point for the automated lead generation pipeline.
Runs discovery with yield targets, then triggers email sending if targets met.

Usage:
    python scripts/run_pipeline.py                    # Full pipeline
    python scripts/run_pipeline.py --dry-run          # No writes/sends
    python scripts/run_pipeline.py --discovery-only   # Skip sending
    python scripts/run_pipeline.py --send-only        # Only send emails

Exit codes:
    0 = Success (targets met or no work to do)
    1 = Failure (preflight, discovery, or critical error)
    2 = Partial success (targets not met but no errors)
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

from src.pipeline_orchestrator import PipelineOrchestrator, PipelineConfig, PipelineStage


# =============================================================================
# TIMEOUT GUARD (for CI)
# =============================================================================
def setup_timeout_guard(timeout_seconds: int):
    """Set up timeout guard to prevent hanging."""
    def timeout_handler(signum, frame):
        print(f"\n{'=' * 70}")
        print(f"[TIMEOUT] Pipeline exceeded {timeout_seconds}s limit")
        print(f"{'=' * 70}")
        print("Exiting gracefully to prevent CI hang.")
        sys.exit(2)  # Exit 2 = timeout

    try:
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout_seconds)
        print(f"[GUARD] Timeout set: {timeout_seconds}s")
    except (AttributeError, ValueError):
        print("[GUARD] Timeout guard not available on this platform")


# =============================================================================
# MAIN
# =============================================================================
def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="End-to-End Lead Generation Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--dry-run", action="store_true", help="Dry run (no writes/sends)")
    parser.add_argument("--discovery-only", action="store_true", help="Skip email sending")
    parser.add_argument("--send-only", action="store_true", help="Only send emails (no discovery)")
    parser.add_argument("--timeout", type=int, default=1800, help="Timeout in seconds (default 1800 = 30 min)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Set up timeout guard
    setup_timeout_guard(args.timeout)

    print(f"\n{'=' * 70}")
    print("YAPMATE LEADS - END-TO-END PIPELINE")
    print(f"{'=' * 70}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  Discovery: {'SKIP' if args.send_only else 'ENABLED'}")
    print(f"  Sending: {'SKIP' if args.discovery_only else 'ENABLED'}")

    # Override config for flags
    if args.dry_run:
        os.environ["DRY_RUN"] = "true"
        os.environ["SEND_ENABLED"] = "false"

    if args.discovery_only:
        os.environ["SEND_ENABLED"] = "false"

    # Load config
    config = PipelineConfig.from_env()

    # Handle send-only mode
    if args.send_only:
        print("\n[MODE] Send-only mode")
        from src.sequencer_sheets import SequencerSheetsManager
        from src.sequencer_email_sender import SequencerEmailSender

        try:
            sheets = SequencerSheetsManager()
            sender = SequencerEmailSender(sheets)
            result = sender.send_batch(
                limit=config.send_limit_per_run,
                dry_run=args.dry_run,
            )
            print(f"\n[SEND] Sent: {result.total_sent}, Failed: {result.total_failed}")
            sys.exit(0 if result.total_sent > 0 else 2)
        except Exception as e:
            print(f"\n[ERROR] Send failed: {e}")
            sys.exit(1)

    # Run full pipeline
    orchestrator = PipelineOrchestrator(config=config)
    result = orchestrator.run()

    # Determine exit code
    if result.stage == PipelineStage.FAILED:
        sys.exit(1)
    elif result.stopped_reason == "targets_not_met":
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
