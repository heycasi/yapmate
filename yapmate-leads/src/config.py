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

    # Sending limits
    max_send_per_day: int = 100
    max_send_per_hour: int = 20
    max_per_domain_per_day: int = 5
    max_per_company_per_day: int = 1

    # Warmup ramp (days -> daily limit)
    warmup_ramp: Dict[int, int] = field(default_factory=lambda: {
        1: 10, 2: 15, 3: 20, 4: 30, 5: 40,
        6: 50, 7: 60, 14: 80, 21: 100
    })

    # Cooldowns (seconds)
    domain_cooldown: int = 3600  # 1 hour
    company_cooldown: int = 86400  # 24 hours


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


def load_config() -> Config:
    """Load configuration from environment variables."""
    config = Config()

    # API credentials
    config.api.openai_api_key = os.getenv("OPENAI_API_KEY")
    config.api.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o")

    config.api.apify_api_token = os.getenv("APIFY_API_TOKEN")
    config.api.apify_actor_id = os.getenv("APIFY_ACTOR_ID")

    config.api.google_sheet_id = os.getenv("GOOGLE_SHEET_ID")
    config.api.google_credentials_json = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")

    config.api.resend_api_key = os.getenv("RESEND_API_KEY")
    config.api.email_from = os.getenv("EMAIL_FROM", config.api.email_from)
    config.api.email_reply_to = os.getenv("EMAIL_REPLY_TO", config.api.email_reply_to)

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
    if os.getenv("MAX_SEND_PER_DAY"):
        config.limits.max_send_per_day = int(os.getenv("MAX_SEND_PER_DAY"))

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
