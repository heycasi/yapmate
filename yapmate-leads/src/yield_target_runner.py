"""Yield Target Runner for Proactive Lead Discovery.

This module implements the target-driven iteration loop that ensures
tasks don't complete with 0 emails without trying smart pivots.

Features:
- Iterative discovery with configurable targets
- Pivot strategies: deeper crawl, query variants
- Detailed observability logging
- Safety limits (max iterations, max runtime)
"""

import time
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from src.config import get_config, TRADE_SYNONYMS, YieldTargetConfig
from src.website_email_extractor import WebsiteEmailExtractor, BatchDiscoveryStats
from src.sequencer_models import EnhancedLead


class PivotAction(Enum):
    """Pivot actions taken during iterations."""
    NONE = "none"
    DEEP_CRAWL = "deep_crawl"  # Enable JSON-LD, more pages
    QUERY_VARIANT = "query_variant"  # Try trade synonyms
    WIDEN_RADIUS = "widen_radius"  # Expand search area
    SOCIAL_FALLBACK = "social_fallback"  # Try Facebook/Instagram


@dataclass
class IterationStats:
    """Statistics for a single iteration."""
    iteration: int = 0
    leads_found: int = 0
    leads_after_dedupe: int = 0
    websites_present: int = 0
    crawls_attempted: int = 0
    domains_scanned: int = 0
    emails_found_total: int = 0
    emails_by_source: Dict[str, int] = field(default_factory=dict)
    email_rate: float = 0.0
    send_eligible_count: int = 0
    pivot_action_taken: str = "none"
    query_used: str = ""
    duration_seconds: float = 0.0


@dataclass
class YieldTargetResult:
    """Result of the yield target loop."""
    success: bool = False  # True if targets met
    iterations_run: int = 0
    total_leads: int = 0
    total_emails: int = 0
    email_rate: float = 0.0
    send_eligible: int = 0
    iteration_stats: List[IterationStats] = field(default_factory=list)
    pivots_attempted: List[str] = field(default_factory=list)
    failure_reasons: Dict[str, int] = field(default_factory=dict)
    stopped_reason: str = ""  # "target_met", "max_iterations", "max_runtime", "no_more_pivots"
    total_runtime_seconds: float = 0.0


class YieldTargetRunner:
    """
    Runs discovery iterations until yield targets are met.

    The runner executes the discovery pipeline in iterations,
    applying pivot strategies when yields are low.
    """

    def __init__(
        self,
        email_extractor: WebsiteEmailExtractor,
        config: Optional[YieldTargetConfig] = None,
    ):
        """
        Initialize the yield target runner.

        Args:
            email_extractor: WebsiteEmailExtractor instance
            config: YieldTargetConfig (uses global config if not provided)
        """
        self.email_extractor = email_extractor
        self.config = config or get_config().yield_target

        # Track state across iterations
        self._start_time: float = 0
        self._iteration: int = 0
        self._all_leads: List[EnhancedLead] = []
        self._result: YieldTargetResult = YieldTargetResult()

    def _check_targets_met(self, stats: BatchDiscoveryStats) -> bool:
        """Check if yield targets have been met."""
        emails_found = (stats.leads_with_maps_email + stats.leads_with_website_email +
                       stats.leads_with_facebook_email + stats.leads_with_instagram_email)

        # Check minimum emails
        if emails_found >= self.config.target_emails_min:
            return True

        # Check email rate
        if stats.total_leads > 0:
            rate = emails_found / stats.total_leads
            if rate >= self.config.target_email_rate_min:
                return True

        return False

    def _check_safety_limits(self) -> Optional[str]:
        """Check if safety limits have been exceeded."""
        # Check iterations
        if self._iteration >= self.config.max_iterations:
            return "max_iterations"

        # Check runtime
        elapsed = time.time() - self._start_time
        if elapsed >= self.config.max_runtime_seconds:
            return "max_runtime"

        return None

    def _get_next_pivot(self, current_iteration: int, current_stats: BatchDiscoveryStats) -> Optional[PivotAction]:
        """
        Determine the next pivot action based on current state.

        Iteration 1: Basic crawl (no pivot)
        Iteration 2: Deep crawl (JSON-LD, more pages)
        Iteration 3+: Query variants (synonyms, wider radius)
        """
        if current_iteration == 1:
            return PivotAction.NONE

        emails_found = (current_stats.leads_with_maps_email + current_stats.leads_with_website_email +
                       current_stats.leads_with_facebook_email + current_stats.leads_with_instagram_email)

        # Iteration 2: Enable deep crawl if emails still low
        if current_iteration == 2 and emails_found < self.config.target_emails_min:
            if self.config.enable_deep_crawl:
                return PivotAction.DEEP_CRAWL

        # Iteration 3+: Try query variants
        if current_iteration >= 3 and self.config.enable_query_variants:
            return PivotAction.QUERY_VARIANT

        return PivotAction.NONE

    def get_trade_synonyms(self, trade: str) -> List[str]:
        """Get synonyms for a trade."""
        trade_lower = trade.lower().strip()

        # Direct match
        if trade_lower in TRADE_SYNONYMS:
            return TRADE_SYNONYMS[trade_lower]

        # Partial match
        for key, synonyms in TRADE_SYNONYMS.items():
            if key in trade_lower or trade_lower in key:
                return synonyms

        # No synonyms found
        return []

    def get_query_variant(self, trade: str, city: str, variant_index: int) -> Optional[str]:
        """
        Generate a query variant for iteration.

        Args:
            trade: Original trade
            city: Original city
            variant_index: Which variant to use (0 = widen radius, 1+ = synonyms)

        Returns:
            Query string or None if no more variants
        """
        synonyms = self.get_trade_synonyms(trade)

        if variant_index == 0:
            # Widen radius by adding "near" qualifier
            return f"{trade} near {city}, UK"

        # Use synonym
        synonym_index = variant_index - 1
        if synonym_index < len(synonyms):
            return f"{synonyms[synonym_index]} in {city}, UK"

        return None

    def run_discovery_iteration(
        self,
        leads: List[EnhancedLead],
        pivot_action: PivotAction = PivotAction.NONE,
    ) -> Tuple[List[EnhancedLead], IterationStats]:
        """
        Run a single discovery iteration on leads.

        Args:
            leads: Leads to process
            pivot_action: Pivot action to apply

        Returns:
            Tuple of (updated_leads, iteration_stats)
        """
        iteration_start = time.time()
        self._iteration += 1

        stats = IterationStats(
            iteration=self._iteration,
            leads_found=len(leads),
            pivot_action_taken=pivot_action.value,
        )

        # Apply pivot-specific configuration
        if pivot_action == PivotAction.DEEP_CRAWL:
            # Increase max pages and enable all extraction methods
            self.email_extractor.max_pages_per_site = self.config.max_pages_per_domain
            self.email_extractor.enable_json_ld = True
            self.email_extractor.enable_obfuscation = True
            self.email_extractor.enable_social_fallback = True

        # Count websites
        stats.websites_present = sum(1 for lead in leads if lead.website)

        # Run batch discovery
        updated_leads, batch_stats = self.email_extractor.discover_emails_batch(
            leads=leads,
            website_field="website",
            email_field="email",
            source_url_field="source_url",
        )

        # Calculate stats
        stats.crawls_attempted = batch_stats.total_pages_crawled
        stats.domains_scanned = batch_stats.total_domains_scanned
        stats.emails_found_total = (batch_stats.leads_with_maps_email +
                                    batch_stats.leads_with_website_email +
                                    batch_stats.leads_with_facebook_email +
                                    batch_stats.leads_with_instagram_email)
        stats.emails_by_source = batch_stats.emails_by_source

        if stats.leads_found > 0:
            stats.email_rate = stats.emails_found_total / stats.leads_found
        else:
            stats.email_rate = 0.0

        stats.duration_seconds = time.time() - iteration_start

        return updated_leads, stats

    def log_iteration_summary(self, stats: IterationStats):
        """Log iteration summary (non-PII)."""
        if not self.config.log_iteration_stats:
            return

        print(f"\n{'─' * 50}")
        print(f"ITERATION {stats.iteration} SUMMARY")
        print(f"{'─' * 50}")
        print(f"  leads_found: {stats.leads_found}")
        print(f"  leads_after_dedupe: {stats.leads_after_dedupe}")
        print(f"  websites_present: {stats.websites_present}")
        print(f"  crawls_attempted: {stats.crawls_attempted}")
        print(f"  domains_scanned: {stats.domains_scanned}")
        print(f"  emails_found_total: {stats.emails_found_total}")
        print(f"  emails_by_source:")
        for source, count in stats.emails_by_source.items():
            print(f"    {source}: {count}")
        print(f"  email_rate: {stats.email_rate:.1%}")
        print(f"  send_eligible_count: {stats.send_eligible_count}")
        print(f"  pivot_action_taken: {stats.pivot_action_taken}")
        if stats.query_used:
            print(f"  query_used: {stats.query_used}")
        print(f"  duration: {stats.duration_seconds:.1f}s")
        print(f"{'─' * 50}")

    def log_final_summary(self, result: YieldTargetResult):
        """Log final task summary."""
        print(f"\n{'=' * 60}")
        print(f"YIELD TARGET FINAL SUMMARY")
        print(f"{'=' * 60}")
        print(f"  Success: {result.success}")
        print(f"  Stopped reason: {result.stopped_reason}")
        print(f"  Iterations run: {result.iterations_run}")
        print(f"  Total leads: {result.total_leads}")
        print(f"  Total emails: {result.total_emails}")
        print(f"  Email rate: {result.email_rate:.1%}")
        print(f"  Send eligible: {result.send_eligible}")
        print(f"  Pivots attempted: {', '.join(result.pivots_attempted) or 'none'}")
        print(f"  Runtime: {result.total_runtime_seconds:.1f}s")

        if result.failure_reasons:
            print(f"\n  Top failure reasons:")
            sorted_reasons = sorted(result.failure_reasons.items(), key=lambda x: -x[1])[:3]
            for reason, count in sorted_reasons:
                print(f"    {reason}: {count}")

        print(f"{'=' * 60}")

    def aggregate_failure_reasons(self, leads: List[EnhancedLead]) -> Dict[str, int]:
        """Aggregate failure reasons from leads."""
        reasons: Dict[str, int] = {}

        for lead in leads:
            if not lead.email:
                if not lead.website:
                    reason = "no_website"
                elif hasattr(lead, 'discovery_error') and lead.discovery_error:
                    reason = lead.discovery_error
                else:
                    reason = "no_email_found"

                reasons[reason] = reasons.get(reason, 0) + 1

        return reasons


# Convenience function for standalone testing
def run_yield_target_discovery(
    leads: List[EnhancedLead],
    trade: str,
    city: str,
    config: Optional[YieldTargetConfig] = None,
) -> Tuple[List[EnhancedLead], YieldTargetResult]:
    """
    Run yield-target discovery on leads.

    Args:
        leads: List of leads to process
        trade: Trade name (for query variants)
        city: City name (for query variants)
        config: Optional config override

    Returns:
        Tuple of (updated_leads, result)
    """
    cfg = config or get_config().yield_target

    # Create extractor with config
    extractor = WebsiteEmailExtractor(
        timeout=10,
        max_pages_per_site=cfg.max_pages_per_domain,
        delay_between_requests=0.5,
        respect_robots_txt=True,
        enable_social_fallback=cfg.enable_social_fallback,
        enable_json_ld=cfg.enable_deep_crawl,
        enable_obfuscation=True,
    )

    runner = YieldTargetRunner(email_extractor=extractor, config=cfg)

    # Run iteration loop
    start_time = time.time()
    runner._start_time = start_time

    result = YieldTargetResult()
    current_leads = leads
    variant_index = 0

    for iteration in range(1, cfg.max_iterations + 1):
        # Check safety limits
        limit_reason = runner._check_safety_limits()
        if limit_reason:
            result.stopped_reason = limit_reason
            break

        # Determine pivot action
        if iteration == 1:
            pivot = PivotAction.NONE
        elif iteration == 2 and cfg.enable_deep_crawl:
            pivot = PivotAction.DEEP_CRAWL
        else:
            pivot = PivotAction.QUERY_VARIANT

        # Run iteration
        current_leads, iter_stats = runner.run_discovery_iteration(
            leads=current_leads,
            pivot_action=pivot,
        )

        result.iteration_stats.append(iter_stats)
        result.iterations_run = iteration

        if pivot != PivotAction.NONE:
            result.pivots_attempted.append(pivot.value)

        # Log iteration
        runner.log_iteration_summary(iter_stats)

        # Calculate cumulative stats
        batch_stats = BatchDiscoveryStats(total_leads=len(current_leads))
        for lead in current_leads:
            if lead.email:
                source = getattr(lead, 'email_source', 'unknown')
                if source == 'maps':
                    batch_stats.leads_with_maps_email += 1
                elif source == 'website':
                    batch_stats.leads_with_website_email += 1
                elif source == 'facebook':
                    batch_stats.leads_with_facebook_email += 1
                elif source == 'instagram':
                    batch_stats.leads_with_instagram_email += 1
            else:
                batch_stats.leads_with_no_email += 1

        # Check if targets met
        if runner._check_targets_met(batch_stats):
            result.success = True
            result.stopped_reason = "target_met"
            break

    # Final stats
    result.total_leads = len(current_leads)
    result.total_emails = sum(1 for lead in current_leads if lead.email)
    result.email_rate = result.total_emails / result.total_leads if result.total_leads > 0 else 0
    result.send_eligible = sum(1 for lead in current_leads if getattr(lead, 'send_eligible', False))
    result.failure_reasons = runner.aggregate_failure_reasons(current_leads)
    result.total_runtime_seconds = time.time() - start_time

    if not result.stopped_reason:
        result.stopped_reason = "no_more_pivots"

    # Log final summary
    runner.log_final_summary(result)

    return current_leads, result
