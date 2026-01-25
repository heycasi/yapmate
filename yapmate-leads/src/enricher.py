"""OpenAI-powered lead enrichment with retry logic."""

import time
from openai import OpenAI, APIStatusError, RateLimitError
from typing import List
from src.models import Lead, EnrichedLead
from config.prompts import LEAD_ENRICHMENT_SYSTEM_PROMPT


# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 2.0
MAX_BACKOFF_SECONDS = 30.0
BACKOFF_MULTIPLIER = 2.0


class LeadEnricher:
    """AI-powered lead enrichment using OpenAI GPT-4o with retry logic."""

    def __init__(self, api_key: str, model: str = "gpt-4o", temperature: float = 0.8):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.temperature = temperature

    def _call_openai_with_retry(self, messages: list) -> str:
        """
        Call OpenAI API with exponential backoff retry for 429/529 errors.

        Args:
            messages: List of message dicts for chat completion

        Returns:
            AI response content

        Raises:
            Exception: If all retries fail
        """
        last_error = None
        backoff = INITIAL_BACKOFF_SECONDS

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    temperature=self.temperature,
                    messages=messages
                )
                return response.choices[0].message.content.strip()

            except RateLimitError as e:
                # 429 - Rate limited
                last_error = e
                if attempt < MAX_RETRIES:
                    print(f"    Rate limited (429), retry {attempt}/{MAX_RETRIES} in {backoff:.1f}s...")
                    time.sleep(backoff)
                    backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_SECONDS)

            except APIStatusError as e:
                # Check for 529 (overloaded) or other 5xx errors
                if e.status_code == 529 or (500 <= e.status_code < 600):
                    last_error = e
                    if attempt < MAX_RETRIES:
                        print(f"    OpenAI overloaded ({e.status_code}), retry {attempt}/{MAX_RETRIES} in {backoff:.1f}s...")
                        time.sleep(backoff)
                        backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_SECONDS)
                else:
                    # Non-retryable error
                    raise

            except Exception as e:
                # Non-retryable error
                raise

        # All retries exhausted
        raise Exception(f"OpenAI API failed after {MAX_RETRIES} retries: {last_error}")

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

        # Call OpenAI with retry
        messages = [
            {"role": "system", "content": LEAD_ENRICHMENT_SYSTEM_PROMPT},
            {"role": "user", "content": context}
        ]
        ai_hook = self._call_openai_with_retry(messages)

        return EnrichedLead(
            lead=lead,
            ai_hook=ai_hook
        )

    def enrich_leads(self, leads: List[Lead]) -> List[EnrichedLead]:
        """Enrich multiple leads with progress tracking"""
        enriched = []
        total = len(leads)

        print(f"Enriching {total} leads with AI hooks...")

        for i, lead in enumerate(leads, 1):
            try:
                enriched_lead = self.enrich_lead(lead)
                enriched.append(enriched_lead)
                print(f"  [{i}/{total}] OK: {lead.business_name}")
            except Exception as e:
                print(f"  [{i}/{total}] FAILED: {lead.business_name}: {str(e)}")
                # Skip failed enrichments but continue
                continue

        print(f"Successfully enriched {len(enriched)}/{total} leads")
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
