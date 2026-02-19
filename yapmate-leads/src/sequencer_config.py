"""Configuration for City-Trade Sequencing Engine.

This module contains all configuration for the automated lead generation system:
- Trade tiering and priorities
- City lists and boosts
- Queue settings
- Email eligibility rules
- Safety thresholds
- Warm-up ramp settings
"""

import os
from dataclasses import dataclass, field
from typing import Dict, List, Set
from enum import IntEnum


class TradeTier(IntEnum):
    """Trade priority tiers - lower number = higher priority."""
    TIER_1 = 1  # Core trades - high volume, proven demand
    TIER_2 = 2  # Expansion trades - good potential
    TIER_3 = 3  # Niche trades - lower volume


# =============================================================================
# TRADE CONFIGURATION
# =============================================================================

TRADES_BY_TIER: Dict[TradeTier, List[str]] = {
    TradeTier.TIER_1: [
        "Plumber",
        "Electrician",
        "Joiner",
        "Roofer",
        "Plasterer",
        "Painter and Decorator",
        "Bricklayer",
        "Tiler",
        "Carpet Fitter",
        "Gas Engineer",
    ],
    TradeTier.TIER_2: [
        "Locksmith",
        "Glazier",
        "Flooring Specialist",
        "Kitchen Fitter",
        "Bathroom Fitter",
        "Landscape Gardener",
        "Fencer",
        "Driveway Specialist",
    ],
    TradeTier.TIER_3: [
        "Scaffolder",
        "Demolition Contractor",
        "Aerial Installer",
        "Chimney Sweep",
        "Pool Engineer",
        "Solar Panel Installer",
    ],
}

# Boost for trades with higher conversion potential
TRADE_BOOST: Dict[str, int] = {
    "Plumber": 10,
    "Electrician": 10,
    "Gas Engineer": 8,
    "Joiner": 5,
    "Roofer": 5,
}


# =============================================================================
# CITY CONFIGURATION
# =============================================================================

# UK cities ordered by population/market size
# Source: ONS urban area populations
UK_CITIES: List[str] = [
    # Major cities (population > 500k)
    "London",
    "Birmingham",
    "Leeds",
    "Glasgow",
    "Sheffield",
    "Manchester",
    "Liverpool",
    "Bristol",
    "Edinburgh",
    "Leicester",
    # Large cities (population 250k-500k)
    "Newcastle",
    "Nottingham",
    "Southampton",
    "Cardiff",
    "Belfast",
    "Coventry",
    "Kingston upon Hull",
    "Bradford",
    "Stoke-on-Trent",
    "Wolverhampton",
    # Medium cities (population 150k-250k)
    "Derby",
    "Swansea",
    "Plymouth",
    "Reading",
    "Milton Keynes",
    "Luton",
    "Aberdeen",
    "Northampton",
    "Portsmouth",
    "Preston",
    # Smaller cities (population 100k-150k)
    "Norwich",
    "Swindon",
    "Bournemouth",
    "Middlesbrough",
    "Peterborough",
    "Blackpool",
    "Bolton",
    "Ipswich",
    "Huddersfield",
    "Dundee",
]

# Boost for cities with higher population/opportunity
CITY_BOOST: Dict[str, int] = {
    "London": 20,
    "Birmingham": 15,
    "Manchester": 15,
    "Leeds": 10,
    "Glasgow": 10,
    "Liverpool": 8,
    "Bristol": 8,
    "Sheffield": 5,
}


# =============================================================================
# QUEUE SETTINGS
# =============================================================================

@dataclass
class QueueConfig:
    """Configuration for queue generation and processing."""

    # Priority calculation: priority = (tier * 1000) + trade_boost + city_boost + session_offset
    tier_multiplier: int = 1000

    # Session offsets (lower = runs first in queue)
    am_session_offset: int = 0
    pm_session_offset: int = 500

    # Task settings
    # NOTE: leads_per_task controls maxCrawledPlacesPerSearch in Apify.
    # Reduced from 50 to 20 to cut Apify costs ~60%.
    # Most emails are found in top 20 results anyway.
    # Override via LEADS_PER_TASK env.
    leads_per_task: int = 20
    tasks_per_day: int = 2  # AM + PM sessions

    # Queue management
    max_pending_tasks: int = 500  # Prevent unbounded queue growth
    stale_task_hours: int = 72    # Mark tasks stale after this many hours


# =============================================================================
# SESSION SETTINGS
# =============================================================================

@dataclass
class SessionConfig:
    """Configuration for session timing and behavior."""

    # Session windows (for manual runs only - automated uses trigger time)
    am_window_start: int = 6   # 6:00 AM
    am_window_end: int = 12    # 12:00 PM
    pm_window_start: int = 14  # 2:00 PM
    pm_window_end: int = 20    # 8:00 PM

    # Focus trade behavior
    # When True, both AM and PM sessions on same day use same trade
    enforce_same_trade_per_day: bool = True


# =============================================================================
# EMAIL ELIGIBILITY RULES
# =============================================================================

@dataclass
class EmailEligibilityConfig:
    """Configuration for email eligibility and flagging."""

    # Generic email prefixes to FLAG (not block)
    # These addresses receive a "generic_address" flag but are still eligible
    generic_prefixes: Set[str] = field(default_factory=lambda: {
        "info@",
        "contact@",
        "enquiries@",
        "sales@",
        "hello@",
        "admin@",
        "office@",
        "enquiry@",
    })

    # Invalid email patterns that make lead NOT eligible
    # These addresses are marked send_eligible = False
    invalid_patterns: Set[str] = field(default_factory=lambda: {
        "noreply@",
        "no-reply@",
        "donotreply@",
        "do-not-reply@",
        "mailer-daemon@",
        "postmaster@",
    })

    # Domain blocklist (never send to these)
    blocked_domains: Set[str] = field(default_factory=lambda: {
        "example.com",
        "test.com",
        "domain.com",
        "yoursite.com",
        "email.com",
    })

    # Required: must have email to be send-eligible
    require_email: bool = True

    # Required: must have been enriched with AI hook
    require_ai_hook: bool = True


# =============================================================================
# EMAIL SENDER SETTINGS
# =============================================================================

@dataclass
class EmailSenderConfig:
    """Configuration for email sending with warm-up and safety."""

    # Daily sending limits (enforced at sender level)
    daily_limit: int = 50

    # Warm-up ramp settings
    warmup_enabled: bool = True
    warmup_start_daily_limit: int = 10   # Start with 10/day
    warmup_increment_per_day: int = 5    # Increase by 5/day
    warmup_max_daily_limit: int = 100    # Cap at 100/day
    warmup_start_date: str = ""          # Set when starting warm-up (YYYY-MM-DD)

    # Safety thresholds (pause sending if exceeded)
    max_bounce_rate: float = 0.10   # 10% - pause if exceeded
    max_complaint_rate: float = 0.001  # 0.1% - pause if exceeded

    # Lookback window for safety calculations
    safety_lookback_days: int = 7

    # Rate limiting
    delay_between_sends_seconds: float = 0.5

    # Resend configuration
    from_email: str = "support@yapmate.co.uk"
    from_name: str = "Connor from YapMate"
    reply_to: str = "support@yapmate.co.uk"


# =============================================================================
# DEDUPE SETTINGS
# =============================================================================

@dataclass
class DedupeConfig:
    """Configuration for lead deduplication."""

    # Primary keys (hard dedupe - always block)
    # If any of these match an existing lead, new lead is duplicate
    primary_keys: List[str] = field(default_factory=lambda: [
        "place_id",      # Google Maps place ID
        "source_url",    # Original listing URL
    ])

    # Secondary keys (hard dedupe)
    secondary_keys: List[str] = field(default_factory=lambda: [
        "email",
        "phone",
    ])

    # Soft match keys (flag only, don't block)
    # Matches here get "soft_match" flag but are still added
    soft_match_keys: List[str] = field(default_factory=lambda: [
        "name_city",  # business_name + city composite
    ])


# =============================================================================
# GOOGLE SHEETS TAB NAMES
# =============================================================================

# Default tab names - can be overridden via environment variables
SHEETS_TABS = {
    "config": "config",           # System configuration
    "cities": "cities",           # City list with boosts
    "trades": "trades",           # Trade list with tiers
    "queue": "queue",             # Task queue
    "state": "state",             # Runner state (focus_trade_id, etc.)
    "run_log": "run_log",         # Execution history
    "leads": os.getenv("LEADS_SHEET_TAB", "leads"),  # All leads (master list) - configurable
    "dedupe_keys": "dedupe_keys", # Fast dedupe lookup table
    "campaigns": "campaigns",     # Email campaigns
    "email_blocklist": "email_blocklist",  # Bounced/complained addresses
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _parse_bool_env(name: str, default: bool) -> bool:
    """Parse boolean from environment variable."""
    val = os.getenv(name, "").strip().lower()
    if not val:
        return default
    return val in ("true", "1", "yes", "on")


def _parse_int_env(name: str, default: int) -> int:
    """Parse integer from environment variable."""
    val = os.getenv(name, "").strip()
    if not val:
        return default
    try:
        return int(val)
    except ValueError:
        return default


# =============================================================================
# DEFAULT INSTANCES
# =============================================================================

# QueueConfig with env override for leads_per_task (Apify maxCrawledPlacesPerSearch)
DEFAULT_QUEUE_CONFIG = QueueConfig(
    leads_per_task=_parse_int_env("LEADS_PER_TASK", 50),  # Default 50, override via LEADS_PER_TASK
)
DEFAULT_SESSION_CONFIG = SessionConfig()
DEFAULT_EMAIL_ELIGIBILITY_CONFIG = EmailEligibilityConfig()

# EmailSenderConfig with env var overrides for warmup control
DEFAULT_EMAIL_SENDER_CONFIG = EmailSenderConfig(
    # Daily limit from env (used when warmup disabled)
    daily_limit=_parse_int_env("DAILY_LIMIT", 50),
    # Warmup settings from env
    warmup_enabled=_parse_bool_env("WARMUP_ENABLED", True),
    warmup_start_daily_limit=_parse_int_env("WARMUP_START_DAILY_LIMIT", 10),
    warmup_increment_per_day=_parse_int_env("WARMUP_RAMP_INCREMENT", 5),
    warmup_max_daily_limit=_parse_int_env("WARMUP_MAX_CAP", 100),
    warmup_start_date=os.getenv("WARMUP_START_DATE", "").strip(),
)

DEFAULT_DEDUPE_CONFIG = DedupeConfig()
