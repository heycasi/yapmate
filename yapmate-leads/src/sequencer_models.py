"""Data models for City-Trade Sequencing Engine.

This module defines all data structures used by the sequencing system:
- QueueTask: Individual scraping tasks in the queue
- RunnerState: Current state of the task runner
- EnhancedLead: Lead with full metadata and eligibility flags
- DedupeKey: Entry in the dedupe_keys lookup table
- RunLogEntry: Execution history entry
- EmailCampaign: Email campaign tracking
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    """Status of a queue task."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    STALE = "stale"


class SessionType(str, Enum):
    """Type of session (morning or evening)."""
    AM = "AM"
    PM = "PM"


class DedupeMatchType(str, Enum):
    """Type of dedupe match found."""
    PLACE_ID = "place_id"
    SOURCE_URL = "source_url"
    EMAIL = "email"
    PHONE = "phone"
    NAME_CITY = "name_city"  # Soft match


# =============================================================================
# QUEUE TASK
# =============================================================================

@dataclass
class QueueTask:
    """A single task in the queue (one city+trade combination)."""

    # Identity
    task_id: str  # UUID
    trade: str
    city: str
    session: SessionType

    # Priority (lower = runs first)
    priority: int
    tier: int

    # Status tracking
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Results
    leads_found: int = 0
    leads_after_dedupe: int = 0
    error_message: Optional[str] = None

    def to_sheets_row(self) -> List[Any]:
        """Convert to Google Sheets row format."""
        return [
            self.task_id,
            self.trade,
            self.city,
            self.session.value,
            self.priority,
            self.tier,
            self.status.value,
            self.created_at.isoformat() if self.created_at else "",
            self.started_at.isoformat() if self.started_at else "",
            self.completed_at.isoformat() if self.completed_at else "",
            self.leads_found,
            self.leads_after_dedupe,
            self.error_message or "",
        ]

    @staticmethod
    def headers() -> List[str]:
        """Column headers for Google Sheets."""
        return [
            "task_id",
            "trade",
            "city",
            "session",
            "priority",
            "tier",
            "status",
            "created_at",
            "started_at",
            "completed_at",
            "leads_found",
            "leads_after_dedupe",
            "error_message",
        ]

    @classmethod
    def from_sheets_row(cls, row: List[Any]) -> "QueueTask":
        """Create from Google Sheets row."""
        return cls(
            task_id=str(row[0]),
            trade=str(row[1]),
            city=str(row[2]),
            session=SessionType(row[3]),
            priority=int(row[4]),
            tier=int(row[5]),
            status=TaskStatus(row[6]),
            created_at=datetime.fromisoformat(row[7]) if row[7] else None,
            started_at=datetime.fromisoformat(row[8]) if row[8] else None,
            completed_at=datetime.fromisoformat(row[9]) if row[9] else None,
            leads_found=int(row[10]) if row[10] else 0,
            leads_after_dedupe=int(row[11]) if row[11] else 0,
            error_message=str(row[12]) if row[12] else None,
        )


# =============================================================================
# RUNNER STATE
# =============================================================================

@dataclass
class RunnerState:
    """Current state of the task runner."""

    # Focus trade: if set, runner only processes tasks for this trade today
    focus_trade_id: Optional[str] = None
    focus_trade_date: Optional[str] = None  # YYYY-MM-DD format

    # Last run info
    last_run_at: Optional[datetime] = None
    last_session: Optional[SessionType] = None
    last_task_id: Optional[str] = None

    # Safety counters (rolling window)
    emails_sent_today: int = 0
    bounces_last_7_days: int = 0
    complaints_last_7_days: int = 0
    total_sent_last_7_days: int = 0

    # Pause flags
    sending_paused: bool = False
    pause_reason: Optional[str] = None

    # Alert rate-limiting
    last_alert_key: Optional[str] = None  # Hash of last alert sent
    last_alert_at: Optional[datetime] = None  # When last alert was sent

    def to_sheets_row(self) -> List[Any]:
        """Convert to single-row key-value format for state tab."""
        return [
            self.focus_trade_id or "",
            self.focus_trade_date or "",
            self.last_run_at.isoformat() if self.last_run_at else "",
            self.last_session.value if self.last_session else "",
            self.last_task_id or "",
            self.emails_sent_today,
            self.bounces_last_7_days,
            self.complaints_last_7_days,
            self.total_sent_last_7_days,
            self.sending_paused,
            self.pause_reason or "",
            self.last_alert_key or "",
            self.last_alert_at.isoformat() if self.last_alert_at else "",
        ]

    @staticmethod
    def headers() -> List[str]:
        """Column headers for state tab."""
        return [
            "focus_trade_id",
            "focus_trade_date",
            "last_run_at",
            "last_session",
            "last_task_id",
            "emails_sent_today",
            "bounces_last_7_days",
            "complaints_last_7_days",
            "total_sent_last_7_days",
            "sending_paused",
            "pause_reason",
            "last_alert_key",
            "last_alert_at",
        ]

    @classmethod
    def from_sheets_row(cls, row: List[Any]) -> "RunnerState":
        """Create from Google Sheets row."""
        def parse_datetime(val):
            if not val:
                return None
            try:
                return datetime.fromisoformat(str(val))
            except:
                return None

        # Strict boolean parsing for sending_paused (no truthy coercion)
        def parse_bool_strict(val):
            if not val:
                return False
            val_str = str(val).strip().lower()
            return val_str in ("true", "1", "yes")
        
        return cls(
            focus_trade_id=str(row[0]) if row[0] else None,
            focus_trade_date=str(row[1]) if row[1] else None,
            last_run_at=parse_datetime(row[2]),
            last_session=SessionType(row[3]) if row[3] else None,
            last_task_id=str(row[4]) if row[4] else None,
            emails_sent_today=int(row[5]) if row[5] else 0,
            bounces_last_7_days=int(row[6]) if row[6] else 0,
            complaints_last_7_days=int(row[7]) if row[7] else 0,
            total_sent_last_7_days=int(row[8]) if row[8] else 0,
            sending_paused=parse_bool_strict(row[9]) if len(row) > 9 and row[9] else False,
            pause_reason=str(row[10]) if len(row) > 10 and row[10] else None,
            last_alert_key=str(row[11]) if len(row) > 11 and row[11] else None,
            last_alert_at=parse_datetime(row[12]) if len(row) > 12 else None,
        )


# =============================================================================
# ENHANCED LEAD
# =============================================================================

@dataclass
class EnhancedLead:
    """Lead with full metadata and eligibility flags.

    This is the main lead model used throughout the system.
    Extends the original Lead model with:
    - Dedupe keys (place_id, source_url)
    - Email eligibility flags
    - Soft match indicators
    - Campaign tracking
    """

    # Identity
    lead_id: str  # UUID

    # Core data (from scraper)
    business_name: str
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    trade: str
    city: str

    # Source tracking
    lead_source: str  # e.g., "Google Maps - Apify"
    place_id: Optional[str] = None  # Google Maps place ID
    source_url: Optional[str] = None  # Original listing URL

    # Email discovery (website extraction)
    discovered_email: Optional[str] = None  # Email found via website crawling
    email_source: str = "none"  # "maps" | "website" | "none"
    discovery_url: Optional[str] = None  # URL where email was found

    # AI enrichment
    ai_hook: Optional[str] = None
    enriched_at: Optional[datetime] = None

    # Email eligibility
    send_eligible: bool = False
    eligibility_reason: Optional[str] = None  # Why not eligible (if False)

    # Flags
    generic_address: bool = False  # True if info@, contact@, etc.
    soft_match: bool = False       # True if name+city matched existing
    soft_match_lead_id: Optional[str] = None  # ID of matched lead

    # Status tracking
    status: str = "NEW"  # NEW, APPROVED, SENT, BOUNCED, REPLIED, etc.
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # Campaign tracking
    campaign_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    resend_id: Optional[str] = None  # Resend email ID for tracking
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    bounced_at: Optional[datetime] = None
    complained_at: Optional[datetime] = None

    # Task reference
    task_id: Optional[str] = None  # Which queue task generated this lead

    # Raw data (for debugging)
    raw_data: Dict[str, Any] = field(default_factory=dict, repr=False)

    def to_sheets_row(self) -> List[Any]:
        """Convert to Google Sheets row format."""
        return [
            self.lead_id,
            self.business_name,
            self.email or "",
            self.phone or "",
            self.website or "",
            self.trade,
            self.city,
            self.lead_source,
            self.place_id or "",
            self.source_url or "",
            self.discovered_email or "",
            self.email_source,
            self.discovery_url or "",
            self.ai_hook or "",
            self.enriched_at.isoformat() if self.enriched_at else "",
            self.send_eligible,
            self.eligibility_reason or "",
            self.generic_address,
            self.soft_match,
            self.soft_match_lead_id or "",
            self.status,
            self.created_at.isoformat() if self.created_at else "",
            self.updated_at.isoformat() if self.updated_at else "",
            self.campaign_id or "",
            self.sent_at.isoformat() if self.sent_at else "",
            self.resend_id or "",
            self.opened_at.isoformat() if self.opened_at else "",
            self.clicked_at.isoformat() if self.clicked_at else "",
            self.replied_at.isoformat() if self.replied_at else "",
            self.bounced_at.isoformat() if self.bounced_at else "",
            self.complained_at.isoformat() if self.complained_at else "",
            self.task_id or "",
        ]

    @staticmethod
    def headers() -> List[str]:
        """Column headers for Google Sheets."""
        return [
            "lead_id",
            "business_name",
            "email",
            "phone",
            "website",
            "trade",
            "city",
            "lead_source",
            "place_id",
            "source_url",
            "discovered_email",
            "email_source",
            "discovery_url",
            "ai_hook",
            "enriched_at",
            "send_eligible",
            "eligibility_reason",
            "generic_address",
            "soft_match",
            "soft_match_lead_id",
            "status",
            "created_at",
            "updated_at",
            "campaign_id",
            "sent_at",
            "resend_id",
            "opened_at",
            "clicked_at",
            "replied_at",
            "bounced_at",
            "complained_at",
            "task_id",
        ]

    @staticmethod
    def _normalize_status(status_val: Any) -> str:
        """Normalize status value to uppercase standard values."""
        if not status_val:
            return "NEW"
        
        status_str = str(status_val).strip()
        
        # Handle boolean values (legacy data)
        if isinstance(status_val, bool):
            return "APPROVED" if status_val else "NEW"
        
        # Handle string boolean values
        status_lower = status_str.lower()
        if status_lower in ("true", "1", "yes"):
            return "APPROVED"
        if status_lower in ("false", "0", "no"):
            return "NEW"
        
        # Normalize to uppercase
        status_upper = status_str.upper()
        
        # Map common variations
        status_map = {
            "APPROVED": "APPROVED",
            "NEW": "NEW",
            "SENT": "SENT",
            "QUEUED": "QUEUED",
            "FAILED": "FAILED",
            "INVALID": "INVALID",
            "BOUNCED": "BOUNCED",
            "REPLIED": "REPLIED",
        }
        
        return status_map.get(status_upper, status_upper)
    
    @classmethod
    def from_sheets_row(cls, row: List[Any]) -> "EnhancedLead":
        """Create from Google Sheets row."""
        def parse_bool(val) -> bool:
            """Robust boolean parsing: handles TRUE/FALSE, true/false, Yes/No, 1/0, strips whitespace."""
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                val_clean = val.strip().lower()
                # Handle various true values
                if val_clean in ("true", "1", "yes", "y", "t"):
                    return True
                # Handle various false values
                if val_clean in ("false", "0", "no", "n", "f", ""):
                    return False
            # For numbers, 0 is False, anything else is True
            if isinstance(val, (int, float)):
                return val != 0
            return bool(val)

        def parse_datetime(val) -> Optional[datetime]:
            if not val:
                return None
            if isinstance(val, datetime):
                return val
            try:
                return datetime.fromisoformat(str(val))
            except:
                return None

        return cls(
            lead_id=str(row[0]),
            business_name=str(row[1]),
            email=str(row[2]) if row[2] else None,
            phone=str(row[3]) if row[3] else None,
            website=str(row[4]) if row[4] else None,
            trade=str(row[5]),
            city=str(row[6]),
            lead_source=str(row[7]),
            place_id=str(row[8]) if row[8] else None,
            source_url=str(row[9]) if row[9] else None,
            discovered_email=str(row[10]) if len(row) > 10 and row[10] else None,
            email_source=str(row[11]) if len(row) > 11 and row[11] else "none",
            discovery_url=str(row[12]) if len(row) > 12 and row[12] else None,
            ai_hook=str(row[13]) if len(row) > 13 and row[13] else None,
            enriched_at=parse_datetime(row[14]) if len(row) > 14 else None,
            send_eligible=parse_bool(row[15]) if len(row) > 15 else False,
            eligibility_reason=str(row[16]) if len(row) > 16 and row[16] else None,
            generic_address=parse_bool(row[17]) if len(row) > 17 else False,
            soft_match=parse_bool(row[18]) if len(row) > 18 else False,
            soft_match_lead_id=str(row[19]) if len(row) > 19 and row[19] else None,
            status=cls._normalize_status(row[20]) if len(row) > 20 and row[20] else "NEW",
            created_at=parse_datetime(row[21]) if len(row) > 21 else datetime.utcnow(),
            updated_at=parse_datetime(row[22]) if len(row) > 22 else datetime.utcnow(),
            campaign_id=str(row[23]) if len(row) > 23 and row[23] else None,
            sent_at=parse_datetime(row[24]) if len(row) > 24 else None,
            resend_id=str(row[25]) if len(row) > 25 and row[25] else None,
            opened_at=parse_datetime(row[26]) if len(row) > 26 else None,
            clicked_at=parse_datetime(row[27]) if len(row) > 27 else None,
            replied_at=parse_datetime(row[28]) if len(row) > 28 else None,
            bounced_at=parse_datetime(row[29]) if len(row) > 29 else None,
            complained_at=parse_datetime(row[30]) if len(row) > 30 else None,
            task_id=str(row[31]) if len(row) > 31 and row[31] else None,
        )


# =============================================================================
# DEDUPE KEY
# =============================================================================

@dataclass
class DedupeKey:
    """Entry in the dedupe_keys lookup table.

    This table provides fast O(1) lookups for deduplication
    without scanning the full leads table.
    """

    key_type: str  # "place_id", "source_url", "email", "phone", "name_city"
    key_value: str  # The actual key value (normalized/lowercase)
    lead_id: str   # Reference to the lead that owns this key
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_sheets_row(self) -> List[Any]:
        """Convert to Google Sheets row format."""
        return [
            self.key_type,
            self.key_value,
            self.lead_id,
            self.created_at.isoformat() if self.created_at else "",
        ]

    @staticmethod
    def headers() -> List[str]:
        """Column headers for Google Sheets."""
        return [
            "key_type",
            "key_value",
            "lead_id",
            "created_at",
        ]

    @classmethod
    def from_sheets_row(cls, row: List[Any]) -> "DedupeKey":
        """Create from Google Sheets row."""
        return cls(
            key_type=str(row[0]),
            key_value=str(row[1]),
            lead_id=str(row[2]),
            created_at=datetime.fromisoformat(row[3]) if row[3] else datetime.utcnow(),
        )


# =============================================================================
# RUN LOG ENTRY
# =============================================================================

@dataclass
class RunLogEntry:
    """Entry in the run_log table for execution history."""

    run_id: str  # UUID
    task_id: str
    trade: str
    city: str
    session: SessionType

    started_at: datetime
    completed_at: Optional[datetime] = None

    status: str = "running"  # running, completed, failed
    leads_found: int = 0
    leads_after_dedupe: int = 0
    leads_enriched: int = 0
    leads_eligible: int = 0
    leads_auto_approved: int = 0

    error_message: Optional[str] = None
    duration_seconds: Optional[float] = None

    def to_sheets_row(self) -> List[Any]:
        """Convert to Google Sheets row format."""
        return [
            self.run_id,
            self.task_id,
            self.trade,
            self.city,
            self.session.value,
            self.started_at.isoformat() if self.started_at else "",
            self.completed_at.isoformat() if self.completed_at else "",
            self.status,
            self.leads_found,
            self.leads_after_dedupe,
            self.leads_enriched,
            self.leads_eligible,
            self.leads_auto_approved,
            self.error_message or "",
            self.duration_seconds or "",
        ]

    @staticmethod
    def headers() -> List[str]:
        """Column headers for Google Sheets."""
        return [
            "run_id",
            "task_id",
            "trade",
            "city",
            "session",
            "started_at",
            "completed_at",
            "status",
            "leads_found",
            "leads_after_dedupe",
            "leads_enriched",
            "leads_eligible",
            "leads_auto_approved",
            "error_message",
            "duration_seconds",
        ]


# =============================================================================
# EMAIL CAMPAIGN
# =============================================================================

@dataclass
class EmailCampaign:
    """Email campaign tracking."""

    campaign_id: str  # UUID
    name: str
    created_at: datetime = field(default_factory=datetime.utcnow)

    # Stats (updated after sends)
    total_sent: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    total_replied: int = 0
    total_bounced: int = 0
    total_complained: int = 0

    # Rates (calculated)
    @property
    def open_rate(self) -> float:
        return (self.total_opened / self.total_sent * 100) if self.total_sent > 0 else 0

    @property
    def click_rate(self) -> float:
        return (self.total_clicked / self.total_sent * 100) if self.total_sent > 0 else 0

    @property
    def bounce_rate(self) -> float:
        return (self.total_bounced / self.total_sent) if self.total_sent > 0 else 0

    @property
    def complaint_rate(self) -> float:
        return (self.total_complained / self.total_sent) if self.total_sent > 0 else 0

    def to_sheets_row(self) -> List[Any]:
        """Convert to Google Sheets row format."""
        return [
            self.campaign_id,
            self.name,
            self.created_at.isoformat() if self.created_at else "",
            self.total_sent,
            self.total_opened,
            self.total_clicked,
            self.total_replied,
            self.total_bounced,
            self.total_complained,
        ]

    @staticmethod
    def headers() -> List[str]:
        """Column headers for Google Sheets."""
        return [
            "campaign_id",
            "name",
            "created_at",
            "total_sent",
            "total_opened",
            "total_clicked",
            "total_replied",
            "total_bounced",
            "total_complained",
        ]
