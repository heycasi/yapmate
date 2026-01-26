#!/usr/bin/env python3
"""
Run a single task with yield target loop.

This script runs the sequencer for a single trade+city combination
with the yield target iteration loop, printing detailed stats.

Usage:
    python scripts/run_task_until_yield.py "Gas Engineer" "Manchester"
    python scripts/run_task_until_yield.py "Plumber" "London" --target-emails 15
    python scripts/run_task_until_yield.py "Electrician" "Glasgow" --max-iterations 3 --dry-run

Environment variables:
    TARGET_LEADS_TOTAL - Target total leads (default: 50)
    TARGET_EMAILS_MIN - Minimum emails required (default: 10)
    TARGET_EMAIL_RATE_MIN - Minimum email rate (default: 0.20)
    MAX_ITERATIONS - Max iterations (default: 5)
    MAX_RUNTIME_SECONDS - Max runtime in seconds (default: 900)
    MAX_PAGES_PER_DOMAIN - Max pages to crawl per domain (default: 6)
"""

import argparse
import sys
import os
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

from dotenv import load_dotenv
load_dotenv()

from src.config import get_config, reload_config, YieldTargetConfig
from src.sequencer_sheets import SequencerSheetsManager
from src.apify_client import ApifyLeadScraper, ApifyTimeoutError
from src.website_email_extractor import WebsiteEmailExtractor
from src.yield_target_runner import YieldTargetRunner, PivotAction, run_yield_target_discovery
from src.sequencer_models import EnhancedLead, TaskStatus
from src.secrets import get_apify_token, get_apify_actor_id, SecretValidationError
import uuid
from datetime import datetime


def create_enhanced_lead(raw_lead, task_id: str) -> EnhancedLead:
    """Convert raw lead to EnhancedLead."""
    return EnhancedLead(
        lead_id=str(uuid.uuid4()),
        business_name=raw_lead.business_name,
        email=raw_lead.email,
        phone=raw_lead.phone,
        website=raw_lead.website,
        trade=raw_lead.trade,
        city=raw_lead.city,
        lead_source=raw_lead.lead_source,
        place_id=raw_lead.raw_data.get("placeId"),
        source_url=raw_lead.raw_data.get("url"),
        task_id=task_id,
        raw_data=raw_lead.raw_data,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Run a single task with yield target loop",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Required arguments
    parser.add_argument(
        "trade",
        help="Trade to search (e.g., 'Gas Engineer', 'Plumber')"
    )
    parser.add_argument(
        "city",
        help="City to search (e.g., 'Manchester', 'London')"
    )

    # Target overrides
    parser.add_argument(
        "--target-emails",
        type=int,
        default=None,
        help="Override TARGET_EMAILS_MIN"
    )
    parser.add_argument(
        "--target-rate",
        type=float,
        default=None,
        help="Override TARGET_EMAIL_RATE_MIN"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=None,
        help="Override MAX_ITERATIONS"
    )
    parser.add_argument(
        "--max-runtime",
        type=int,
        default=None,
        help="Override MAX_RUNTIME_SECONDS"
    )
    parser.add_argument(
        "--max-leads",
        type=int,
        default=50,
        help="Maximum leads to scrape (default: 50)"
    )

    # Flags
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without scraping"
    )
    parser.add_argument(
        "--skip-scrape",
        action="store_true",
        help="Skip Apify scrape, use fake test data"
    )
    parser.add_argument(
        "--no-sheets",
        action="store_true",
        help="Don't write to Google Sheets"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    # Build config
    config = get_config()
    yield_config = YieldTargetConfig(
        target_leads_total=args.max_leads,
        target_emails_min=args.target_emails or config.yield_target.target_emails_min,
        target_email_rate_min=args.target_rate or config.yield_target.target_email_rate_min,
        max_iterations=args.max_iterations or config.yield_target.max_iterations,
        max_runtime_seconds=args.max_runtime or config.yield_target.max_runtime_seconds,
        max_pages_per_domain=config.yield_target.max_pages_per_domain,
        enable_deep_crawl=config.yield_target.enable_deep_crawl,
        enable_query_variants=config.yield_target.enable_query_variants,
        enable_social_fallback=config.yield_target.enable_social_fallback,
        log_iteration_stats=True,
    )

    print("=" * 60)
    print(f"YIELD TARGET TASK RUNNER")
    print("=" * 60)
    print(f"Trade: {args.trade}")
    print(f"City: {args.city}")
    print(f"\nTargets:")
    print(f"  Min emails: {yield_config.target_emails_min}")
    print(f"  Min rate: {yield_config.target_email_rate_min:.0%}")
    print(f"  Max leads: {yield_config.target_leads_total}")
    print(f"\nLimits:")
    print(f"  Max iterations: {yield_config.max_iterations}")
    print(f"  Max runtime: {yield_config.max_runtime_seconds}s")
    print(f"  Max pages/domain: {yield_config.max_pages_per_domain}")
    print(f"\nFeatures:")
    print(f"  Deep crawl: {yield_config.enable_deep_crawl}")
    print(f"  Query variants: {yield_config.enable_query_variants}")
    print(f"  Social fallback: {yield_config.enable_social_fallback}")
    print("=" * 60)

    if args.dry_run:
        print("\nDRY RUN - would execute with above settings")
        return 0

    # Validate Apify credentials (if needed)
    apify_token = None
    apify_actor = None
    if not args.skip_scrape:
        print("\nValidating Apify credentials...")
        try:
            token = get_apify_token(required=True)
            actor = get_apify_actor_id(required=True)
            apify_token = token.value
            apify_actor = actor
            print(f"  Apify: VALID ({token.prefix}...{token.suffix})")
            print(f"  Actor: {actor}")
        except SecretValidationError as e:
            print(f"ERROR: {e}")
            print("Use --skip-scrape to test with fake data")
            return 1

    # Generate task ID
    task_id = str(uuid.uuid4())
    print(f"\nTask ID: {task_id[:8]}...")

    # Step 1: Scrape leads
    print(f"\n[STEP 1] Scraping leads...")
    leads: list[EnhancedLead] = []

    if args.skip_scrape:
        print("  Using fake test data (--skip-scrape)")
        # Create fake leads for testing
        for i in range(10):
            lead = EnhancedLead(
                lead_id=str(uuid.uuid4()),
                business_name=f"Test {args.trade} {i+1}",
                email=None,
                phone=f"0123456789{i}",
                website=f"https://test-{args.trade.lower().replace(' ', '-')}-{i+1}.co.uk" if i % 3 != 0 else None,
                trade=args.trade,
                city=args.city,
                lead_source="Test Data",
                task_id=task_id,
                raw_data={"test": True},
            )
            leads.append(lead)
        print(f"  Created {len(leads)} fake leads")
    else:
        # Real Apify scrape
        scraper = ApifyLeadScraper(
            apify_token,
            apify_actor
        )

        try:
            raw_leads = scraper.scrape_leads(
                trade=args.trade,
                city=args.city,
                max_results=args.max_leads
            )
            print(f"  Found {len(raw_leads)} raw leads")

            for raw_lead in raw_leads:
                lead = create_enhanced_lead(raw_lead, task_id)
                leads.append(lead)

        except ApifyTimeoutError as e:
            print(f"  ERROR: Apify timeout - {e}")
            return 1

    if not leads:
        print("  No leads found - nothing to process")
        return 0

    # Step 2: Run yield target discovery
    print(f"\n[STEP 2] Running yield target discovery loop...")
    updated_leads, result = run_yield_target_discovery(
        leads=leads,
        trade=args.trade,
        city=args.city,
        config=yield_config,
    )

    # Step 3: Summary
    print(f"\n[STEP 3] Final Results")
    print(f"  Success: {result.success}")
    print(f"  Emails found: {result.total_emails}/{result.total_leads}")
    print(f"  Email rate: {result.email_rate:.1%}")
    print(f"  Send eligible: {result.send_eligible}")

    if result.failure_reasons:
        print(f"\n  Failure breakdown:")
        for reason, count in sorted(result.failure_reasons.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {count}")

    # Step 4: Write to sheets (if enabled)
    if not args.no_sheets and updated_leads:
        print(f"\n[STEP 4] Writing to Google Sheets...")
        try:
            sheets = SequencerSheetsManager()
            sheets.ensure_all_tabs()
            sheets.append_leads(updated_leads)
            print(f"  Written {len(updated_leads)} leads to Sheets")
        except Exception as e:
            print(f"  ERROR writing to Sheets: {e}")

    # Return code
    if result.success:
        print("\n✓ Task completed successfully - targets met")
        return 0
    else:
        print(f"\n⚠ Task completed with low yield - {result.stopped_reason}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
