"""OpenAI-powered lead enrichment with retry logic."""

import time
from openai import OpenAI, APIStatusError, RateLimitError, AuthenticationError
from typing import List
from src.models import Lead, EnrichedLead
from config.prompts import LEAD_ENRICHMENT_SYSTEM_PROMPT


# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 2.0
MAX_BACKOFF_SECONDS = 30.0
BACKOFF_MULTIPLIER = 2.0


class OpenAIKeyError(Exception):
    """Raised when OpenAI API key is invalid - enrichment should be disabled."""
    pass


class LeadEnricher:
    """AI-powered lead enrichment using OpenAI GPT-4o with retry logic."""

    def __init__(self, api_key: str, model: str = "gpt-4o", temperature: float = 0.8):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.temperature = temperature
        self._disabled = False  # Set to True on auth error to skip further calls

    def _call_openai_with_retry(self, messages: list) -> str:
        """
        Call OpenAI API with exponential backoff retry for 429/529 errors.

        Fails fast on authentication errors (401) - sets _disabled flag.

        Args:
            messages: List of message dicts for chat completion

        Returns:
            AI response content

        Raises:
            OpenAIKeyError: If API key is invalid (fail fast, disables enrichment)
            Exception: If all retries fail for retryable errors
        """
        # Check if we've been disabled due to auth error
        if self._disabled:
            raise OpenAIKeyError("OpenAI enrichment disabled: invalid API key (detected earlier)")

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

            except AuthenticationError as e:
                # 401 - Invalid API key - fail fast, don't retry
                self._disabled = True
                error_msg = str(e)
                # Log without exposing key details
                print(f"    [OPENAI] Authentication failed - API key invalid")
                print(f"    [OPENAI] Enrichment disabled for this run")
                raise OpenAIKeyError(f"Invalid API key: {error_msg[:100]}")

            except RateLimitError as e:
                # 429 - Rate limited
                last_error = e
                if attempt < MAX_RETRIES:
                    print(f"    Rate limited (429), retry {attempt}/{MAX_RETRIES} in {backoff:.1f}s...")
                    time.sleep(backoff)
                    backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_SECONDS)

            except APIStatusError as e:
                # Check for 401 (auth) - fail fast
                if e.status_code == 401:
                    self._disabled = True
                    print(f"    [OPENAI] Authentication failed (401) - API key invalid")
                    print(f"    [OPENAI] Enrichment disabled for this run")
                    raise OpenAIKeyError(f"Invalid API key (401): {str(e)[:100]}")

                # Check for 529 (overloaded) or other 5xx errors - retry
                if e.status_code == 529 or (500 <= e.status_code < 600):
                    last_error = e
                    if attempt < MAX_RETRIES:
                        print(f"    OpenAI overloaded ({e.status_code}), retry {attempt}/{MAX_RETRIES} in {backoff:.1f}s...")
                        time.sleep(backoff)
                        backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_SECONDS)
                else:
                    # Other non-retryable error (e.g., 400 bad request)
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
        """
        Enrich multiple leads with progress tracking.

        On auth errors: Fails fast and disables further enrichment.
        On other errors: Skips individual lead and continues.
        """
        enriched = []
        total = len(leads)
        skipped_auth_error = 0

        print(f"Enriching {total} leads with AI hooks...")

        for i, lead in enumerate(leads, 1):
            try:
                enriched_lead = self.enrich_lead(lead)
                enriched.append(enriched_lead)
                print(f"  [{i}/{total}] OK: {lead.business_name}")
            except OpenAIKeyError as e:
                # Auth error - stop enriching any more leads
                print(f"  [{i}/{total}] AUTH ERROR: {lead.business_name}")
                print(f"    OpenAI enrichment disabled: invalid key")
                skipped_auth_error = total - i + 1  # Count this and remaining leads
                break
            except Exception as e:
                print(f"  [{i}/{total}] FAILED: {lead.business_name}: {str(e)}")
                # Skip failed enrichments but continue
                continue

        # Summary
        print(f"Successfully enriched {len(enriched)}/{total} leads")
        if skipped_auth_error > 0:
            print(f"  Skipped {skipped_auth_error} leads due to auth error (enrichment disabled)")

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
