"""Scheduled email sender for morning/evening windows."""

import argparse
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.send_approved import send_approved_leads


def main():
    """Run scheduled send for a specific time window."""
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Send approved emails for a scheduled time window"
    )
    parser.add_argument(
        "--window",
        required=True,
        choices=["morning", "evening"],
        help="Time window: morning or evening"
    )
    args = parser.parse_args()

    # Get limits from env with defaults
    morning_limit = int(os.getenv("MORNING_LIMIT", "10"))
    evening_limit = int(os.getenv("EVENING_LIMIT", "10"))

    # Select limit based on window
    if args.window == "morning":
        limit = morning_limit
    else:
        limit = evening_limit

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("=" * 80)
    print("SCHEDULED SEND")
    print("=" * 80)
    print(f"   Window: {args.window.upper()}")
    print(f"   Limit: {limit}")
    print(f"   Timestamp: {timestamp}")
    print("=" * 80)
    print()

    # Run send with auto=True and the window limit
    result = send_approved_leads(auto=True, limit=limit)

    # Log final summary if we got a result (function may sys.exit on 0 leads)
    if result:
        print()
        print("=" * 80)
        print("SCHEDULED SEND COMPLETE")
        print("=" * 80)
        print(f"   Window: {args.window.upper()}")
        print(f"   Limit: {limit}")
        print(f"   Approved found: {result['total_approved']}")
        print(f"   Processed: {result['processed']}")
        print(f"   Sent: {result['sent']}")
        print(f"   Failed: {result['failed']}")
        print("=" * 80)


if __name__ == "__main__":
    main()
