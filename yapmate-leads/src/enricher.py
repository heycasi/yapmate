"""OpenAI-powered lead enrichment."""

from openai import OpenAI
from typing import List
from src.models import Lead, EnrichedLead
from config.prompts import LEAD_ENRICHMENT_SYSTEM_PROMPT


class LeadEnricher:
    """AI-powered lead enrichment using OpenAI GPT-4o"""

    def __init__(self, api_key: str, model: str = "gpt-4o", temperature: float = 0.8):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.temperature = temperature

    def enrich_lead(self, lead: Lead) -> EnrichedLead:
        """
        Generate personalized hook for a single lead

        Args:
            lead: Raw lead from scraper

        Returns:
            EnrichedLead with AI-generated hook
        """
        # Build context for AI
        context = self._build_lead_context(lead)

        # Call OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            messages=[
                {"role": "system", "content": LEAD_ENRICHMENT_SYSTEM_PROMPT},
                {"role": "user", "content": context}
            ]
        )

        ai_hook = response.choices[0].message.content.strip()

        return EnrichedLead(
            lead=lead,
            ai_hook=ai_hook
        )

    def enrich_leads(self, leads: List[Lead]) -> List[EnrichedLead]:
        """Enrich multiple leads with progress tracking"""
        enriched = []
        total = len(leads)

        print(f"🤖 Enriching {total} leads with AI hooks...")

        for i, lead in enumerate(leads, 1):
            try:
                enriched_lead = self.enrich_lead(lead)
                enriched.append(enriched_lead)
                print(f"  [{i}/{total}] ✓ {lead.business_name}")
            except Exception as e:
                print(f"  [{i}/{total}] ✗ {lead.business_name}: {str(e)}")
                # Skip failed enrichments but continue
                continue

        print(f"✅ Successfully enriched {len(enriched)}/{total} leads")
        return enriched

    def _build_lead_context(self, lead: Lead) -> str:
        """Build context string for AI"""
        parts = [
            f"Business: {lead.business_name}",
            f"Trade: {lead.trade}",
            f"Location: {lead.city}"
        ]

        if lead.website:
            parts.append(f"Has website: {lead.website}")
        else:
            parts.append("No website (likely sole trader)")

        return "\n".join(parts)
