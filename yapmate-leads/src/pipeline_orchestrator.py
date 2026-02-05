"""End-to-End Pipeline Orchestrator.

This module implements the fully automated lead generation pipeline that:
1. Runs yield-target discovery until targets are met or limits reached
2. Automatically triggers email sending when targets are met
3. Provides detailed observability and diagnostics
4. Never silently degrades - fails loud with clear errors

Usage:
    from src.pipeline_orchestrator import PipelineOrchestrator
    orchestrator = PipelineOrchestrator(sheets)
    result = orchestrator.run()
"""

import os
import time
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum

from src.config import get_config
from src.secrets import run_mandatory_preflight, SecretValidationError
from src.sequencer_sheets import SequencerSheetsManager, get_write_stats
from src.sequencer_models import EnhancedLead, SessionType
from src.task_runner import TaskRunner
from src.yield_target_runner import YieldTargetRunner, YieldTargetResult, IterationStats, PivotAction
from src.website_email_extractor import WebsiteEmailExtractor, BatchDiscoveryStats
from src.enricher import LeadEnricher, OpenAIKeyError


class PipelineStage(Enum):
    """Pipeline execution stages."""
    PREFLIGHT = "preflight"
    DISCOVERY = "discovery"
    ENRICHMENT = "enrichment"
    ELIGIBILITY = "eligibility"
    STORAGE = "storage"
    SENDING = "sending"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class WebsiteExtractionDiagnostics:
    """Diagnostics for website email extraction (no PII)."""
    leads_with_websites: int = 0
    sites_attempted: int = 0
    sites_reachable: int = 0
    sites_timeout: int = 0
    sites_blocked: int = 0
    sites_error: int = 0
    pages_crawled: int = 0
    emails_by_method: Dict[str, int] = field(default_factory=dict)
    top_failure_reasons: Dict[str, int] = field(default_factory=dict)

    def log_summary(self):
        """Log diagnostics summary (safe - no PII)."""
        print(f"\n{'─' * 50}")
        print("WEBSITE EXTRACTION DIAGNOSTICS")
        print(f"{'─' * 50}")
        print(f"  Leads with websites: {self.leads_with_websites}")
        print(f"  Sites attempted: {self.sites_attempted}")
        print(f"  Sites reachable: {self.sites_reachable}")
        print(f"  Sites timeout: {self.sites_timeout}")
        print(f"  Sites blocked (403/captcha): {self.sites_blocked}")
        print(f"  Sites error (other): {self.sites_error}")
        print(f"  Total pages crawled: {self.pages_crawled}")
        print(f"\n  Emails found by method:")
        for method, count in sorted(self.emails_by_method.items(), key=lambda x: -x[1]):
            print(f"    {method}: {count}")
        if self.top_failure_reasons:
            print(f"\n  Top 5 failure reasons:")
            sorted_reasons = sorted(self.top_failure_reasons.items(), key=lambda x: -x[1])[:5]
            for reason, count in sorted_reasons:
                print(f"    {reason}: {count}")
        print(f"{'─' * 50}")


@dataclass
class PipelineResult:
    """Result of end-to-end pipeline execution."""
    success: bool = False
    stage: PipelineStage = PipelineStage.PREFLIGHT

    # Discovery metrics
    iterations_run: int = 0
    total_leads: int = 0
    total_emails: int = 0
    email_rate: float = 0.0
    send_eligible: int = 0

    # Enrichment metrics
    leads_enriched: int = 0
    enrichment_failures: int = 0

    # Sending metrics
    emails_sent: int = 0
    emails_failed: int = 0

    # Timing
    total_runtime_seconds: float = 0.0
    discovery_time: float = 0.0
    enrichment_time: float = 0.0
    sending_time: float = 0.0

    # Diagnostics
    yield_result: Optional[YieldTargetResult] = None
    website_diagnostics: Optional[WebsiteExtractionDiagnostics] = None
    iteration_stats: List[IterationStats] = field(default_factory=list)

    # Error info
    error_message: Optional[str] = None
    stopped_reason: str = ""

    def log_final_summary(self):
        """Log comprehensive final summary."""
        print(f"\n{'=' * 70}")
        print("PIPELINE FINAL SUMMARY")
        print(f"{'=' * 70}")
        print(f"  Status: {'SUCCESS' if self.success else 'FAILED'}")
        print(f"  Final stage: {self.stage.value}")
        print(f"  Stopped reason: {self.stopped_reason or 'completed'}")

        print(f"\n  DISCOVERY:")
        print(f"    Iterations: {self.iterations_run}")
        print(f"    Total leads: {self.total_leads}")
        print(f"    Total emails: {self.total_emails}")
        print(f"    Email rate: {self.email_rate:.1%}")
        print(f"    Send eligible: {self.send_eligible}")

        print(f"\n  ENRICHMENT:")
        print(f"    Enriched: {self.leads_enriched}")
        print(f"    Failures: {self.enrichment_failures}")

        print(f"\n  SENDING:")
        print(f"    Sent: {self.emails_sent}")
        print(f"    Failed: {self.emails_failed}")

        print(f"\n  TIMING:")
        print(f"    Discovery: {self.discovery_time:.1f}s")
        print(f"    Enrichment: {self.enrichment_time:.1f}s")
        print(f"    Sending: {self.sending_time:.1f}s")
        print(f"    Total: {self.total_runtime_seconds:.1f}s")

        if self.error_message:
            print(f"\n  ERROR: {self.error_message}")

        print(f"{'=' * 70}")


@dataclass
class PipelineConfig:
    """Configuration for the end-to-end pipeline."""

    # Target thresholds
    target_leads_total: int = 200
    target_emails_min: int = 30
    target_email_rate_min: float = 0.10

    # Safety limits
    max_iterations: int = 8
    max_runtime_seconds: int = 2700  # 45 minutes (leave 15 min for sending)

    # Pivot strategies
    enable_deep_crawl: bool = True
    enable_query_variants: bool = True
    enable_social_fallback: bool = True
    max_pages_per_domain: int = 6

    # Pipeline control
    pipeline_enabled: bool = True
    send_enabled: bool = False
    send_limit_per_run: int = 10
    daily_limit: int = 50

    # Warmup
    warmup_enabled: bool = True

    # Auto-approve
    auto_approve_enabled: bool = True

    # Heartbeat
    heartbeat_interval_seconds: int = 20

    @classmethod
    def from_env(cls) -> "PipelineConfig":
        """Load configuration from environment variables with defaults."""
        def parse_bool(name: str, default: bool) -> bool:
            val = os.getenv(name, "").strip().lower()
            if not val:
                return default
            return val in ("true", "1", "yes", "on")

        def parse_int(name: str, default: int) -> int:
            val = os.getenv(name, "").strip()
            if not val:
                return default
            try:
                return int(val)
            except ValueError:
                return default

        def parse_float(name: str, default: float) -> float:
            val = os.getenv(name, "").strip()
            if not val:
                return default
            try:
                return float(val)
            except ValueError:
                return default

        return cls(
            target_leads_total=parse_int("TARGET_LEADS_TOTAL", 200),
            target_emails_min=parse_int("TARGET_EMAILS_MIN", 30),
            target_email_rate_min=parse_float("TARGET_EMAIL_RATE_MIN", 0.10),
            max_iterations=parse_int("MAX_ITERATIONS", 8),
            max_runtime_seconds=parse_int("MAX_RUNTIME_SECONDS", 2700),
            enable_deep_crawl=parse_bool("ENABLE_DEEP_CRAWL", True),
            enable_query_variants=parse_bool("ENABLE_QUERY_VARIANTS", True),
            enable_social_fallback=parse_bool("ENABLE_SOCIAL_FALLBACK", True),
            max_pages_per_domain=parse_int("MAX_PAGES_PER_DOMAIN", 6),
            pipeline_enabled=parse_bool("PIPELINE_ENABLED", True),
            send_enabled=parse_bool("SEND_ENABLED", False),
            send_limit_per_run=parse_int("SEND_LIMIT_PER_RUN", 10),
            daily_limit=parse_int("DAILY_LIMIT", 50),
            warmup_enabled=parse_bool("WARMUP_ENABLED", True),
            auto_approve_enabled=parse_bool("AUTO_APPROVE_ENABLED", True),
            heartbeat_interval_seconds=parse_int("HEARTBEAT_INTERVAL_SECONDS", 20),
        )

    def log_config(self):
        """Log configuration (safe)."""
        print(f"\n{'─' * 50}")
        print("PIPELINE CONFIGURATION")
        print(f"{'─' * 50}")
        print(f"  Targets:")
        print(f"    target_leads_total: {self.target_leads_total}")
        print(f"    target_emails_min: {self.target_emails_min}")
        print(f"    target_email_rate_min: {self.target_email_rate_min:.0%}")
        print(f"  Limits:")
        print(f"    max_iterations: {self.max_iterations}")
        print(f"    max_runtime_seconds: {self.max_runtime_seconds}")
        print(f"  Strategies:")
        print(f"    enable_deep_crawl: {self.enable_deep_crawl}")
        print(f"    enable_query_variants: {self.enable_query_variants}")
        print(f"    enable_social_fallback: {self.enable_social_fallback}")
        print(f"    max_pages_per_domain: {self.max_pages_per_domain}")
        print(f"  Pipeline:")
        print(f"    pipeline_enabled: {self.pipeline_enabled}")
        print(f"    send_enabled: {self.send_enabled}")
        print(f"    send_limit_per_run: {self.send_limit_per_run}")
        print(f"    daily_limit: {self.daily_limit}")
        print(f"    auto_approve_enabled: {self.auto_approve_enabled}")
        print(f"{'─' * 50}")


class HeartbeatLogger:
    """Background heartbeat logger to show activity during long operations."""

    def __init__(self, interval_seconds: int = 20):
        self.interval = interval_seconds
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._operation: str = "working"
        self._start_time: float = 0

    def start(self, operation: str = "working"):
        """Start heartbeat logging."""
        self._operation = operation
        self._start_time = time.time()
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Stop heartbeat logging."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1)

    def update_operation(self, operation: str):
        """Update the current operation name."""
        self._operation = operation

    def _heartbeat_loop(self):
        """Background loop that prints heartbeats."""
        while not self._stop_event.wait(self.interval):
            elapsed = time.time() - self._start_time
            print(f"  [HEARTBEAT] {self._operation}... ({elapsed:.0f}s elapsed)", flush=True)


class PipelineOrchestrator:
    """
    Orchestrates the end-to-end lead generation pipeline.

    Flow:
    1. Preflight checks (secrets, sheets connection)
    2. Get next task from queue
    3. Run yield-target discovery loop
    4. Enrich leads with AI
    5. Evaluate eligibility (auto-approve if enabled)
    6. Store leads to sheets
    7. Trigger email sending if targets met and enabled
    8. Log summary and alert if needed
    """

    def __init__(
        self,
        sheets: Optional[SequencerSheetsManager] = None,
        config: Optional[PipelineConfig] = None,
    ):
        """
        Initialize the pipeline orchestrator.

        Args:
            sheets: Sheets manager (created if not provided)
            config: Pipeline config (loaded from env if not provided)
        """
        self.sheets = sheets
        self.config = config or PipelineConfig.from_env()
        self.result = PipelineResult()
        self.heartbeat = HeartbeatLogger(self.config.heartbeat_interval_seconds)

        # Will be initialized during preflight
        self._task_runner: Optional[TaskRunner] = None
        self._start_time: float = 0

    def _check_runtime_limit(self) -> bool:
        """Check if runtime limit has been exceeded."""
        elapsed = time.time() - self._start_time
        return elapsed >= self.config.max_runtime_seconds

    def _log_stage(self, stage: PipelineStage, message: str = ""):
        """Log stage transition."""
        elapsed = time.time() - self._start_time
        self.result.stage = stage
        print(f"\n[{elapsed:.0f}s] === STAGE: {stage.value.upper()} ===" + (f" {message}" if message else ""), flush=True)

    def run_preflight(self) -> bool:
        """
        Run mandatory preflight checks.

        Returns:
            True if all checks pass, False otherwise
        """
        self._log_stage(PipelineStage.PREFLIGHT)

        try:
            # Validate all secrets
            preflight = run_mandatory_preflight(
                require_openai=True,
                require_apify=True,
                require_resend=self.config.send_enabled,
                require_sheets=True,
            )

            # Initialize sheets if not provided
            if not self.sheets:
                self.sheets = SequencerSheetsManager()
                self.sheets.ensure_all_tabs()

            # Initialize task runner with validated credentials
            self._task_runner = TaskRunner(self.sheets)

            print("[PREFLIGHT] All checks passed", flush=True)
            return True

        except SecretValidationError as e:
            self.result.error_message = f"Preflight failed: {e}"
            print(f"[PREFLIGHT] FAILED: {e}", flush=True)
            return False
        except Exception as e:
            self.result.error_message = f"Preflight failed: {e}"
            print(f"[PREFLIGHT] FAILED: {e}", flush=True)
            return False

    def run_discovery(self) -> Tuple[List[EnhancedLead], bool]:
        """
        Run yield-target discovery with multi-iteration support.

        Loops through multiple city+trade tasks until targets are met,
        max_iterations reached, or max_runtime exceeded.

        Returns:
            Tuple of (leads, success)
        """
        self._log_stage(PipelineStage.DISCOVERY)
        discovery_start = time.time()

        self.heartbeat.start("Running discovery")

        # Accumulate results across iterations
        total_leads = 0
        total_emails = 0
        total_enriched = 0
        total_eligible = 0

        try:
            session = self._task_runner.determine_session(manual=True)

            for iteration in range(1, self.config.max_iterations + 1):
                elapsed = time.time() - discovery_start
                if elapsed >= self.config.max_runtime_seconds:
                    print(f"[DISCOVERY] Max runtime ({self.config.max_runtime_seconds}s) reached after {iteration - 1} iterations", flush=True)
                    break

                print(f"\n{'─' * 50}", flush=True)
                print(f"[DISCOVERY] Iteration {iteration}/{self.config.max_iterations}", flush=True)
                print(f"  Elapsed: {elapsed:.0f}s / {self.config.max_runtime_seconds}s", flush=True)
                print(f"  Running totals: {total_emails} emails from {total_leads} leads", flush=True)
                print(f"{'─' * 50}", flush=True)

                # Get next task from queue
                task = self._task_runner.get_next_task(session)
                if not task:
                    print("[DISCOVERY] No more tasks in queue", flush=True)
                    self.result.stopped_reason = "no_tasks"
                    break

                print(f"[DISCOVERY] Task: {task.trade} in {task.city}", flush=True)
                self.heartbeat.update_operation(f"Scraping {task.trade} in {task.city} (iter {iteration})")

                # Run the task
                task_result = self._task_runner.run_task(task)

                if task_result:
                    total_leads += task_result.leads_found
                    total_enriched += task_result.leads_enriched
                    total_eligible += task_result.leads_eligible
                    # leads_eligible is the count with emails
                    total_emails += task_result.leads_eligible

                    self.result.iterations_run = iteration
                    self.result.total_leads = total_leads
                    self.result.total_emails = total_emails
                    self.result.email_rate = total_emails / max(1, total_leads)
                    self.result.send_eligible = total_eligible
                    self.result.leads_enriched = total_enriched

                    print(f"[DISCOVERY] After iteration {iteration}: {total_emails} emails, {self.result.email_rate:.1%} rate", flush=True)

                    # Check if targets met
                    targets_met = (
                        self.result.total_emails >= self.config.target_emails_min and
                        self.result.email_rate >= self.config.target_email_rate_min
                    )

                    if targets_met:
                        self.result.stopped_reason = "target_met"
                        print(f"[DISCOVERY] Targets met: {total_emails} emails, {self.result.email_rate:.1%} rate", flush=True)
                        break
                else:
                    print(f"[DISCOVERY] Iteration {iteration} returned no result, stopping early to save API costs", flush=True)
                    self.result.stopped_reason = "no_results"
                    break

            # Final summary
            self.result.discovery_time = time.time() - discovery_start
            if not self.result.stopped_reason or self.result.stopped_reason not in ("target_met", "no_tasks"):
                self.result.stopped_reason = "targets_not_met"
                print(f"[DISCOVERY] Targets NOT met after {self.result.iterations_run} iterations: {total_emails} emails, {self.result.email_rate:.1%} rate", flush=True)

            leads = self.sheets.get_leads_by_status("NEW", limit=1000)
            return leads, True

        except OpenAIKeyError as e:
            self.result.error_message = f"OpenAI authentication failed: {e}"
            self.result.stopped_reason = "openai_auth_error"
            print(f"[DISCOVERY] HARD FAILURE - OpenAI auth error: {e}", flush=True)
            return [], False
        except Exception as e:
            self.result.error_message = f"Discovery failed: {e}"
            self.result.stopped_reason = "discovery_error"
            print(f"[DISCOVERY] FAILED: {e}", flush=True)
            return [], False
        finally:
            self.heartbeat.stop()
            self.result.discovery_time = time.time() - discovery_start

    def run_eligibility_fixup(self, leads: List[EnhancedLead]) -> List[EnhancedLead]:
        """
        Fix up eligibility for leads using FULL auto-approve validation.

        Only approves leads that pass ALL checks in auto_approve.check_auto_approval():
        - send_eligible = True
        - Email exists and sanitizes correctly
        - Not a free email provider (gmail, yahoo, etc.)
        - Not a placeholder domain (example.com, etc.)
        - No malformed patterns
        - Domain matches website (soft check)

        Returns:
            Updated leads list
        """
        self._log_stage(PipelineStage.ELIGIBILITY)

        if not self.config.auto_approve_enabled:
            print("[ELIGIBILITY] Auto-approve disabled, skipping fixup", flush=True)
            return leads

        # Import the full auto-approve validation
        from src.auto_approve import check_auto_approval

        approved_count = 0
        rejected_count = 0

        for lead in leads:
            # Skip if already approved or already has send_eligible
            if lead.status == "APPROVED" or lead.send_eligible:
                continue

            # Skip if no email at all
            if not lead.email or not lead.email.strip():
                continue

            # Run FULL auto-approval validation (not just pattern check)
            result = check_auto_approval(
                email=lead.email,
                website=getattr(lead, 'website', None),
                send_eligible=True,  # We're checking if it SHOULD be eligible
                business_name=lead.business_name,
                allow_free_emails=False,
            )

            if result.approved:
                lead.send_eligible = True
                if lead.status == "NEW":
                    lead.status = "APPROVED"
                approved_count += 1
            else:
                rejected_count += 1

        if approved_count > 0 or rejected_count > 0:
            print(f"[ELIGIBILITY] Full validation: {approved_count} approved, {rejected_count} rejected", flush=True)

        if approved_count > 0:
            # Batch update to sheets
            self._batch_update_eligibility(leads)

        return leads

    def _batch_update_eligibility(self, leads: List[EnhancedLead]):
        """Batch update eligibility to sheets with retry."""
        # Collect all updates for true batch write
        updates = []
        for lead in leads:
            if lead.send_eligible and lead.lead_id:
                updates.append({
                    'lead_id': lead.lead_id,
                    'status': lead.status,
                    'send_eligible': True,
                })

        if not updates:
            print("[ELIGIBILITY] No leads to update", flush=True)
            return

        # Use true batch update - single API call
        try:
            updated = self.sheets.batch_update_leads(updates)
            print(f"[ELIGIBILITY] Batch updated {updated} leads to sheets (single API call)", flush=True)
        except Exception as e:
            print(f"[ELIGIBILITY] Batch update failed: {e}", flush=True)
            print("[ELIGIBILITY] Falling back to individual updates with rate limiting...", flush=True)
            # Fallback with rate limiting
            updated = 0
            for i, update in enumerate(updates):
                try:
                    self.sheets.update_lead_status(
                        update['lead_id'],
                        status=update['status'],
                        send_eligible=True,
                    )
                    updated += 1
                    # Rate limit: max 50 writes/minute, so wait 1.5s between writes
                    if i < len(updates) - 1:
                        time.sleep(1.5)
                except Exception as inner_e:
                    print(f"  [WARN] Failed to update lead: {inner_e}", flush=True)
            print(f"[ELIGIBILITY] Fallback updated {updated} leads", flush=True)

    def run_sending(self) -> bool:
        """
        Run email sending if enabled and targets met.

        Returns:
            True if sending succeeded or was skipped, False on error
        """
        self._log_stage(PipelineStage.SENDING)
        sending_start = time.time()

        # Check if sending is enabled
        if not self.config.send_enabled:
            print("[SENDING] Send disabled (SEND_ENABLED=false)", flush=True)
            return True

        if not self.config.pipeline_enabled:
            print("[SENDING] Pipeline disabled (PIPELINE_ENABLED=false)", flush=True)
            return True

        # Check if we have eligible leads
        if self.result.send_eligible == 0:
            print("[SENDING] No eligible leads to send", flush=True)
            return True

        self.heartbeat.start("Sending emails")

        try:
            from src.sequencer_email_sender import SequencerEmailSender

            sender = SequencerEmailSender(self.sheets)

            # Calculate send limit (respecting daily limit)
            send_limit = min(
                self.config.send_limit_per_run,
                self.config.daily_limit,
                self.result.send_eligible,
            )

            print(f"[SENDING] Sending up to {send_limit} emails", flush=True)
            self.heartbeat.update_operation(f"Sending {send_limit} emails")

            # Run sender
            send_result = sender.send_batch(
                limit=send_limit,
                dry_run=False,
                force_run=False,
            )

            self.result.emails_sent = send_result.total_sent
            self.result.emails_failed = send_result.total_failed

            print(f"[SENDING] Sent: {send_result.total_sent}, Failed: {send_result.total_failed}", flush=True)

            if send_result.stopped_reason:
                print(f"[SENDING] Stopped: {send_result.stopped_reason}", flush=True)

            return True

        except Exception as e:
            self.result.error_message = f"Sending failed: {e}"
            print(f"[SENDING] FAILED: {e}", flush=True)
            return False
        finally:
            self.heartbeat.stop()
            self.result.sending_time = time.time() - sending_start

    def run(self) -> PipelineResult:
        """
        Run the complete end-to-end pipeline.

        Returns:
            PipelineResult with full execution details
        """
        self._start_time = time.time()

        print(f"\n{'=' * 70}")
        print("END-TO-END PIPELINE STARTING")
        print(f"{'=' * 70}")
        print(f"  Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Log configuration
        self.config.log_config()

        try:
            # Stage 1: Preflight
            if not self.run_preflight():
                self.result.stage = PipelineStage.FAILED
                self.result.success = False
                self.result.total_runtime_seconds = time.time() - self._start_time
                self.result.log_final_summary()
                return self.result

            # Stage 2: Discovery
            leads, discovery_ok = self.run_discovery()
            if not discovery_ok:
                self.result.stage = PipelineStage.FAILED
                self.result.success = False
                self.result.total_runtime_seconds = time.time() - self._start_time
                self.result.log_final_summary()
                return self.result

            # Stage 3: Eligibility fixup
            if leads:
                leads = self.run_eligibility_fixup(leads)

            # Stage 4: Sending (if enabled and targets met)
            if self.result.stopped_reason == "target_met" and self.config.send_enabled:
                sending_ok = self.run_sending()
                if not sending_ok:
                    # Sending failure is not fatal - log and continue
                    print("[PIPELINE] Sending failed but pipeline continuing", flush=True)

            # Final summary
            self._log_stage(PipelineStage.COMPLETE)
            self.result.success = True
            self.result.total_runtime_seconds = time.time() - self._start_time

            # Log sheets write stats
            write_stats = get_write_stats()
            write_stats.log_summary()

            self.result.log_final_summary()

            return self.result

        except Exception as e:
            self.result.stage = PipelineStage.FAILED
            self.result.success = False
            self.result.error_message = str(e)
            self.result.total_runtime_seconds = time.time() - self._start_time
            print(f"\n[PIPELINE] UNEXPECTED ERROR: {e}", flush=True)
            self.result.log_final_summary()
            return self.result


def run_pipeline() -> PipelineResult:
    """
    Convenience function to run the full pipeline.

    Returns:
        PipelineResult with execution details
    """
    orchestrator = PipelineOrchestrator()
    return orchestrator.run()
