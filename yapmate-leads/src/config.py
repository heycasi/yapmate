"""
Central Configuration Layer for YapMate Leads Pipeline.

All environment variables and configuration loaded once at startup.
No scattered os.getenv calls throughout the codebase.
"""

import os
import json
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables once
load_dotenv()


@dataclass
class APIConfig:
    """API credentials and endpoints."""
    # OpenAI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"
    openai_temperature: float = 0.8

    # Apify
    apify_api_token: Optional[str] = None
    apify_actor_id: Optional[str] = None

    # Google Sheets
    google_sheet_id: Optional[str] = None
    google_credentials_json: Optional[str] = None

    # Resend
    resend_api_key: Optional[str] = None
    email_from: str = "YapMate <hello@yapmate.co.uk>"
    email_reply_to: str = "support@yapmate.co.uk"

    # Alerts
    alert_to_email: str = "support@yapmate.co.uk"
    alert_from_email: str = "YapMate Leads CI <support@yapmate.co.uk>"


@dataclass
class PipelineConfig:
    """Pipeline control flags."""
    pipeline_enabled: bool = True
    scrape_enabled: bool = True
    enrich_enabled: bool = True
    send_enabled: bool = False
    dry_run: bool = False
    safe_mode: bool = True


@dataclass
class LimitsConfig:
    """Safety limits and caps."""
    # Scraping limits
    max_scrape_per_run: int = 100
    max_results_per_search: int = 50

    # Enrichment limits
    max_enrich_per_run: int = 50

    # Sending limits (target 50/day)
    daily_limit: int = 50           # Target 50 emails/day
    send_limit_per_run: int = 10    # 10 per run x 5 runs = 50/day
    max_send_per_hour: int = 20
    max_per_domain_per_day: int = 5
    max_per_company_per_day: int = 1

    # Rate limiting
    delay_between_sends: float = 0.6  # 0.6s between Resend API calls

    # Batch settings
    batch_update_size: int = 10  # Batch Sheets updates every N sends

    # Warmup ramp (days -> daily limit)
    warmup_ramp: Dict[int, int] = field(default_factory=lambda: {
        1: 10, 2: 15, 3: 20, 4: 30, 5: 40,
        6: 50, 7: 60, 14: 80, 21: 100
    })

    # Cooldowns (seconds)
    domain_cooldown: int = 3600  # 1 hour
    company_cooldown: int = 86400  # 24 hours


@dataclass
class AutoApproveConfig:
    """Auto-approval settings for hands-off operation."""
    # Master toggle
    enabled: bool = False

    # Limits
    max_per_run: int = 25  # Max leads to auto-approve per run

    # Rules
    allow_free_emails: bool = False  # Reject gmail, yahoo, etc. by default

    # Domain matching
    require_domain_match: bool = False  # Soft warning if email != website domain


@dataclass
class YieldTargetConfig:
    """
    Yield target configuration for proactive lead discovery.

    The sequencer runs in iterations until it reaches email yield thresholds
    or hits safety limits.
    """
    # Target thresholds (stop early if met)
    target_leads_total: int = 50          # Target total leads per task
    target_emails_min: int = 10           # Minimum emails required
    target_email_rate_min: float = 0.20   # 20% email discovery rate

    # Safety limits
    max_iterations: int = 5               # Max pivot iterations per task
    max_runtime_seconds: int = 900        # 15 minutes max per task

    # Website crawling
    max_pages_per_domain: int = 6         # Pages to crawl per website

    # Pivot strategies
    enable_deep_crawl: bool = True        # Iteration 2: deeper contact crawl
    enable_query_variants: bool = True    # Iteration 3: query synonyms/radius
    enable_social_fallback: bool = True   # Try Facebook/Instagram if no website

    # Logging
    log_iteration_stats: bool = True      # Log stats after each iteration


# Trade synonyms for query variants (UK trades)
TRADE_SYNONYMS: Dict[str, list] = {
    "gas engineer": ["heating engineer", "boiler repair", "boiler service", "gas safe engineer"],
    "plumber": ["plumbing services", "emergency plumber", "plumbing contractor"],
    "electrician": ["electrical contractor", "electrical services", "sparky"],
    "roofer": ["roofing contractor", "roof repair", "roofing services"],
    "builder": ["building contractor", "construction", "general builder"],
    "carpenter": ["joiner", "woodworker", "cabinet maker"],
    "painter": ["decorator", "painter and decorator", "painting contractor"],
    "locksmith": ["lock services", "emergency locksmith", "security locks"],
    "plasterer": ["plastering services", "rendering", "dry lining"],
    "tiler": ["tiling services", "floor tiler", "wall tiler"],
    "landscaper": ["garden services", "gardener", "landscape gardener"],
    "cleaner": ["cleaning services", "domestic cleaner", "office cleaner"],
    "handyman": ["property maintenance", "odd jobs", "home repairs"],
}


@dataclass
class ScalingConfig:
    """
    Scaling configuration for production ramp-up.

    These are prep configs - NOT enabled by default.
    Enable by setting SCALING_ENABLED=true in environment.
    """
    # Master toggle
    scaling_enabled: bool = False

    # Target goals
    daily_target: int = 100  # Target emails per day at full scale
    ramp_start: int = 10     # Starting emails per day
    ramp_increment: int = 10 # Increase by this many per day
    max_cap: int = 100       # Hard cap (never exceed)

    # Current ramp day (auto-calculated from start date)
    ramp_start_date: Optional[str] = None  # Format: YYYY-MM-DD

    def get_todays_limit(self) -> int:
        """
        Calculate today's limit based on ramp schedule.

        Returns:
            Number of emails allowed today (capped at max_cap)
        """
        if not self.scaling_enabled:
            return self.ramp_start

        if not self.ramp_start_date:
            return self.ramp_start

        try:
            from datetime import datetime
            start = datetime.strptime(self.ramp_start_date, "%Y-%m-%d")
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            days_active = (today - start).days

            if days_active < 0:
                return self.ramp_start

            # Calculate ramped limit
            limit = self.ramp_start + (days_active * self.ramp_increment)
            return min(limit, self.max_cap, self.daily_target)

        except ValueError:
            return self.ramp_start


@dataclass
class RetryConfig:
    """Retry and circuit breaker settings."""
    # Retry counts
    sheets_max_retries: int = 3
    openai_max_retries: int = 2
    http_max_retries: int = 3
    apify_max_retries: int = 2

    # Backoff settings (seconds)
    initial_backoff: float = 1.0
    max_backoff: float = 60.0
    backoff_multiplier: float = 2.0

    # Circuit breaker thresholds
    openai_failure_threshold: int = 5
    sheets_failure_threshold: int = 3
    apify_failure_threshold: int = 3


@dataclass
class Config:
    """Master configuration object."""
    api: APIConfig = field(default_factory=APIConfig)
    pipeline: PipelineConfig = field(default_factory=PipelineConfig)
    limits: LimitsConfig = field(default_factory=LimitsConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    scaling: ScalingConfig = field(default_factory=ScalingConfig)
    auto_approve: AutoApproveConfig = field(default_factory=AutoApproveConfig)
    yield_target: YieldTargetConfig = field(default_factory=YieldTargetConfig)

    # Runtime state
    is_ci: bool = False
    debug: bool = False

    def validate(self) -> Dict[str, bool]:
        """Validate configuration and return status of each component."""
        return {
            "openai": bool(self.api.openai_api_key),
            "apify": bool(self.api.apify_api_token and self.api.apify_actor_id),
            "sheets": bool(self.api.google_sheet_id and self.api.google_credentials_json),
            "resend": bool(self.api.resend_api_key),
        }

    def log_status(self) -> None:
        """Log configuration status."""
        status = self.validate()
        print("[CONFIG] Service availability:")
        for service, available in status.items():
            icon = "✓" if available else "✗"
            print(f"  [{icon}] {service}")
        print(f"[CONFIG] Pipeline: enabled={self.pipeline.pipeline_enabled}, "
              f"scrape={self.pipeline.scrape_enabled}, "
              f"enrich={self.pipeline.enrich_enabled}, "
              f"send={self.pipeline.send_enabled}")
        print(f"[CONFIG] Mode: dry_run={self.pipeline.dry_run}, "
              f"safe_mode={self.pipeline.safe_mode}")
        print(f"[CONFIG] Limits: daily={self.limits.daily_limit}, "
              f"per_run={self.limits.send_limit_per_run}, "
              f"delay={self.limits.delay_between_sends}s")
        print(f"[CONFIG] Auto-approve: enabled={self.auto_approve.enabled}, "
              f"max_per_run={self.auto_approve.max_per_run}, "
              f"allow_free_emails={self.auto_approve.allow_free_emails}")
        if self.scaling.scaling_enabled:
            print(f"[CONFIG] Scaling: enabled, "
                  f"daily_target={self.scaling.daily_target}, "
                  f"today_limit={self.scaling.get_todays_limit()}")


def _strip_secret(value: Optional[str]) -> Optional[str]:
    """Strip whitespace, newlines, and surrounding quotes from secret values."""
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    cleaned = value.strip().replace('\n', '').replace('\r', '')
    # Strip surrounding quotes (common copy-paste error)
    if (cleaned.startswith('"') and cleaned.endswith('"')) or \
       (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1]
    return cleaned


def load_config() -> Config:
    """
    Load configuration from environment variables.

    NOTE: This function loads config values but does NOT validate secrets.
    For production use, secrets should be validated through src.secrets module
    BEFORE using this config. The preflight checks in task_runner.py and main.py
    ensure secrets are valid before the pipeline runs.
    """
    config = Config()

    # API credentials (strip only - validation happens in secrets.py)
    # These are stored for reference but should be accessed via secrets.py in production
    config.api.openai_api_key = _strip_secret(os.getenv("OPENAI_API_KEY"))
    config.api.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o")

    config.api.apify_api_token = _strip_secret(os.getenv("APIFY_API_TOKEN"))
    config.api.apify_actor_id = _strip_secret(os.getenv("APIFY_ACTOR_ID"))

    config.api.google_sheet_id = _strip_secret(os.getenv("GOOGLE_SHEET_ID"))
    config.api.google_credentials_json = _strip_secret(os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON"))

    config.api.resend_api_key = _strip_secret(os.getenv("RESEND_API_KEY"))
    email_from = _strip_secret(os.getenv("EMAIL_FROM"))
    config.api.email_from = email_from if email_from else config.api.email_from
    email_reply_to = _strip_secret(os.getenv("EMAIL_REPLY_TO"))
    config.api.email_reply_to = email_reply_to if email_reply_to else config.api.email_reply_to

    config.api.alert_to_email = os.getenv("ALERT_TO_EMAIL", config.api.alert_to_email)
    config.api.alert_from_email = os.getenv("ALERT_FROM_EMAIL", config.api.alert_from_email)

    # Pipeline flags
    config.pipeline.pipeline_enabled = os.getenv("PIPELINE_ENABLED", "true").lower() == "true"
    config.pipeline.scrape_enabled = os.getenv("SCRAPE_ENABLED", "true").lower() == "true"
    config.pipeline.enrich_enabled = os.getenv("ENRICH_ENABLED", "true").lower() == "true"
    config.pipeline.send_enabled = os.getenv("SEND_ENABLED", "false").lower() == "true"
    config.pipeline.dry_run = os.getenv("DRY_RUN", "false").lower() == "true"
    config.pipeline.safe_mode = os.getenv("SAFE_MODE", "true").lower() == "true"

    # Limits (can be overridden via env)
    if os.getenv("MAX_SCRAPE_PER_RUN"):
        config.limits.max_scrape_per_run = int(os.getenv("MAX_SCRAPE_PER_RUN"))
    if os.getenv("MAX_ENRICH_PER_RUN"):
        config.limits.max_enrich_per_run = int(os.getenv("MAX_ENRICH_PER_RUN"))

    # Sending volume config (target 50/day)
    if os.getenv("DAILY_LIMIT"):
        config.limits.daily_limit = int(os.getenv("DAILY_LIMIT"))
    if os.getenv("SEND_LIMIT_PER_RUN"):
        config.limits.send_limit_per_run = int(os.getenv("SEND_LIMIT_PER_RUN"))
    if os.getenv("DELAY_BETWEEN_SENDS"):
        config.limits.delay_between_sends = float(os.getenv("DELAY_BETWEEN_SENDS"))
    if os.getenv("BATCH_UPDATE_SIZE"):
        config.limits.batch_update_size = int(os.getenv("BATCH_UPDATE_SIZE"))

    # Auto-approve config (hands-off automation)
    config.auto_approve.enabled = os.getenv("AUTO_APPROVE_ENABLED", "false").lower() == "true"
    if os.getenv("AUTO_APPROVE_MAX_PER_RUN"):
        config.auto_approve.max_per_run = int(os.getenv("AUTO_APPROVE_MAX_PER_RUN"))
    config.auto_approve.allow_free_emails = os.getenv("AUTO_APPROVE_ALLOW_FREE_EMAILS", "false").lower() == "true"

    # Scaling config (prep for production ramp-up - NOT enabled by default)
    config.scaling.scaling_enabled = os.getenv("SCALING_ENABLED", "false").lower() == "true"
    if os.getenv("DAILY_TARGET"):
        config.scaling.daily_target = int(os.getenv("DAILY_TARGET"))
    if os.getenv("RAMP_START"):
        config.scaling.ramp_start = int(os.getenv("RAMP_START"))
    if os.getenv("RAMP_INCREMENT"):
        config.scaling.ramp_increment = int(os.getenv("RAMP_INCREMENT"))
    if os.getenv("MAX_CAP"):
        config.scaling.max_cap = int(os.getenv("MAX_CAP"))
    if os.getenv("RAMP_START_DATE"):
        config.scaling.ramp_start_date = os.getenv("RAMP_START_DATE")

    # Yield target config (proactive lead discovery)
    if os.getenv("TARGET_LEADS_TOTAL"):
        config.yield_target.target_leads_total = int(os.getenv("TARGET_LEADS_TOTAL"))
    if os.getenv("TARGET_EMAILS_MIN"):
        config.yield_target.target_emails_min = int(os.getenv("TARGET_EMAILS_MIN"))
    if os.getenv("TARGET_EMAIL_RATE_MIN"):
        config.yield_target.target_email_rate_min = float(os.getenv("TARGET_EMAIL_RATE_MIN"))
    if os.getenv("MAX_ITERATIONS"):
        config.yield_target.max_iterations = int(os.getenv("MAX_ITERATIONS"))
    if os.getenv("MAX_RUNTIME_SECONDS"):
        config.yield_target.max_runtime_seconds = int(os.getenv("MAX_RUNTIME_SECONDS"))
    if os.getenv("MAX_PAGES_PER_DOMAIN"):
        config.yield_target.max_pages_per_domain = int(os.getenv("MAX_PAGES_PER_DOMAIN"))
    config.yield_target.enable_deep_crawl = os.getenv("ENABLE_DEEP_CRAWL", "true").lower() == "true"
    config.yield_target.enable_query_variants = os.getenv("ENABLE_QUERY_VARIANTS", "true").lower() == "true"
    config.yield_target.enable_social_fallback = os.getenv("ENABLE_SOCIAL_FALLBACK", "true").lower() == "true"

    # Runtime flags
    config.is_ci = bool(os.getenv("CI") or os.getenv("GITHUB_ACTIONS"))
    config.debug = os.getenv("DEBUG", "false").lower() == "true"

    return config


# Global config instance - loaded once at import
_config: Optional[Config] = None


def get_config() -> Config:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reload_config() -> Config:
    """Force reload configuration (useful for testing)."""
    global _config
    _config = load_config()
    return _config
