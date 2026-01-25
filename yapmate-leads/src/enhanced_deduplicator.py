"""Enhanced Lead Deduplication with Multi-Key Support.

This module provides the deduplication engine for the sequencing system.
It uses a separate dedupe_keys table for fast O(1) lookups instead of
scanning the full leads table.

Dedupe hierarchy:
1. Primary keys (hard block): place_id, source_url
2. Secondary keys (hard block): email, phone
3. Soft match (flag only): name+city

Soft matches are flagged but NOT blocked - they're still added to the
leads table but marked with soft_match=True for manual review.
"""

from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from src.sequencer_models import EnhancedLead, DedupeKey, DedupeMatchType
from src.sequencer_sheets import SequencerSheetsManager


@dataclass
class DedupeResult:
    """Result of a deduplication check."""

    is_duplicate: bool  # True if lead should be blocked
    match_type: Optional[DedupeMatchType]  # Type of match found
    matched_lead_id: Optional[str]  # ID of the lead it matched
    is_soft_match: bool = False  # True if only a soft match (name+city)

    @property
    def should_block(self) -> bool:
        """Whether this lead should be blocked from adding."""
        return self.is_duplicate and not self.is_soft_match


class EnhancedDeduplicator:
    """
    Multi-key deduplication engine.

    Uses an in-memory cache of dedupe keys for fast lookups.
    Keys are loaded from the dedupe_keys sheet tab on initialization.
    """

    def __init__(self, sheets: SequencerSheetsManager = None):
        """
        Initialize the deduplicator.

        Args:
            sheets: Sheets manager (optional - can load keys later)
        """
        self.sheets = sheets

        # In-memory key caches by type
        self._keys: Dict[str, Dict[str, str]] = {
            "place_id": {},
            "source_url": {},
            "email": {},
            "phone": {},
            "name_city": {},
        }

        # Track keys added in current session (for batch operations)
        self._session_keys: Dict[str, Set[str]] = {
            "place_id": set(),
            "source_url": set(),
            "email": set(),
            "phone": set(),
            "name_city": set(),
        }

        # Stats
        self._stats = {
            "total_checked": 0,
            "hard_duplicates": 0,
            "soft_matches": 0,
            "unique": 0,
        }

    # =========================================================================
    # KEY LOADING
    # =========================================================================

    def load_keys_from_sheets(self):
        """Load all dedupe keys from Google Sheets into memory."""
        if not self.sheets:
            raise ValueError("Sheets manager not configured")

        print("Loading dedupe keys from sheets...")
        self._keys = self.sheets.load_dedupe_keys()

        total = sum(len(v) for v in self._keys.values())
        print(f"  Loaded {total} dedupe keys:")
        for key_type, keys in self._keys.items():
            print(f"    {key_type}: {len(keys)}")

    def load_keys_from_dict(self, keys: Dict[str, Dict[str, str]]):
        """
        Load dedupe keys from a dictionary.

        Args:
            keys: Dict mapping key_type -> {key_value: lead_id}
        """
        self._keys = keys

    def add_existing_keys(self, keys: List[DedupeKey]):
        """
        Add existing keys (e.g., from a previous batch).

        Args:
            keys: List of DedupeKey objects to add
        """
        for key in keys:
            if key.key_type in self._keys:
                self._keys[key.key_type][key.key_value.lower()] = key.lead_id

    # =========================================================================
    # KEY NORMALIZATION
    # =========================================================================

    @staticmethod
    def normalize_email(email: str) -> str:
        """Normalize an email address for comparison."""
        if not email:
            return ""
        return email.lower().strip()

    @staticmethod
    def normalize_phone(phone: str) -> str:
        """Normalize a phone number for comparison."""
        if not phone:
            return ""
        # Remove common formatting characters
        return phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").lower()

    @staticmethod
    def normalize_name_city(name: str, city: str) -> str:
        """Create normalized name+city composite key."""
        if not name or not city:
            return ""
        return f"{name.lower().strip()}|{city.lower().strip()}"

    # =========================================================================
    # DEDUPLICATION
    # =========================================================================

    def check_duplicate(
        self,
        place_id: str = None,
        source_url: str = None,
        email: str = None,
        phone: str = None,
        business_name: str = None,
        city: str = None
    ) -> DedupeResult:
        """
        Check if a lead is a duplicate.

        Checks keys in priority order:
        1. place_id (primary - hard block)
        2. source_url (primary - hard block)
        3. email (secondary - hard block)
        4. phone (secondary - hard block)
        5. name+city (soft match - flag only)

        Args:
            place_id: Google Maps place ID
            source_url: Original listing URL
            email: Email address
            phone: Phone number
            business_name: Business name
            city: City name

        Returns:
            DedupeResult with match information
        """
        self._stats["total_checked"] += 1

        # Check primary keys (hard block)
        if place_id:
            normalized = place_id.lower()
            if normalized in self._keys["place_id"] or normalized in self._session_keys["place_id"]:
                self._stats["hard_duplicates"] += 1
                return DedupeResult(
                    is_duplicate=True,
                    match_type=DedupeMatchType.PLACE_ID,
                    matched_lead_id=self._keys["place_id"].get(normalized)
                )

        if source_url:
            normalized = source_url.lower()
            if normalized in self._keys["source_url"] or normalized in self._session_keys["source_url"]:
                self._stats["hard_duplicates"] += 1
                return DedupeResult(
                    is_duplicate=True,
                    match_type=DedupeMatchType.SOURCE_URL,
                    matched_lead_id=self._keys["source_url"].get(normalized)
                )

        # Check secondary keys (hard block)
        if email:
            normalized = self.normalize_email(email)
            if normalized and (normalized in self._keys["email"] or normalized in self._session_keys["email"]):
                self._stats["hard_duplicates"] += 1
                return DedupeResult(
                    is_duplicate=True,
                    match_type=DedupeMatchType.EMAIL,
                    matched_lead_id=self._keys["email"].get(normalized)
                )

        if phone:
            normalized = self.normalize_phone(phone)
            if normalized and (normalized in self._keys["phone"] or normalized in self._session_keys["phone"]):
                self._stats["hard_duplicates"] += 1
                return DedupeResult(
                    is_duplicate=True,
                    match_type=DedupeMatchType.PHONE,
                    matched_lead_id=self._keys["phone"].get(normalized)
                )

        # Check soft match (flag only, don't block)
        if business_name and city:
            normalized = self.normalize_name_city(business_name, city)
            if normalized and (normalized in self._keys["name_city"] or normalized in self._session_keys["name_city"]):
                self._stats["soft_matches"] += 1
                return DedupeResult(
                    is_duplicate=False,  # NOT a hard duplicate
                    match_type=DedupeMatchType.NAME_CITY,
                    matched_lead_id=self._keys["name_city"].get(normalized),
                    is_soft_match=True
                )

        # No match found
        self._stats["unique"] += 1
        return DedupeResult(is_duplicate=False, match_type=None, matched_lead_id=None)

    # =========================================================================
    # KEY REGISTRATION
    # =========================================================================

    def register_lead(self, lead: EnhancedLead) -> List[DedupeKey]:
        """
        Register a lead's keys in the deduplicator.

        Should be called after a lead passes dedupe checks and is being added.
        Keys are added to both the in-memory cache and session tracking.

        Args:
            lead: Lead to register

        Returns:
            List of DedupeKey objects created
        """
        keys = []
        now = datetime.utcnow()

        # Primary keys
        if lead.place_id:
            normalized = lead.place_id.lower()
            self._keys["place_id"][normalized] = lead.lead_id
            self._session_keys["place_id"].add(normalized)
            keys.append(DedupeKey("place_id", normalized, lead.lead_id, now))

        if lead.source_url:
            normalized = lead.source_url.lower()
            self._keys["source_url"][normalized] = lead.lead_id
            self._session_keys["source_url"].add(normalized)
            keys.append(DedupeKey("source_url", normalized, lead.lead_id, now))

        # Secondary keys
        if lead.email:
            normalized = self.normalize_email(lead.email)
            if normalized:
                self._keys["email"][normalized] = lead.lead_id
                self._session_keys["email"].add(normalized)
                keys.append(DedupeKey("email", normalized, lead.lead_id, now))

        if lead.phone:
            normalized = self.normalize_phone(lead.phone)
            if normalized:
                self._keys["phone"][normalized] = lead.lead_id
                self._session_keys["phone"].add(normalized)
                keys.append(DedupeKey("phone", normalized, lead.lead_id, now))

        # Soft match key
        if lead.business_name and lead.city:
            normalized = self.normalize_name_city(lead.business_name, lead.city)
            if normalized:
                self._keys["name_city"][normalized] = lead.lead_id
                self._session_keys["name_city"].add(normalized)
                keys.append(DedupeKey("name_city", normalized, lead.lead_id, now))

        return keys

    def flush_session_keys_to_sheets(self) -> int:
        """
        Write all session keys to Google Sheets.

        Should be called after a batch of leads have been processed.

        Returns:
            Number of keys written
        """
        if not self.sheets:
            raise ValueError("Sheets manager not configured")

        # Collect all keys to write
        keys = []
        now = datetime.utcnow()

        for key_type, values in self._session_keys.items():
            for key_value in values:
                lead_id = self._keys[key_type].get(key_value, "")
                keys.append(DedupeKey(key_type, key_value, lead_id, now))

        if keys:
            self.sheets.append_dedupe_keys(keys)

        # Clear session keys
        for key_type in self._session_keys:
            self._session_keys[key_type].clear()

        return len(keys)

    # =========================================================================
    # BATCH PROCESSING
    # =========================================================================

    def filter_duplicates(self, leads: List[EnhancedLead]) -> Tuple[List[EnhancedLead], List[EnhancedLead]]:
        """
        Filter a list of leads, removing duplicates.

        Returns two lists:
        - Unique leads (passed all checks)
        - Duplicate leads (blocked by hard dedupe)

        Soft matches are included in unique leads but with soft_match=True.

        Args:
            leads: List of leads to filter

        Returns:
            Tuple of (unique_leads, duplicate_leads)
        """
        unique = []
        duplicates = []

        for lead in leads:
            result = self.check_duplicate(
                place_id=lead.place_id,
                source_url=lead.source_url,
                email=lead.email,
                phone=lead.phone,
                business_name=lead.business_name,
                city=lead.city
            )

            if result.should_block:
                duplicates.append(lead)
            else:
                # Handle soft match
                if result.is_soft_match:
                    lead.soft_match = True
                    lead.soft_match_lead_id = result.matched_lead_id

                # Register the lead's keys for future checks
                self.register_lead(lead)
                unique.append(lead)

        return unique, duplicates

    # =========================================================================
    # STATS
    # =========================================================================

    def get_stats(self) -> Dict[str, int]:
        """Get deduplication statistics."""
        return self._stats.copy()

    def reset_stats(self):
        """Reset statistics counters."""
        self._stats = {
            "total_checked": 0,
            "hard_duplicates": 0,
            "soft_matches": 0,
            "unique": 0,
        }

    def clear_session(self):
        """Clear session-specific data (keys and stats)."""
        for key_type in self._session_keys:
            self._session_keys[key_type].clear()
        self.reset_stats()
