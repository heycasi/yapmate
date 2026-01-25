"""Queue Generator for City-Trade Sequencing Engine.

Generates a priority-ordered task queue for all city+trade combinations.
Each task represents one scraping session (AM or PM) for one city+trade pair.

Priority formula:
    priority = (tier * 1000) + trade_boost + city_boost + session_offset

Lower priority = runs first.
"""

import uuid
from typing import List, Dict
from datetime import datetime

from src.sequencer_config import (
    TradeTier, TRADES_BY_TIER, TRADE_BOOST, UK_CITIES, CITY_BOOST,
    DEFAULT_QUEUE_CONFIG
)
from src.sequencer_models import QueueTask, TaskStatus, SessionType
from src.sequencer_sheets import SequencerSheetsManager


def calculate_priority(
    tier: TradeTier,
    trade: str,
    city: str,
    session: SessionType,
    config = DEFAULT_QUEUE_CONFIG
) -> int:
    """
    Calculate task priority.

    Lower priority number = higher priority = runs first.

    Args:
        tier: Trade tier (1, 2, or 3)
        trade: Trade name
        city: City name
        session: AM or PM session
        config: Queue configuration

    Returns:
        Priority score (integer)
    """
    # Base priority from tier (Tier 1 = 1000, Tier 2 = 2000, Tier 3 = 3000)
    base = tier * config.tier_multiplier

    # Trade boost (higher boost = lower priority = runs first)
    trade_boost = TRADE_BOOST.get(trade, 0)

    # City boost (higher boost = lower priority = runs first)
    city_boost = CITY_BOOST.get(city, 0)

    # Session offset (AM = 0, PM = 500)
    session_offset = (
        config.am_session_offset
        if session == SessionType.AM
        else config.pm_session_offset
    )

    # Final priority (subtract boosts since lower = higher priority)
    priority = base - trade_boost - city_boost + session_offset

    return priority


def generate_queue(
    cities: List[str] = None,
    trades_by_tier: Dict[TradeTier, List[str]] = None,
    config = DEFAULT_QUEUE_CONFIG
) -> List[QueueTask]:
    """
    Generate the complete task queue.

    Creates two tasks (AM and PM) for each city+trade combination,
    sorted by priority.

    Args:
        cities: List of cities (defaults to UK_CITIES)
        trades_by_tier: Dict of tier -> trade list (defaults to TRADES_BY_TIER)
        config: Queue configuration

    Returns:
        List of QueueTask objects sorted by priority
    """
    cities = cities or UK_CITIES
    trades_by_tier = trades_by_tier or TRADES_BY_TIER

    tasks = []
    created_at = datetime.utcnow()

    print(f"Generating queue for {len(cities)} cities...")

    for tier, trades in trades_by_tier.items():
        print(f"  Tier {tier}: {len(trades)} trades")

        for trade in trades:
            for city in cities:
                # Create AM task
                am_priority = calculate_priority(tier, trade, city, SessionType.AM, config)
                am_task = QueueTask(
                    task_id=str(uuid.uuid4()),
                    trade=trade,
                    city=city,
                    session=SessionType.AM,
                    priority=am_priority,
                    tier=int(tier),
                    status=TaskStatus.PENDING,
                    created_at=created_at,
                )
                tasks.append(am_task)

                # Create PM task
                pm_priority = calculate_priority(tier, trade, city, SessionType.PM, config)
                pm_task = QueueTask(
                    task_id=str(uuid.uuid4()),
                    trade=trade,
                    city=city,
                    session=SessionType.PM,
                    priority=pm_priority,
                    tier=int(tier),
                    status=TaskStatus.PENDING,
                    created_at=created_at,
                )
                tasks.append(pm_task)

    # Sort by priority (lower = higher priority)
    tasks.sort(key=lambda t: t.priority)

    print(f"Generated {len(tasks)} total tasks")
    return tasks


def rebuild_queue(sheets: SequencerSheetsManager, clear_existing: bool = True) -> int:
    """
    Rebuild the queue in Google Sheets.

    Args:
        sheets: Sheets manager instance
        clear_existing: If True, clear existing queue before adding

    Returns:
        Number of tasks added
    """
    print("\n" + "=" * 60)
    print("REBUILDING TASK QUEUE")
    print("=" * 60)

    # Generate new queue
    tasks = generate_queue()

    # Clear existing queue if requested
    if clear_existing:
        print("\nClearing existing queue...")
        sheets.clear_queue()

    # Append new tasks
    print(f"\nAdding {len(tasks)} tasks to queue...")
    added = sheets.append_queue_tasks(tasks)

    print(f"\nQueue rebuilt: {added} tasks added")
    print("=" * 60)

    return added


def get_queue_stats(sheets: SequencerSheetsManager) -> Dict:
    """
    Get statistics about the current queue.

    Args:
        sheets: Sheets manager instance

    Returns:
        Dict with queue statistics
    """
    pending = sheets.get_pending_tasks(limit=10000)

    # Count by status
    status_counts = {}
    tier_counts = {}
    trade_counts = {}
    city_counts = {}

    for task in pending:
        # By tier
        tier_counts[task.tier] = tier_counts.get(task.tier, 0) + 1

        # By trade
        trade_counts[task.trade] = trade_counts.get(task.trade, 0) + 1

        # By city
        city_counts[task.city] = city_counts.get(task.city, 0) + 1

    return {
        "total_pending": len(pending),
        "by_tier": tier_counts,
        "by_trade": dict(sorted(trade_counts.items(), key=lambda x: -x[1])[:10]),
        "by_city": dict(sorted(city_counts.items(), key=lambda x: -x[1])[:10]),
        "next_task": pending[0] if pending else None,
    }


# =============================================================================
# CLI
# =============================================================================

def main():
    """CLI entry point for queue generation."""
    import argparse
    import os
    import sys
    from pathlib import Path
    from dotenv import load_dotenv

    # Add parent directory to path
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    sys.path.insert(0, str(project_dir))
    os.chdir(project_dir)

    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Generate or manage the task queue for lead generation"
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Rebuild the queue (clears existing)"
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show queue statistics"
    )
    parser.add_argument(
        "--preview",
        type=int,
        default=0,
        help="Preview first N tasks without writing"
    )

    args = parser.parse_args()

    if args.preview:
        print("\n" + "=" * 60)
        print("QUEUE PREVIEW (not writing to sheets)")
        print("=" * 60)

        tasks = generate_queue()
        print(f"\nFirst {args.preview} tasks by priority:")
        print("-" * 60)

        for i, task in enumerate(tasks[:args.preview], 1):
            print(f"{i:3}. [{task.priority:4}] {task.trade} in {task.city} ({task.session.value})")
            print(f"      Tier {task.tier}, Task ID: {task.task_id[:8]}...")

        print("-" * 60)
        return

    # Connect to sheets
    print("Connecting to Google Sheets...")
    sheets = SequencerSheetsManager()
    sheets.ensure_all_tabs()

    if args.rebuild:
        rebuild_queue(sheets)
        return

    if args.stats:
        stats = get_queue_stats(sheets)
        print("\n" + "=" * 60)
        print("QUEUE STATISTICS")
        print("=" * 60)
        print(f"Total pending: {stats['total_pending']}")
        print(f"\nBy tier: {stats['by_tier']}")
        print(f"\nTop trades: {stats['by_trade']}")
        print(f"\nTop cities: {stats['by_city']}")
        if stats['next_task']:
            t = stats['next_task']
            print(f"\nNext task: {t.trade} in {t.city} ({t.session.value})")
        print("=" * 60)
        return

    # Default: show help
    parser.print_help()


if __name__ == "__main__":
    main()
