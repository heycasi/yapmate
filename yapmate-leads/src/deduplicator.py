"""Lead deduplication using business_name|city composite key."""

from typing import List, Set
from src.models import Lead


class LeadDeduplicator:
    """Prevent duplicate leads using business_name|city composite key"""

    def __init__(self, existing_keys: Set[str]):
        """
        Args:
            existing_keys: Set of existing dedup keys from Google Sheets
        """
        self.existing_keys = existing_keys
        self.session_keys = set()  # Track keys added in current session

    def filter_duplicates(self, leads: List[Lead]) -> List[Lead]:
        """
        Remove duplicate leads

        Args:
            leads: List of raw leads

        Returns:
            Filtered list with duplicates removed
        """
        unique_leads = []
        duplicates = 0

        for lead in leads:
            key = lead.dedup_key

            # Check if already exists in sheet or current session
            if key in self.existing_keys or key in self.session_keys:
                duplicates += 1
                continue

            # Add to unique list and track in session
            unique_leads.append(lead)
            self.session_keys.add(key)

        if duplicates > 0:
            print(f"🔍 Filtered out {duplicates} duplicate leads")

        print(f"✅ {len(unique_leads)} unique leads ready for enrichment")
        return unique_leads
