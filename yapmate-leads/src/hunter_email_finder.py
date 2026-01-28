"""Hunter.io Email Finder Integration.

Uses Hunter.io API to find business emails when website scraping fails.
Hunter.io provides:
- Domain Search: Find all emails associated with a domain
- Email Finder: Find specific person's email by name + company

API Documentation: https://hunter.io/api-documentation
"""

import os
import re
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import urllib.request
import urllib.parse
import urllib.error
import json


@dataclass
class HunterResult:
    """Result from Hunter.io API call."""
    email: Optional[str] = None
    confidence: int = 0
    source: str = "hunter"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    all_emails: List[str] = None
    error: Optional[str] = None

    def __post_init__(self):
        if self.all_emails is None:
            self.all_emails = []


class HunterEmailFinder:
    """
    Find business emails using Hunter.io API.

    Features:
    - Domain search (find all emails for a company)
    - Rate limiting (respects API limits)
    - Caching to avoid duplicate lookups
    - Prioritizes personal emails over generic ones
    """

    BASE_URL = "https://api.hunter.io/v2"

    # Generic email prefixes (less preferred)
    GENERIC_PREFIXES = {
        "info", "contact", "hello", "enquiries", "enquiry",
        "sales", "support", "admin", "office", "mail",
        "general", "help", "team", "customerservice",
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        requests_per_second: float = 1.0,
        cache_enabled: bool = True,
    ):
        """
        Initialize Hunter.io client.

        Args:
            api_key: Hunter.io API key (defaults to HUNTER_API_KEY env var)
            requests_per_second: Rate limit for API calls
            cache_enabled: Whether to cache results
        """
        self.api_key = api_key or os.getenv("HUNTER_API_KEY")
        self.requests_per_second = requests_per_second
        self.cache_enabled = cache_enabled

        self._last_request_time: float = 0
        self._domain_cache: Dict[str, HunterResult] = {}

    @property
    def is_configured(self) -> bool:
        """Check if Hunter.io is configured with API key."""
        return bool(self.api_key)

    def _rate_limit(self):
        """Apply rate limiting between requests."""
        if self.requests_per_second <= 0:
            return

        min_interval = 1.0 / self.requests_per_second
        elapsed = time.time() - self._last_request_time

        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)

        self._last_request_time = time.time()

    def _extract_domain(self, url: str) -> Optional[str]:
        """Extract domain from URL."""
        if not url:
            return None

        # Add scheme if missing
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc.lower()

            # Remove www. prefix
            if domain.startswith("www."):
                domain = domain[4:]

            return domain if domain else None
        except Exception:
            return None

    def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make API request to Hunter.io.

        Args:
            endpoint: API endpoint (e.g., "domain-search")
            params: Query parameters

        Returns:
            JSON response as dict
        """
        if not self.api_key:
            return {"error": "No API key configured"}

        # Apply rate limiting
        self._rate_limit()

        # Build URL
        params["api_key"] = self.api_key
        query_string = urllib.parse.urlencode(params)
        url = f"{self.BASE_URL}/{endpoint}?{query_string}"

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "YapMate-Leads/1.0",
                    "Accept": "application/json",
                }
            )

            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            try:
                error_json = json.loads(error_body)
                error_msg = error_json.get("errors", [{}])[0].get("details", str(e))
            except:
                error_msg = str(e)
            return {"error": f"HTTP {e.code}: {error_msg}"}

        except urllib.error.URLError as e:
            return {"error": f"Connection error: {e.reason}"}

        except Exception as e:
            return {"error": str(e)}

    def _is_generic_email(self, email: str) -> bool:
        """Check if email is a generic/role-based address."""
        if not email or "@" not in email:
            return False
        local_part = email.split("@")[0].lower()
        return local_part in self.GENERIC_PREFIXES

    def _prioritize_emails(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sort emails by priority.

        Personal emails come before generic ones, higher confidence first.
        """
        def sort_key(email_data):
            email = email_data.get("value", "")
            confidence = email_data.get("confidence", 0)
            is_generic = self._is_generic_email(email)
            # Personal emails get priority (0), generic get (1)
            # Then sort by confidence descending
            return (1 if is_generic else 0, -confidence)

        return sorted(emails, key=sort_key)

    def find_email_for_domain(self, domain: str) -> HunterResult:
        """
        Find best email for a domain using Hunter.io domain search.

        Args:
            domain: Company domain (e.g., "acme.co.uk")

        Returns:
            HunterResult with best email found
        """
        result = HunterResult()

        if not domain:
            result.error = "No domain provided"
            return result

        # Clean domain
        domain = domain.lower().strip()
        if domain.startswith("www."):
            domain = domain[4:]

        # Check cache
        if self.cache_enabled and domain in self._domain_cache:
            return self._domain_cache[domain]

        # Make API request
        response = self._make_request("domain-search", {
            "domain": domain,
            "limit": 10,  # Get up to 10 emails
        })

        if "error" in response:
            result.error = response["error"]
            return result

        # Extract emails from response
        data = response.get("data", {})
        emails = data.get("emails", [])

        if not emails:
            result.error = "No emails found"
            if self.cache_enabled:
                self._domain_cache[domain] = result
            return result

        # Prioritize and select best email
        prioritized = self._prioritize_emails(emails)
        best = prioritized[0]

        result.email = best.get("value")
        result.confidence = best.get("confidence", 0)
        result.first_name = best.get("first_name")
        result.last_name = best.get("last_name")
        result.position = best.get("position")
        result.all_emails = [e.get("value") for e in emails if e.get("value")]

        # Cache result
        if self.cache_enabled:
            self._domain_cache[domain] = result

        return result

    def find_email_for_website(self, website_url: str) -> HunterResult:
        """
        Find email for a business given their website URL.

        Args:
            website_url: Business website URL

        Returns:
            HunterResult with best email found
        """
        domain = self._extract_domain(website_url)
        if not domain:
            result = HunterResult()
            result.error = "Invalid website URL"
            return result

        return self.find_email_for_domain(domain)

    def get_account_info(self) -> Dict[str, Any]:
        """
        Get Hunter.io account info (for checking API usage).

        Returns:
            Account info dict with calls remaining, etc.
        """
        response = self._make_request("account", {})
        return response.get("data", response)

    def clear_cache(self):
        """Clear the domain cache."""
        self._domain_cache.clear()


def find_email_with_hunter(website_url: str) -> Optional[str]:
    """
    Convenience function to find email using Hunter.io.

    Args:
        website_url: Business website URL

    Returns:
        Email address or None
    """
    finder = HunterEmailFinder()
    if not finder.is_configured:
        return None

    result = finder.find_email_for_website(website_url)
    return result.email if result.email and not result.error else None


# CLI for testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python hunter_email_finder.py <domain_or_url>")
        sys.exit(1)

    finder = HunterEmailFinder()

    if not finder.is_configured:
        print("Error: HUNTER_API_KEY not set")
        sys.exit(1)

    target = sys.argv[1]
    print(f"Searching for emails: {target}")
    print("-" * 50)

    result = finder.find_email_for_website(target)

    if result.error:
        print(f"Error: {result.error}")
    elif result.email:
        print(f"Best email: {result.email}")
        print(f"Confidence: {result.confidence}%")
        if result.first_name:
            print(f"Name: {result.first_name} {result.last_name or ''}")
        if result.position:
            print(f"Position: {result.position}")
        if len(result.all_emails) > 1:
            print(f"All emails found: {', '.join(result.all_emails)}")
    else:
        print("No email found")
