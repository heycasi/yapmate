"""
Deterministic Pipeline Orchestrator for YapMate Leads.

Stages: SCRAPE → NORMALISE → DEDUPE → ENRICH → VALIDATE → CLASSIFY → QUEUE → SEND

Each stage:
- Is isolated
- Writes state to Sheets
- Never hard-exits the process
- Always returns structured output
"""

import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum

from src.config import get_config, Config
from src.reliability import (
    StageResult, safe_execute, with_retry, get_circuit_breaker,
    PipelineError, ErrorType
)


class PipelineStage(Enum):
    """Pipeline stages in execution order."""
    INIT = "INIT"
    SCRAPE = "SCRAPE"
    NORMALISE = "NORMALISE"
    DEDUPE = "DEDUPE"
    ENRICH = "ENRICH"
    VALIDATE = "VALIDATE"
    CLASSIFY = "CLASSIFY"
    QUEUE = "QUEUE"
    SEND = "SEND"
    COMPLETE = "COMPLETE"


@dataclass
class PipelineMetrics:
    """Metrics collected during pipeline run."""
    run_id: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Counts
    leads_scraped: int = 0
    leads_normalised: int = 0
    leads_deduplicated: int = 0
    leads_enriched: int = 0
    leads_valid: int = 0
    leads_eligible: int = 0
    emails_sent: int = 0
    emails_failed: int = 0

    # Quality
    duplicates_found: int = 0
    invalid_emails: int = 0
    enrichment_failures: int = 0

    # Performance
    api_calls: int = 0
    retries: int = 0
    total_duration_ms: int = 0

    # Errors
    errors: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "leads_scraped": self.leads_scraped,
            "leads_normalised": self.leads_normalised,
            "leads_deduplicated": self.leads_deduplicated,
            "leads_enriched": self.leads_enriched,
            "leads_valid": self.leads_valid,
            "leads_eligible": self.leads_eligible,
            "emails_sent": self.emails_sent,
            "emails_failed": self.emails_failed,
            "duplicates_found": self.duplicates_found,
            "invalid_emails": self.invalid_emails,
            "enrichment_failures": self.enrichment_failures,
            "api_calls": self.api_calls,
            "retries": self.retries,
            "total_duration_ms": self.total_duration_ms,
            "errors": self.errors,
        }


@dataclass
class PipelineRun:
    """Result of a complete pipeline run."""
    run_id: str
    success: bool
    current_stage: PipelineStage
    stage_results: Dict[str, StageResult] = field(default_factory=dict)
    metrics: PipelineMetrics = field(default_factory=PipelineMetrics)
    config_snapshot: Dict[str, Any] = field(default_factory=dict)

    def add_stage_result(self, result: StageResult) -> None:
        """Add a stage result and update metrics."""
        self.stage_results[result.stage] = result
        self.metrics.total_duration_ms += result.duration_ms

        if result.error:
            self.metrics.errors.append(result.error.to_dict())

    def log_summary(self) -> None:
        """Log a summary of the pipeline run."""
        print("\n" + "=" * 70)
        print(f"PIPELINE RUN: {self.run_id}")
        print("=" * 70)
        print(f"Status: {'SUCCESS' if self.success else 'FAILED'}")
        print(f"Final Stage: {self.current_stage.value}")
        print(f"Duration: {self.metrics.total_duration_ms}ms")
        print("\nMetrics:")
        print(f"  Leads scraped:   {self.metrics.leads_scraped}")
        print(f"  Leads enriched:  {self.metrics.leads_enriched}")
        print(f"  Leads valid:     {self.metrics.leads_valid}")
        print(f"  Leads eligible:  {self.metrics.leads_eligible}")
        print(f"  Emails sent:     {self.metrics.emails_sent}")
        print(f"  Errors:          {len(self.metrics.errors)}")
        print("=" * 70)


class Pipeline:
    """
    Main pipeline orchestrator.

    Implements graceful degradation - continues even if individual stages fail.
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self.sheets = None
        self.scraper = None
        self.enricher = None
        self._initialized = False

    def _init_services(self) -> StageResult:
        """Initialize all services with graceful degradation."""
        errors = []

        # Initialize Google Sheets (required)
        if self.config.validate()["sheets"]:
            try:
                from src.sequencer_sheets import SequencerSheetsManager
                self.sheets = SequencerSheetsManager()
                print("[INIT] ✓ Google Sheets connected")
            except Exception as e:
                errors.append(f"Sheets: {e}")
                print(f"[INIT] ✗ Google Sheets failed: {e}")
        else:
            errors.append("Sheets: credentials not configured")
            print("[INIT] ✗ Google Sheets: credentials not configured")

        # Initialize Apify scraper (optional)
        if self.config.validate()["apify"] and self.config.pipeline.scrape_enabled:
            try:
                from src.apify_client import ApifyLeadScraper
                self.scraper = ApifyLeadScraper(
                    self.config.api.apify_api_token,
                    self.config.api.apify_actor_id
                )
                print("[INIT] ✓ Apify scraper ready")
            except Exception as e:
                print(f"[INIT] ⚠ Apify scraper failed (will skip scraping): {e}")
        else:
            print("[INIT] ⚠ Apify: credentials not configured (scraping disabled)")

        # Initialize OpenAI enricher (optional)
        if self.config.validate()["openai"] and self.config.pipeline.enrich_enabled:
            try:
                from src.enricher import LeadEnricher
                self.enricher = LeadEnricher(
                    api_key=self.config.api.openai_api_key,
                    model=self.config.api.openai_model,
                    temperature=self.config.api.openai_temperature
                )
                print("[INIT] ✓ OpenAI enricher ready")
            except Exception as e:
                print(f"[INIT] ⚠ OpenAI enricher failed (will skip enrichment): {e}")
        else:
            print("[INIT] ⚠ OpenAI: credentials not configured (enrichment disabled)")

        self._initialized = True

        # Sheets is required - fail if not available
        if self.sheets is None:
            return StageResult(
                stage=PipelineStage.INIT.value,
                success=False,
                error=PipelineError(
                    error_type=ErrorType.CONFIG_ERROR,
                    message="Google Sheets is required but not available",
                    service="sheets",
                    recoverable=False,
                ),
            )

        return StageResult(
            stage=PipelineStage.INIT.value,
            success=True,
            data={"errors": errors},
        )

    def run(self, task: Optional[Dict[str, Any]] = None) -> PipelineRun:
        """
        Execute the full pipeline.

        Args:
            task: Optional task specification (trade, city, etc.)

        Returns:
            PipelineRun with all results and metrics
        """
        import uuid

        run_id = str(uuid.uuid4())[:8]
        metrics = PipelineMetrics(run_id=run_id, started_at=datetime.utcnow())

        pipeline_run = PipelineRun(
            run_id=run_id,
            success=False,
            current_stage=PipelineStage.INIT,
            metrics=metrics,
            config_snapshot={
                "pipeline": {
                    "scrape_enabled": self.config.pipeline.scrape_enabled,
                    "enrich_enabled": self.config.pipeline.enrich_enabled,
                    "send_enabled": self.config.pipeline.send_enabled,
                    "dry_run": self.config.pipeline.dry_run,
                },
                "limits": {
                    "max_scrape": self.config.limits.max_scrape_per_run,
                    "max_enrich": self.config.limits.max_enrich_per_run,
                    "max_send": self.config.limits.max_send_per_day,
                },
            },
        )

        print("\n" + "=" * 70)
        print(f"PIPELINE START: {run_id}")
        print("=" * 70)
        self.config.log_status()

        # Check if pipeline is enabled
        if not self.config.pipeline.pipeline_enabled:
            print("[PIPELINE] Pipeline is disabled. Exiting.")
            pipeline_run.success = True
            return pipeline_run

        # Stage: INIT
        init_result = self._init_services()
        pipeline_run.add_stage_result(init_result)
        if not init_result.success:
            pipeline_run.metrics.completed_at = datetime.utcnow()
            pipeline_run.log_summary()
            return pipeline_run

        pipeline_run.current_stage = PipelineStage.INIT

        # Get next task if not provided
        if task is None:
            task = self._get_next_task()

        if task is None:
            print("[PIPELINE] No tasks available")
            pipeline_run.success = True
            pipeline_run.metrics.completed_at = datetime.utcnow()
            pipeline_run.log_summary()
            return pipeline_run

        print(f"\n[TASK] {task.get('trade', 'Unknown')} in {task.get('city', 'Unknown')}")

        # Stage: SCRAPE
        if self.config.pipeline.scrape_enabled and self.scraper:
            pipeline_run.current_stage = PipelineStage.SCRAPE
            scrape_result = safe_execute(
                PipelineStage.SCRAPE.value,
                self._stage_scrape,
                task,
            )
            pipeline_run.add_stage_result(scrape_result)
            if scrape_result.success and scrape_result.data:
                metrics.leads_scraped = len(scrape_result.data)
        else:
            print("[SCRAPE] Skipped (disabled or not configured)")

        # Stage: NORMALISE
        pipeline_run.current_stage = PipelineStage.NORMALISE
        normalise_result = safe_execute(
            PipelineStage.NORMALISE.value,
            self._stage_normalise,
            pipeline_run.stage_results.get(PipelineStage.SCRAPE.value),
        )
        pipeline_run.add_stage_result(normalise_result)
        if normalise_result.success and normalise_result.data:
            metrics.leads_normalised = len(normalise_result.data)

        # Stage: DEDUPE
        pipeline_run.current_stage = PipelineStage.DEDUPE
        dedupe_result = safe_execute(
            PipelineStage.DEDUPE.value,
            self._stage_dedupe,
            normalise_result.data if normalise_result.success else [],
        )
        pipeline_run.add_stage_result(dedupe_result)
        if dedupe_result.success and dedupe_result.data:
            metrics.leads_deduplicated = len(dedupe_result.data)
            metrics.duplicates_found = metrics.leads_normalised - metrics.leads_deduplicated

        # Stage: ENRICH
        if self.config.pipeline.enrich_enabled and self.enricher:
            pipeline_run.current_stage = PipelineStage.ENRICH
            enrich_result = safe_execute(
                PipelineStage.ENRICH.value,
                self._stage_enrich,
                dedupe_result.data if dedupe_result.success else [],
            )
            pipeline_run.add_stage_result(enrich_result)
            if enrich_result.success and enrich_result.data:
                metrics.leads_enriched = len(enrich_result.data)
        else:
            print("[ENRICH] Skipped (disabled or not configured)")

        # Stage: VALIDATE
        pipeline_run.current_stage = PipelineStage.VALIDATE
        validate_result = safe_execute(
            PipelineStage.VALIDATE.value,
            self._stage_validate,
            pipeline_run,
        )
        pipeline_run.add_stage_result(validate_result)
        if validate_result.success and validate_result.data:
            metrics.leads_valid = validate_result.data.get("valid_count", 0)
            metrics.invalid_emails = validate_result.data.get("invalid_count", 0)

        # Stage: CLASSIFY
        pipeline_run.current_stage = PipelineStage.CLASSIFY
        classify_result = safe_execute(
            PipelineStage.CLASSIFY.value,
            self._stage_classify,
            pipeline_run,
        )
        pipeline_run.add_stage_result(classify_result)
        if classify_result.success and classify_result.data:
            metrics.leads_eligible = classify_result.data.get("eligible_count", 0)

        # Stage: QUEUE
        pipeline_run.current_stage = PipelineStage.QUEUE
        queue_result = safe_execute(
            PipelineStage.QUEUE.value,
            self._stage_queue,
            pipeline_run,
        )
        pipeline_run.add_stage_result(queue_result)

        # Stage: SEND (only if enabled)
        if self.config.pipeline.send_enabled:
            pipeline_run.current_stage = PipelineStage.SEND
            send_result = safe_execute(
                PipelineStage.SEND.value,
                self._stage_send,
                pipeline_run,
            )
            pipeline_run.add_stage_result(send_result)
            if send_result.success and send_result.data:
                metrics.emails_sent = send_result.data.get("sent_count", 0)
                metrics.emails_failed = send_result.data.get("failed_count", 0)
        else:
            print("[SEND] Skipped (disabled)")

        # Complete
        pipeline_run.current_stage = PipelineStage.COMPLETE
        pipeline_run.success = True
        pipeline_run.metrics.completed_at = datetime.utcnow()

        # Log run to sheets
        self._log_run_to_sheets(pipeline_run)

        pipeline_run.log_summary()
        return pipeline_run

    def _get_next_task(self) -> Optional[Dict[str, Any]]:
        """Get the next task from the queue."""
        if not self.sheets:
            return None

        try:
            from src.queue_generator import get_queue_stats
            stats = get_queue_stats(self.sheets)

            if stats.get("next_task"):
                task = stats["next_task"]
                return {
                    "trade": task.trade,
                    "city": task.city,
                    "session": task.session.value if hasattr(task.session, 'value') else str(task.session),
                    "task_id": task.task_id,
                }
            return None
        except Exception as e:
            print(f"[TASK] Failed to get next task: {e}")
            return None

    def _stage_scrape(self, task: Dict[str, Any]) -> List[Any]:
        """Scrape stage - fetch leads from source."""
        if not self.scraper:
            return []

        trade = task.get("trade", "")
        city = task.get("city", "")
        max_results = min(
            task.get("max_results", 50),
            self.config.limits.max_scrape_per_run
        )

        print(f"[SCRAPE] Searching for {trade} in {city} (max {max_results})...")

        leads = self.scraper.scrape_leads(trade, city, max_results)
        print(f"[SCRAPE] Found {len(leads)} leads")

        return leads

    def _stage_normalise(self, scrape_result: Optional[StageResult]) -> List[Any]:
        """Normalise stage - clean and standardise lead data."""
        if not scrape_result or not scrape_result.data:
            return []

        leads = scrape_result.data
        normalised = []

        for lead in leads:
            # Basic normalisation
            if hasattr(lead, 'business_name'):
                lead.business_name = lead.business_name.strip() if lead.business_name else ""
            if hasattr(lead, 'email'):
                lead.email = lead.email.lower().strip() if lead.email else None
            normalised.append(lead)

        print(f"[NORMALISE] Normalised {len(normalised)} leads")
        return normalised

    def _stage_dedupe(self, leads: List[Any]) -> List[Any]:
        """Dedupe stage - remove duplicate leads."""
        if not leads:
            return []

        # Simple dedupe by business name
        seen = set()
        unique = []

        for lead in leads:
            key = lead.business_name.lower() if hasattr(lead, 'business_name') else str(lead)
            if key not in seen:
                seen.add(key)
                unique.append(lead)

        print(f"[DEDUPE] {len(leads)} -> {len(unique)} (removed {len(leads) - len(unique)} duplicates)")
        return unique

    def _stage_enrich(self, leads: List[Any]) -> List[Any]:
        """Enrich stage - add AI-generated content."""
        if not self.enricher or not leads:
            return leads

        # Check circuit breaker
        circuit = get_circuit_breaker("openai")
        if circuit.is_open():
            print("[ENRICH] Circuit breaker open - skipping enrichment")
            return leads

        max_enrich = self.config.limits.max_enrich_per_run
        to_enrich = leads[:max_enrich]

        print(f"[ENRICH] Enriching {len(to_enrich)} leads (limit: {max_enrich})...")

        enriched = self.enricher.enrich_leads(to_enrich)

        # Return original leads if enrichment failed
        if not enriched:
            return leads

        return enriched

    def _stage_validate(self, pipeline_run: PipelineRun) -> Dict[str, int]:
        """Validate stage - check data quality."""
        valid_count = 0
        invalid_count = 0

        # Get leads from previous stages
        leads = []
        for stage_name in [PipelineStage.ENRICH.value, PipelineStage.DEDUPE.value, PipelineStage.NORMALISE.value]:
            result = pipeline_run.stage_results.get(stage_name)
            if result and result.data:
                leads = result.data
                break

        for lead in leads:
            # Check email validity
            email = getattr(lead, 'email', None) if hasattr(lead, 'email') else lead.get('email') if isinstance(lead, dict) else None
            if email and '@' in str(email):
                valid_count += 1
            else:
                invalid_count += 1

        print(f"[VALIDATE] Valid: {valid_count}, Invalid: {invalid_count}")
        return {"valid_count": valid_count, "invalid_count": invalid_count}

    def _stage_classify(self, pipeline_run: PipelineRun) -> Dict[str, int]:
        """Classify stage - determine eligibility for sending."""
        # For now, all valid leads are eligible
        validate_result = pipeline_run.stage_results.get(PipelineStage.VALIDATE.value)
        eligible_count = validate_result.data.get("valid_count", 0) if validate_result and validate_result.data else 0

        print(f"[CLASSIFY] Eligible for sending: {eligible_count}")
        return {"eligible_count": eligible_count}

    def _stage_queue(self, pipeline_run: PipelineRun) -> Dict[str, int]:
        """Queue stage - prepare leads for sending."""
        classify_result = pipeline_run.stage_results.get(PipelineStage.CLASSIFY.value)
        queued_count = classify_result.data.get("eligible_count", 0) if classify_result and classify_result.data else 0

        print(f"[QUEUE] Queued {queued_count} leads for sending")
        return {"queued_count": queued_count}

    def _stage_send(self, pipeline_run: PipelineRun) -> Dict[str, int]:
        """Send stage - deliver emails."""
        if self.config.pipeline.dry_run:
            print("[SEND] Dry run mode - no emails sent")
            return {"sent_count": 0, "failed_count": 0}

        # TODO: Implement actual sending
        print("[SEND] Sending not yet implemented")
        return {"sent_count": 0, "failed_count": 0}

    def _log_run_to_sheets(self, pipeline_run: PipelineRun) -> None:
        """Log the pipeline run to Google Sheets."""
        if not self.sheets:
            return

        try:
            # Log to run_log tab
            self.sheets.log_run(
                run_id=pipeline_run.run_id,
                status="SUCCESS" if pipeline_run.success else "FAILED",
                metrics=pipeline_run.metrics.to_dict(),
            )
        except Exception as e:
            print(f"[LOG] Failed to log run to sheets: {e}")


def run_pipeline(task: Optional[Dict[str, Any]] = None) -> PipelineRun:
    """Convenience function to run the pipeline."""
    pipeline = Pipeline()
    return pipeline.run(task)
