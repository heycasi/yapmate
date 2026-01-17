"""Data models for YapMate lead generation system."""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class Lead:
    """Raw lead from Apify scraper"""
    business_name: str
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    trade: str
    city: str
    lead_source: str
    raw_data: dict = field(repr=False)

    @property
    def dedup_key(self) -> str:
        """Composite key for deduplication: business_name|city"""
        name = self.business_name.lower().strip()
        city = self.city.lower().strip()
        return f"{name}|{city}"


@dataclass
class EnrichedLead:
    """Lead with AI-generated hook"""
    lead: Lead
    ai_hook: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    status: str = "NEW"

    def to_sheets_row(self) -> list:
        """Convert to Google Sheets row format"""
        return [
            self.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            self.lead.business_name,
            "",  # contact_name (not available from Google Maps)
            self.lead.email,
            self.lead.phone or "",
            self.lead.website or "",
            self.lead.trade,
            self.lead.city,
            self.ai_hook,
            self.lead.lead_source,
            self.status
        ]
