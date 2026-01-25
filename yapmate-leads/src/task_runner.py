"""Task Runner for City-Trade Sequencing Engine.

Pulls tasks from the queue and executes them.
Implements:
- Focus trade logic (same trade for AM + PM on same day)
- Trigger-based session assignment (AM trigger = AM session)
- Scraping via Apify
- Deduplication
- Website email discovery (extracts emails from business websites)
- AI enrichment
- Email eligibility evaluation

Pipeline order:
    Scrape → Dedupe → Website Email Discovery → Enrichment → Eligibility → Storage
"""

import os
import uuid
from typing import Optional, List, Tuple
from datetime import datetime, timedelta

from dotenv import load_dotenv

from src.sequencer_config import (
    DEFAULT_SESSION_CONFIG, DEFAULT_EMAIL_ELIGIBILITY_CONFIG,
    DEFAULT_QUEUE_CONFIG
)
from src.sequencer_models import (
    QueueTask, TaskStatus, SessionType, RunnerState,
    EnhancedLead, DedupeKey, RunLogEntry, DedupeMatchType
)
from src.sequencer_sheets import SequencerSheetsManager
from src.apify_client import ApifyLeadScraper
from src.enricher import LeadEnricher
from src.website_email_extractor import WebsiteEmailExtractor, BatchDiscoveryStats
from src.sequencer_alerts import alert_zero_eligible_leads, alert_task_dead
from src.config import get_config
from src.auto_approve import auto_approve_leads


class TaskRunner:
    """Executes tasks from the queue with focus trade logic."""

    def __init__(self, sheets: SequencerSheetsManager):
        """
        Initialize the task runner.

        Args:
            sheets: Sheets manager instance
        """
        self.sheets = sheets
        self.session_config = DEFAULT_SESSION_CONFIG
        self.queue_config = DEFAULT_QUEUE_CONFIG
        self.email_config = DEFAULT_EMAIL_ELIGIBILITY_CONFIG

        # Load environment
        load_dotenv()

        # Initialize Apify scraper
        apify_token = os.getenv("APIFY_API_TOKEN")
        apify_actor = os.getenv("APIFY_ACTOR_ID")
        if apify_token and apify_actor:
            self.scraper = ApifyLeadScraper(apify_token, apify_actor)
        else:
            self.scraper = None
            print("Warning: APIFY credentials not configured")

        # Initialize AI enricher
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            self.enricher = LeadEnricher(
                api_key=openai_key,
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.8"))
            )
        else:
            self.enricher = None
            print("Warning: OPENAI credentials not configured")

        # Initialize website email extractor
        self.email_extractor = WebsiteEmailExtractor(
            timeout=int(os.getenv("EMAIL_EXTRACTOR_TIMEOUT", "10")),
            max_pages_per_site=int(os.getenv("EMAIL_EXTRACTOR_MAX_PAGES", "3")),
            delay_between_requests=float(os.getenv("EMAIL_EXTRACTOR_DELAY", "0.5")),
            respect_robots_txt=True
        )

        # Load dedupe keys into memory
        self._dedupe_keys = None

    # =========================================================================
    # SESSION DETERMINATION
    # =========================================================================

    def determine_session(self, manual: bool = False) -> SessionType:
        """
        Determine which session type this run is.

        For automated runs: Uses trigger time (when script was started).
        For manual runs: Uses current time against windows.

        Args:
            manual: If True, use time-based window logic

        Returns:
            SessionType (AM or PM)
        """
        now = datetime.now()
        hour = now.hour

        if manual:
            # Manual mode: use time-based windows
            if self.session_config.am_window_start <= hour < self.session_config.am_window_end:
                return SessionType.AM
            elif self.session_config.pm_window_start <= hour < self.session_config.pm_window_end:
                return SessionType.PM
            else:
                # Outside windows, default to PM
                print(f"  Warning: Current hour ({hour}) is outside session windows, defaulting to PM")
                return SessionType.PM
        else:
            # Automated mode: AM trigger = AM session, PM trigger = PM session
            # Simple heuristic: if run before noon, it's AM; otherwise PM
            if hour < 12:
                return SessionType.AM
            else:
                return SessionType.PM

    # =========================================================================
    # FOCUS TRADE LOGIC
    # =========================================================================

    def get_or_set_focus_trade(self, session: SessionType) -> Optional[str]:
        """
        Get the focus trade for today, or set it if this is the first session.

        If enforce_same_trade_per_day is True:
        - AM session: Sets focus_trade to the trade of the first task pulled
        - PM session: Uses the focus_trade set by AM session

        Args:
            session: Current session type

        Returns:
            Focus trade name (or None if not enforcing)
        """
        if not self.session_config.enforce_same_trade_per_day:
            return None

        state = self.sheets.get_runner_state()
        today = datetime.now().strftime("%Y-%m-%d")

        # Check if we have a focus trade for today
        if state.focus_trade_date == today and state.focus_trade_id:
            print(f"  Using focus trade from earlier session: {state.focus_trade_id}")
            return state.focus_trade_id

        # No focus trade for today - will be set after pulling first task
        return None

    def set_focus_trade(self, trade: str):
        """
        Set the focus trade for today.

        Args:
            trade: Trade name to set as focus
        """
        today = datetime.now().strftime("%Y-%m-%d")
        self.sheets.update_focus_trade(trade, today)
        print(f"  Set focus trade for {today}: {trade}")

    # =========================================================================
    # TASK SELECTION
    # =========================================================================

    def get_next_task(self, session: SessionType) -> Optional[QueueTask]:
        """
        Get the next task to run.

        If a focus trade is set for today, only returns tasks for that trade.
        Otherwise, returns the highest priority pending task.

        Args:
            session: Current session type

        Returns:
            QueueTask to run, or None if queue is empty
        """
        focus_trade = self.get_or_set_focus_trade(session)

        if focus_trade:
            # Get tasks for focus trade only
            tasks = self.sheets.get_pending_tasks_for_trade(focus_trade, limit=1)
            if tasks:
                return tasks[0]

            # No more tasks for focus trade - clear focus and get any task
            print(f"  No more tasks for focus trade '{focus_trade}', expanding search")

        # Get highest priority pending task
        tasks = self.sheets.get_pending_tasks(limit=1)
        if tasks:
            task = tasks[0]

            # If this is AM and no focus trade was set, set it now
            if session == SessionType.AM and self.session_config.enforce_same_trade_per_day:
                self.set_focus_trade(task.trade)

            return task

        return None

    # =========================================================================
    # DEDUPLICATION
    # =========================================================================

    def load_dedupe_keys(self):
        """Load dedupe keys into memory for fast lookup."""
        if self._dedupe_keys is None:
            print("  Loading dedupe keys...")
            self._dedupe_keys = self.sheets.load_dedupe_keys()
            total = sum(len(v) for v in self._dedupe_keys.values())
            print(f"  Loaded {total} dedupe keys")

    def check_duplicate(
        self,
        place_id: str = None,
        source_url: str = None,
        email: str = None,
        phone: str = None,
        business_name: str = None,
        city: str = None
    ) -> Tuple[bool, Optional[DedupeMatchType], Optional[str]]:
        """
        Check if a lead is a duplicate using in-memory keys.

        Args:
            place_id: Google Maps place ID
            source_url: Original listing URL
            email: Email address
            phone: Phone number
            business_name: Business name
            city: City name

        Returns:
            Tuple of (is_hard_duplicate, match_type, matched_lead_id)
        """
        self.load_dedupe_keys()

        # Check primary keys (hard block)
        if place_id and place_id.lower() in self._dedupe_keys.get("place_id", {}):
            return (True, DedupeMatchType.PLACE_ID, self._dedupe_keys["place_id"][place_id.lower()])

        if source_url and source_url.lower() in self._dedupe_keys.get("source_url", {}):
            return (True, DedupeMatchType.SOURCE_URL, self._dedupe_keys["source_url"][source_url.lower()])

        # Check secondary keys (hard block)
        if email and email.lower() in self._dedupe_keys.get("email", {}):
            return (True, DedupeMatchType.EMAIL, self._dedupe_keys["email"][email.lower()])

        if phone:
            normalized = phone.replace(" ", "").replace("-", "").lower()
            if normalized in self._dedupe_keys.get("phone", {}):
                return (True, DedupeMatchType.PHONE, self._dedupe_keys["phone"][normalized])

        # Check soft match (flag only, don't block)
        if business_name and city:
            name_city = f"{business_name.lower().strip()}|{city.lower().strip()}"
            if name_city in self._dedupe_keys.get("name_city", {}):
                # Return as NOT a hard duplicate, but with match info
                return (False, DedupeMatchType.NAME_CITY, self._dedupe_keys["name_city"][name_city])

        return (False, None, None)

    def add_dedupe_keys_for_lead(self, lead: EnhancedLead):
        """
        Add dedupe keys for a new lead (to in-memory cache and sheets).

        Args:
            lead: Lead to add keys for
        """
        keys = []

        # Primary keys
        if lead.place_id:
            key = DedupeKey("place_id", lead.place_id.lower(), lead.lead_id)
            keys.append(key)
            self._dedupe_keys.setdefault("place_id", {})[lead.place_id.lower()] = lead.lead_id

        if lead.source_url:
            key = DedupeKey("source_url", lead.source_url.lower(), lead.lead_id)
            keys.append(key)
            self._dedupe_keys.setdefault("source_url", {})[lead.source_url.lower()] = lead.lead_id

        # Secondary keys
        if lead.email:
            key = DedupeKey("email", lead.email.lower(), lead.lead_id)
            keys.append(key)
            self._dedupe_keys.setdefault("email", {})[lead.email.lower()] = lead.lead_id

        if lead.phone:
            normalized = lead.phone.replace(" ", "").replace("-", "").lower()
            key = DedupeKey("phone", normalized, lead.lead_id)
            keys.append(key)
            self._dedupe_keys.setdefault("phone", {})[normalized] = lead.lead_id

        # Soft match key
        name_city = f"{lead.business_name.lower().strip()}|{lead.city.lower().strip()}"
        key = DedupeKey("name_city", name_city, lead.lead_id)
        keys.append(key)
        self._dedupe_keys.setdefault("name_city", {})[name_city] = lead.lead_id

        # Write to sheets
        if keys:
            self.sheets.append_dedupe_keys(keys)

    # =========================================================================
    # EMAIL ELIGIBILITY
    # =========================================================================

    def evaluate_email_eligibility(self, lead: EnhancedLead) -> EnhancedLead:
        """
        Evaluate email eligibility for a lead.

        Sets:
        - send_eligible: True/False
        - eligibility_reason: Why not eligible (if False)
        - generic_address: True if info@, contact@, etc.

        Args:
            lead: Lead to evaluate

        Returns:
            Lead with eligibility fields set
        """
        # No email = not eligible
        if not lead.email:
            lead.send_eligible = False
            lead.eligibility_reason = "No email address"
            return lead

        email_lower = lead.email.lower()

        # Check for invalid patterns (no-reply, etc.) - NOT eligible
        for pattern in self.email_config.invalid_patterns:
            if pattern in email_lower:
                lead.send_eligible = False
                lead.eligibility_reason = f"Invalid pattern: {pattern}"
                return lead

        # Check for blocked domains - NOT eligible
        domain = email_lower.split("@")[-1] if "@" in email_lower else ""
        if domain in self.email_config.blocked_domains:
            lead.send_eligible = False
            lead.eligibility_reason = f"Blocked domain: {domain}"
            return lead

        # Check for generic prefixes - FLAG but still eligible
        for prefix in self.email_config.generic_prefixes:
            if email_lower.startswith(prefix):
                lead.generic_address = True
                break

        # Check if AI hook is required
        if self.email_config.require_ai_hook and not lead.ai_hook:
            lead.send_eligible = False
            lead.eligibility_reason = "No AI hook generated"
            return lead

        # All checks passed - eligible
        lead.send_eligible = True
        lead.eligibility_reason = None
        return lead

    # =========================================================================
    # TASK EXECUTION
    # =========================================================================

    def run_task(self, task: QueueTask) -> RunLogEntry:
        """
        Execute a single task.

        Pipeline steps:
        1. Mark task as in_progress
        2. Scrape leads from Apify
        3. Deduplicate
        4. Website email discovery (extract emails from business websites)
        5. Enrich with AI
        6. Evaluate email eligibility
        7. Save to sheets
        8. Mark task as completed

        Args:
            task: Task to execute

        Returns:
            RunLogEntry with execution results
        """
        run_id = str(uuid.uuid4())
        started_at = datetime.utcnow()

        # Create run log entry
        log_entry = RunLogEntry(
            run_id=run_id,
            task_id=task.task_id,
            trade=task.trade,
            city=task.city,
            session=task.session,
            started_at=started_at,
            status="running"
        )

        print(f"\n{'=' * 60}")
        print(f"TASK: {task.trade} in {task.city} ({task.session.value})")
        print(f"Task ID: {task.task_id}")
        print(f"Run ID: {run_id}")
        print(f"{'=' * 60}")

        # Mark task as in progress
        self.sheets.update_task_status(task.task_id, TaskStatus.IN_PROGRESS)

        try:
            # Step 1: Scrape leads
            print(f"\n[1/5] Scraping leads...")
            if not self.scraper:
                raise Exception("Apify scraper not configured")

            raw_leads = self.scraper.scrape_leads(
                trade=task.trade,
                city=task.city,
                max_results=self.queue_config.leads_per_task
            )
            log_entry.leads_found = len(raw_leads)
            print(f"  Found {len(raw_leads)} raw leads")

            if not raw_leads:
                # No leads found - mark as completed with 0
                self.sheets.update_task_status(
                    task.task_id, TaskStatus.COMPLETED,
                    leads_found=0, leads_after_dedupe=0
                )
                log_entry.status = "completed"
                log_entry.completed_at = datetime.utcnow()
                log_entry.duration_seconds = (log_entry.completed_at - started_at).total_seconds()
                self.sheets.append_run_log(log_entry)
                print(f"\n  No leads found for this combination.")
                return log_entry

            # Step 2: Deduplicate
            print(f"\n[2/5] Deduplicating...")
            unique_leads = []
            duplicates = 0

            for raw_lead in raw_leads:
                # Check dedupe
                is_dup, match_type, matched_id = self.check_duplicate(
                    place_id=raw_lead.raw_data.get("placeId"),
                    source_url=raw_lead.raw_data.get("url"),
                    email=raw_lead.email,
                    phone=raw_lead.phone,
                    business_name=raw_lead.business_name,
                    city=raw_lead.city
                )

                if is_dup:
                    duplicates += 1
                    continue

                # Create EnhancedLead
                lead = EnhancedLead(
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
                    task_id=task.task_id,
                    raw_data=raw_lead.raw_data,
                )

                # Check for soft match
                if match_type == DedupeMatchType.NAME_CITY:
                    lead.soft_match = True
                    lead.soft_match_lead_id = matched_id

                unique_leads.append(lead)

            log_entry.leads_after_dedupe = len(unique_leads)
            print(f"  {duplicates} duplicates removed")
            print(f"  {len(unique_leads)} unique leads")

            if not unique_leads:
                # All duplicates - mark as completed
                self.sheets.update_task_status(
                    task.task_id, TaskStatus.COMPLETED,
                    leads_found=log_entry.leads_found,
                    leads_after_dedupe=0
                )
                log_entry.status = "completed"
                log_entry.completed_at = datetime.utcnow()
                log_entry.duration_seconds = (log_entry.completed_at - started_at).total_seconds()
                self.sheets.append_run_log(log_entry)
                print(f"\n  All leads were duplicates.")
                return log_entry

            # Step 3: Website email discovery
            print(f"\n[3/5] Discovering emails from websites...")
            leads_with_maps_email = 0
            leads_with_website_email = 0
            leads_with_no_email = 0

            for lead in unique_leads:
                # If lead already has email from Maps, mark source and continue
                if lead.email:
                    leads_with_maps_email += 1
                    lead.email_source = "maps"
                    continue

                # Try to discover email from website
                if lead.website:
                    result = self.email_extractor.discover_email(lead.website)

                    if result.discovered_email:
                        leads_with_website_email += 1
                        lead.email = result.discovered_email
                        lead.discovered_email = result.discovered_email
                        lead.email_source = "website"
                        lead.discovery_url = result.discovery_url
                    else:
                        leads_with_no_email += 1
                        lead.email_source = "none"
                else:
                    leads_with_no_email += 1
                    lead.email_source = "none"

            # Log discovery stats
            total_with_email = leads_with_maps_email + leads_with_website_email
            discovery_rate = (total_with_email / len(unique_leads) * 100) if unique_leads else 0
            print(f"  Maps emails: {leads_with_maps_email}")
            print(f"  Website emails: {leads_with_website_email}")
            print(f"  No email: {leads_with_no_email}")
            print(f"  Discovery rate: {discovery_rate:.1f}%")

            # Step 4: Enrich with AI
            print(f"\n[4/5] Enriching with AI...")
            if self.enricher:
                enriched_count = 0
                for lead in unique_leads:
                    try:
                        # Convert to old Lead format for enricher
                        from src.models import Lead
                        old_lead = Lead(
                            business_name=lead.business_name,
                            email=lead.email,
                            phone=lead.phone,
                            website=lead.website,
                            trade=lead.trade,
                            city=lead.city,
                            lead_source=lead.lead_source,
                            raw_data=lead.raw_data
                        )
                        enriched = self.enricher.enrich_lead(old_lead)
                        lead.ai_hook = enriched.ai_hook
                        lead.enriched_at = datetime.utcnow()
                        enriched_count += 1
                    except Exception as e:
                        print(f"  Warning: Failed to enrich {lead.business_name}: {e}")

                log_entry.leads_enriched = enriched_count
                print(f"  Enriched {enriched_count} leads")
            else:
                print("  Skipping enrichment (not configured)")

            # Step 5: Evaluate email eligibility
            print(f"\n[5/5] Evaluating email eligibility...")
            eligible_count = 0
            for lead in unique_leads:
                lead = self.evaluate_email_eligibility(lead)
                if lead.send_eligible:
                    eligible_count += 1

                # Add dedupe keys
                self.add_dedupe_keys_for_lead(lead)

            log_entry.leads_eligible = eligible_count
            print(f"  {eligible_count} leads are send-eligible")

            # Alert if zero send-eligible leads
            if eligible_count == 0 and log_entry.leads_found > 0:
                alert_zero_eligible_leads(
                    run_id=run_id,
                    task_id=task.task_id,
                    trade=task.trade,
                    city=task.city,
                    leads_found=log_entry.leads_found,
                    leads_after_dedupe=log_entry.leads_after_dedupe,
                    leads_enriched=log_entry.leads_enriched,
                    leads_eligible=eligible_count,
                    sheets_manager=self.sheets
                )

            # Save leads to sheets (as NEW status)
            print(f"\n  Saving {len(unique_leads)} leads...")
            self.sheets.append_leads(unique_leads)

            # Step 6: Auto-approval (if enabled)
            config = get_config()
            if config.auto_approve.enabled and eligible_count > 0:
                print(f"\n[6/6] Auto-approving eligible leads...")
                # Get only the eligible leads for auto-approval
                eligible_leads = [l for l in unique_leads if l.send_eligible]
                approval_stats = auto_approve_leads(
                    leads=eligible_leads,
                    sheets_manager=self.sheets,
                    max_per_run=config.auto_approve.max_per_run,
                    allow_free_emails=config.auto_approve.allow_free_emails,
                )
                log_entry.leads_auto_approved = approval_stats.get('approved', 0)
                print(f"  Auto-approved: {approval_stats.get('approved', 0)}")
                print(f"  Auto-rejected: {approval_stats.get('rejected', 0)}")
            else:
                if not config.auto_approve.enabled:
                    print(f"\n[6/6] Auto-approval: DISABLED (set AUTO_APPROVE_ENABLED=true to enable)")
                log_entry.leads_auto_approved = 0

            # Mark task as completed
            self.sheets.update_task_status(
                task.task_id, TaskStatus.COMPLETED,
                leads_found=log_entry.leads_found,
                leads_after_dedupe=log_entry.leads_after_dedupe
            )

            log_entry.status = "completed"
            log_entry.completed_at = datetime.utcnow()
            log_entry.duration_seconds = (log_entry.completed_at - started_at).total_seconds()

            print(f"\n{'=' * 60}")
            print(f"TASK COMPLETED")
            print(f"  Leads found: {log_entry.leads_found}")
            print(f"  After dedupe: {log_entry.leads_after_dedupe}")
            print(f"  Enriched: {log_entry.leads_enriched}")
            print(f"  Send-eligible: {log_entry.leads_eligible}")
            print(f"  Duration: {log_entry.duration_seconds:.1f}s")
            print(f"{'=' * 60}")

        except Exception as e:
            # Task failed
            error_msg = str(e)
            print(f"\n  ERROR: {error_msg}")

            self.sheets.update_task_status(
                task.task_id, TaskStatus.FAILED,
                error_message=error_msg
            )

            log_entry.status = "failed"
            log_entry.error_message = error_msg
            log_entry.completed_at = datetime.utcnow()
            log_entry.duration_seconds = (log_entry.completed_at - started_at).total_seconds()

            # Alert on task failure
            alert_task_dead(
                task_id=task.task_id,
                trade=task.trade,
                city=task.city,
                session=task.session.value,
                last_error=error_msg,
                retry_count=1,  # No retry logic currently, treat as immediate failure
                sheets_manager=self.sheets
            )

        # Append run log
        self.sheets.append_run_log(log_entry)

        return log_entry

    # =========================================================================
    # MAIN ENTRY POINT
    # =========================================================================

    def run(self, manual: bool = False) -> Optional[RunLogEntry]:
        """
        Run the next task from the queue.

        Args:
            manual: If True, use time-based session windows

        Returns:
            RunLogEntry for the executed task, or None if no task found
        """
        # Determine session
        session = self.determine_session(manual=manual)
        print(f"\nSession type: {session.value}")

        # Get next task
        print("Finding next task...")
        task = self.get_next_task(session)

        if not task:
            print("No pending tasks in queue.")
            return None

        # Run the task
        return self.run_task(task)


# =============================================================================
# CLI
# =============================================================================

def main():
    """CLI entry point for task runner."""
    import argparse
    import sys
    from pathlib import Path

    # Add parent directory to path
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    sys.path.insert(0, str(project_dir))
    os.chdir(project_dir)

    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Run the next task from the lead generation queue"
    )
    parser.add_argument(
        "--manual",
        action="store_true",
        help="Use time-based session windows (for manual runs)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without executing"
    )

    args = parser.parse_args()

    # Connect to sheets
    print("Connecting to Google Sheets...")
    sheets = SequencerSheetsManager()
    sheets.ensure_all_tabs()

    # Create runner
    runner = TaskRunner(sheets)

    if args.dry_run:
        session = runner.determine_session(manual=args.manual)
        print(f"\nDRY RUN - Session type: {session.value}")

        task = runner.get_next_task(session)
        if task:
            print(f"\nWould execute task:")
            print(f"  Trade: {task.trade}")
            print(f"  City: {task.city}")
            print(f"  Session: {task.session.value}")
            print(f"  Priority: {task.priority}")
            print(f"  Task ID: {task.task_id}")
        else:
            print("\nNo pending tasks found.")
        return

    # Run the task
    result = runner.run(manual=args.manual)

    if result:
        print(f"\nRun completed: {result.status}")
    else:
        print("\nNo tasks to run.")


if __name__ == "__main__":
    main()
