"""Apify API client for scraping Google Maps leads.

Features:
- Heartbeat logging every 20 seconds while waiting
- Hard timeout that guarantees exit
- Clear error messages on timeout
"""

import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from apify_client import ApifyClient
from typing import List, Optional
from src.models import Lead
from src.config import QUERY_PREFIXES

# Default timeout for Apify actor runs (seconds)
DEFAULT_TIMEOUT_SECONDS = 180
HEARTBEAT_INTERVAL_SECONDS = 20


class ApifyTimeoutError(Exception):
    """Raised when Apify scraping exceeds timeout."""
    pass


class ApifyLeadScraper:
    """Wrapper for Apify Google Maps Scraper with heartbeat and timeout."""

    def __init__(self, api_token: str, actor_id: str, timeout_seconds: Optional[int] = None):
        self.client = ApifyClient(api_token)
        self.actor_id = actor_id
        # Get timeout from env or use provided value or default
        self.timeout_seconds = timeout_seconds or int(
            os.getenv("APIFY_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))
        )
        self._stop_heartbeat = threading.Event()

    def _heartbeat_thread(self, trade: str, city: str, start_time: float):
        """Background thread that logs heartbeat every 20 seconds."""
        while not self._stop_heartbeat.is_set():
            elapsed = int(time.time() - start_time)
            remaining = self.timeout_seconds - elapsed
            print(f"   [HEARTBEAT] Apify scraping {trade} in {city}... "
                  f"{elapsed}s elapsed, {remaining}s remaining", flush=True)
            # Wait for interval or stop signal
            self._stop_heartbeat.wait(HEARTBEAT_INTERVAL_SECONDS)

    def _run_apify_actor(self, run_input: dict) -> dict:
        """Execute Apify actor (runs in thread pool)."""
        return self.client.actor(self.actor_id).call(
            run_input=run_input,
            timeout_secs=self.timeout_seconds
        )

    def scrape_leads(
        self,
        trade: str,
        city: str,
        max_results: int = 50,
        query_prefix: Optional[str] = None,
    ) -> List[Lead]:
        """
        Scrape Google Maps for tradespeople with heartbeat and hard timeout.

        Args:
            trade: Type of tradesperson (e.g., "Plumber", "Electrician")
            city: UK city (e.g., "Glasgow", "Liverpool")
            max_results: Maximum number of results to return
            query_prefix: Optional prefix for query (e.g., "Local ", "Independent ")
                         If None, randomly selects from QUERY_PREFIXES

        Returns:
            List of Lead objects

        Raises:
            ApifyTimeoutError: If scraping exceeds timeout
        """
        # Select query prefix (random if not specified)
        # This helps target smaller/local businesses in Google Maps
        if query_prefix is None:
            query_prefix = random.choice(QUERY_PREFIXES)

        search_query = f"{query_prefix}{trade} in {city}, UK"

        # Configure actor input
        run_input = {
            "searchStringsArray": [search_query],
            "maxCrawledPlacesPerSearch": max_results,
            "language": "en",
            "countryCode": "gb",
            "includeHistogram": False,
            "includeOpeningHours": False,
            "includePeopleAlsoSearch": False,
            "maxReviews": 0,
            "maxImages": 0,
            "exportPlaceUrls": False,
            "additionalInfo": False,
            "emailsOnly": False,
            "skipClosedPlaces": True
        }

        print(f"🔍 Scraping Google Maps: \"{search_query}\"", flush=True)
        print(f"   Timeout: {self.timeout_seconds} seconds", flush=True)
        print(f"   Heartbeat: every {HEARTBEAT_INTERVAL_SECONDS} seconds", flush=True)

        start_time = time.time()
        self._stop_heartbeat.clear()

        # Start heartbeat thread
        heartbeat = threading.Thread(
            target=self._heartbeat_thread,
            args=(trade, city, start_time),
            daemon=True
        )
        heartbeat.start()

        try:
            # Run Apify with hard timeout using ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(self._run_apify_actor, run_input)
                try:
                    # Wait for result with hard timeout (add 30s buffer for API overhead)
                    run = future.result(timeout=self.timeout_seconds + 30)
                except FuturesTimeoutError:
                    elapsed = int(time.time() - start_time)
                    error_msg = (f"APIFY TIMEOUT: Scraping {trade} in {city} exceeded "
                                f"{self.timeout_seconds}s limit (ran for {elapsed}s)")
                    print(f"\n❌ {error_msg}", flush=True)
                    raise ApifyTimeoutError(error_msg)

        finally:
            # Stop heartbeat thread
            self._stop_heartbeat.set()
            heartbeat.join(timeout=2)

        elapsed = int(time.time() - start_time)
        print(f"   Apify completed in {elapsed}s, fetching results...", flush=True)

        # Fetch results from dataset
        leads = []
        for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
            lead = Lead(
                business_name=item.get("title", "Unknown Business"),
                email=item.get("email"),
                phone=item.get("phone"),
                website=item.get("website"),
                trade=trade,
                city=city,
                lead_source="Google Maps - Apify",
                raw_data=item
            )
            leads.append(lead)

        print(f"✅ Found {len(leads)} {trade}s in {city} (took {elapsed}s)", flush=True)
        return leads
