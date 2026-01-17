"""Apify API client for scraping Google Maps leads."""

from apify_client import ApifyClient
from typing import List
from src.models import Lead


class ApifyLeadScraper:
    """Wrapper for Apify Google Maps Scraper"""

    def __init__(self, api_token: str, actor_id: str):
        self.client = ApifyClient(api_token)
        self.actor_id = actor_id

    def scrape_leads(
        self,
        trade: str,
        city: str,
        max_results: int = 50
    ) -> List[Lead]:
        """
        Scrape Google Maps for tradespeople

        Args:
            trade: Type of tradesperson (e.g., "Plumber", "Electrician")
            city: UK city (e.g., "Glasgow", "Liverpool")
            max_results: Maximum number of results to return

        Returns:
            List of Lead objects (may have missing emails - will be extracted from websites later)
        """
        # Configure actor input
        run_input = {
            "searchStringsArray": [f"{trade} in {city}, UK"],
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
            "emailsOnly": False  # Get all results - we'll find emails from websites
        }

        # Run actor and wait for results
        print(f"🔍 Scraping Google Maps for {trade}s in {city}...")
        run = self.client.actor(self.actor_id).call(run_input=run_input)

        # Fetch results
        leads = []
        for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
            lead = Lead(
                business_name=item.get("title", "Unknown Business"),
                email=item.get("email"),  # May be None - will extract from website later
                phone=item.get("phone"),
                website=item.get("website"),
                trade=trade,
                city=city,
                lead_source="Google Maps - Apify",
                raw_data=item
            )
            leads.append(lead)

        print(f"✅ Found {len(leads)} {trade}s in {city}")
        return leads
