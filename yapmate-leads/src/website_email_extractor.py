"""Website Email Extraction for City-Trade Sequencing Engine.

This module discovers email addresses from business websites when
Google Maps listings don't include an email.

Pipeline placement:
    Scrape → Dedupe → Website Email Discovery → Enrichment → Eligibility → Storage

Features:
- Fetches homepage HTML
- Extracts mailto: links and regex emails
- Auto-crawls common contact paths
- Domain validation (email domain must match website)
- Prioritizes personal emails over role-based emails
- Respects robots.txt
- Timeout and page limits for safety
"""

import re
import time
from typing import Optional, List, Tuple, Set, Dict, Any
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup


@dataclass
class EmailDiscoveryResult:
    """Result of email discovery for a single lead."""

    discovered_email: Optional[str] = None
    email_source: str = "none"  # "maps" | "website" | "none"
    discovery_url: Optional[str] = None
    all_emails_found: List[str] = field(default_factory=list)
    pages_crawled: int = 0
    error: Optional[str] = None


@dataclass
class BatchDiscoveryStats:
    """Statistics for a batch discovery operation."""

    total_leads: int = 0
    leads_with_maps_email: int = 0
    leads_with_website_email: int = 0
    leads_with_no_email: int = 0
    total_pages_crawled: int = 0
    total_errors: int = 0

    @property
    def discovery_success_rate(self) -> float:
        """Percentage of leads that ended up with an email."""
        if self.total_leads == 0:
            return 0.0
        with_email = self.leads_with_maps_email + self.leads_with_website_email
        return (with_email / self.total_leads) * 100


class WebsiteEmailExtractor:
    """
    Extracts email addresses from business websites.

    Implements:
    - Homepage and contact page crawling
    - mailto: link extraction
    - Regex-based email extraction
    - Domain validation
    - Email prioritization (personal > role-based)
    - robots.txt respect
    - Timeout and page limits
    """

    # Common contact page paths to crawl
    CONTACT_PATHS = [
        "/contact",
        "/contact-us",
        "/contactus",
        "/get-in-touch",
        "/about",
        "/about-us",
        "/privacy",
        "/terms",
    ]

    # Email regex pattern
    EMAIL_PATTERN = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
    )

    # Role-based email prefixes (less preferred)
    ROLE_PREFIXES = {
        "info@", "contact@", "hello@", "enquiries@", "enquiry@",
        "sales@", "support@", "admin@", "office@", "mail@",
        "general@", "help@", "team@", "customerservice@",
    }

    # Invalid email patterns (never use)
    INVALID_PATTERNS = {
        "noreply@", "no-reply@", "donotreply@", "do-not-reply@",
        "mailer-daemon@", "postmaster@", "bounce@", "auto@",
    }

    # Placeholder domains to filter
    PLACEHOLDER_DOMAINS = {
        "example.com", "test.com", "domain.com", "yoursite.com",
        "email.com", "company.com", "website.com", "yourdomain.com",
        "sentry.io", "sentry-next.wixpress.com",  # Error tracking
    }

    # File extensions that indicate non-HTML content
    NON_HTML_EXTENSIONS = {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".zip", ".rar", ".tar", ".gz", ".jpg", ".jpeg", ".png",
        ".gif", ".svg", ".mp3", ".mp4", ".avi", ".mov",
    }

    # User agent
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    def __init__(
        self,
        timeout: int = 10,
        max_pages_per_site: int = 3,
        delay_between_requests: float = 0.5,
        respect_robots_txt: bool = True,
    ):
        """
        Initialize the extractor.

        Args:
            timeout: Request timeout in seconds
            max_pages_per_site: Maximum pages to crawl per website
            delay_between_requests: Delay between requests (seconds)
            respect_robots_txt: Whether to check robots.txt
        """
        self.timeout = timeout
        self.max_pages_per_site = max_pages_per_site
        self.delay_between_requests = delay_between_requests
        self.respect_robots_txt = respect_robots_txt

        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": self.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-GB,en;q=0.9",
        })

        # Cache for robots.txt parsers
        self._robots_cache: Dict[str, RobotFileParser] = {}

    # =========================================================================
    # ROBOTS.TXT
    # =========================================================================

    def _get_robots_parser(self, base_url: str) -> Optional[RobotFileParser]:
        """
        Get robots.txt parser for a domain.

        Args:
            base_url: Base URL of the website

        Returns:
            RobotFileParser or None if not available
        """
        parsed = urlparse(base_url)
        domain = f"{parsed.scheme}://{parsed.netloc}"

        if domain in self._robots_cache:
            return self._robots_cache[domain]

        try:
            robots_url = f"{domain}/robots.txt"
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            self._robots_cache[domain] = rp
            return rp
        except Exception:
            # If we can't read robots.txt, assume allowed
            self._robots_cache[domain] = None
            return None

    def _is_allowed_by_robots(self, url: str) -> bool:
        """
        Check if URL is allowed by robots.txt.

        Args:
            url: URL to check

        Returns:
            True if allowed (or robots.txt not available)
        """
        if not self.respect_robots_txt:
            return True

        try:
            rp = self._get_robots_parser(url)
            if rp is None:
                return True
            return rp.can_fetch(self.USER_AGENT, url)
        except Exception:
            return True

    # =========================================================================
    # URL HELPERS
    # =========================================================================

    def _normalize_url(self, url: str) -> str:
        """Ensure URL has a scheme."""
        if not url:
            return ""
        url = url.strip()
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        return url

    def _get_domain(self, url: str) -> str:
        """Extract domain from URL."""
        try:
            parsed = urlparse(self._normalize_url(url))
            domain = parsed.netloc.lower()
            # Remove www. prefix for comparison
            if domain.startswith("www."):
                domain = domain[4:]
            return domain
        except Exception:
            return ""

    def _is_non_html_url(self, url: str) -> bool:
        """Check if URL points to non-HTML content."""
        url_lower = url.lower()
        return any(url_lower.endswith(ext) for ext in self.NON_HTML_EXTENSIONS)

    # =========================================================================
    # EMAIL VALIDATION
    # =========================================================================

    def _is_valid_email_format(self, email: str) -> bool:
        """Check if string matches email format."""
        return bool(self.EMAIL_PATTERN.match(email))

    def _get_email_domain(self, email: str) -> str:
        """Extract domain from email address."""
        if "@" not in email:
            return ""
        return email.split("@")[-1].lower()

    def _domain_matches(self, email: str, website_domain: str) -> bool:
        """
        Check if email domain matches website domain.

        Allows:
        - Exact match: joe@company.com matches company.com
        - Subdomain: joe@mail.company.com matches company.com
        """
        email_domain = self._get_email_domain(email)
        website_domain = website_domain.lower()

        # Remove www. from both
        if email_domain.startswith("www."):
            email_domain = email_domain[4:]
        if website_domain.startswith("www."):
            website_domain = website_domain[4:]

        # Exact match
        if email_domain == website_domain:
            return True

        # Subdomain match (email domain ends with website domain)
        if email_domain.endswith("." + website_domain):
            return True

        return False

    def _is_valid_business_email(self, email: str, website_domain: str) -> bool:
        """
        Check if email is a valid business email.

        Args:
            email: Email address to validate
            website_domain: Domain of the business website

        Returns:
            True if valid business email
        """
        email = email.lower().strip()

        # Must match email format
        if not self._is_valid_email_format(email):
            return False

        # Filter out invalid patterns
        for pattern in self.INVALID_PATTERNS:
            if email.startswith(pattern):
                return False

        # Filter out placeholder domains
        email_domain = self._get_email_domain(email)
        if email_domain in self.PLACEHOLDER_DOMAINS:
            return False

        # Filter out file extensions that snuck through regex
        if any(email.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js"]):
            return False

        # Domain must match website
        if website_domain and not self._domain_matches(email, website_domain):
            return False

        return True

    def _is_role_email(self, email: str) -> bool:
        """Check if email is a role-based address."""
        email_lower = email.lower()
        return any(email_lower.startswith(prefix) for prefix in self.ROLE_PREFIXES)

    def _prioritize_emails(self, emails: List[str]) -> List[str]:
        """
        Sort emails by priority.

        Personal emails (john@...) come before role emails (info@...).

        Args:
            emails: List of valid emails

        Returns:
            Sorted list with personal emails first
        """
        personal = [e for e in emails if not self._is_role_email(e)]
        role = [e for e in emails if self._is_role_email(e)]
        return personal + role

    # =========================================================================
    # PAGE FETCHING
    # =========================================================================

    def _fetch_page(self, url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Fetch a page and return its HTML content.

        Args:
            url: URL to fetch

        Returns:
            Tuple of (html_content, error_message)
        """
        try:
            # Check robots.txt
            if not self._is_allowed_by_robots(url):
                return (None, "Blocked by robots.txt")

            # Skip non-HTML URLs
            if self._is_non_html_url(url):
                return (None, "Non-HTML URL")

            response = self.session.get(
                url,
                timeout=self.timeout,
                allow_redirects=True
            )

            # Check content type
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return (None, f"Non-HTML content: {content_type}")

            if response.status_code != 200:
                return (None, f"HTTP {response.status_code}")

            return (response.text, None)

        except requests.exceptions.Timeout:
            return (None, "Timeout")
        except requests.exceptions.ConnectionError:
            return (None, "Connection error")
        except requests.exceptions.TooManyRedirects:
            return (None, "Too many redirects")
        except Exception as e:
            return (None, str(e))

    # =========================================================================
    # EMAIL EXTRACTION
    # =========================================================================

    def _extract_emails_from_html(self, html: str, website_domain: str) -> List[str]:
        """
        Extract valid emails from HTML content.

        Args:
            html: HTML content
            website_domain: Domain for validation

        Returns:
            List of valid unique emails
        """
        emails_found: Set[str] = set()

        try:
            soup = BeautifulSoup(html, "html.parser")

            # Method 1: Extract mailto: links
            for link in soup.find_all("a", href=True):
                href = link["href"]
                if href.startswith("mailto:"):
                    email = href.replace("mailto:", "").split("?")[0].strip().lower()
                    if self._is_valid_business_email(email, website_domain):
                        emails_found.add(email)

            # Method 2: Regex search in visible text
            text = soup.get_text(separator=" ")
            for match in self.EMAIL_PATTERN.findall(text):
                email = match.lower().strip()
                if self._is_valid_business_email(email, website_domain):
                    emails_found.add(email)

            # Method 3: Search in href attributes (sometimes emails are in links)
            for link in soup.find_all("a", href=True):
                href = link["href"]
                for match in self.EMAIL_PATTERN.findall(href):
                    email = match.lower().strip()
                    if self._is_valid_business_email(email, website_domain):
                        emails_found.add(email)

        except Exception:
            pass

        return list(emails_found)

    # =========================================================================
    # MAIN DISCOVERY
    # =========================================================================

    def discover_email(self, website_url: str) -> EmailDiscoveryResult:
        """
        Discover email from a business website.

        Crawls homepage and contact pages to find a valid email.

        Args:
            website_url: Business website URL

        Returns:
            EmailDiscoveryResult with findings
        """
        result = EmailDiscoveryResult()

        if not website_url:
            result.error = "No website URL"
            return result

        # Normalize URL
        base_url = self._normalize_url(website_url)
        website_domain = self._get_domain(base_url)

        if not website_domain:
            result.error = "Invalid URL"
            return result

        all_emails: List[str] = []
        pages_crawled = 0

        # Build list of URLs to try
        urls_to_try = [base_url]
        for path in self.CONTACT_PATHS:
            urls_to_try.append(urljoin(base_url, path))

        # Crawl pages
        for url in urls_to_try:
            if pages_crawled >= self.max_pages_per_site:
                break

            # Add delay between requests
            if pages_crawled > 0:
                time.sleep(self.delay_between_requests)

            html, error = self._fetch_page(url)
            if html:
                pages_crawled += 1
                emails = self._extract_emails_from_html(html, website_domain)

                for email in emails:
                    if email not in all_emails:
                        all_emails.append(email)

                # If we found emails on this page, record the URL
                if emails and not result.discovery_url:
                    result.discovery_url = url

        result.pages_crawled = pages_crawled
        result.all_emails_found = all_emails

        # Prioritize and select best email
        if all_emails:
            prioritized = self._prioritize_emails(all_emails)
            result.discovered_email = prioritized[0]
            result.email_source = "website"

        return result

    def discover_emails_batch(
        self,
        leads: List[Any],
        website_field: str = "website",
        email_field: str = "email",
        progress_callback: callable = None
    ) -> Tuple[List[Any], BatchDiscoveryStats]:
        """
        Discover emails for a batch of leads.

        Args:
            leads: List of lead objects/dicts
            website_field: Field name for website URL
            email_field: Field name for existing email
            progress_callback: Optional callback(index, total, lead)

        Returns:
            Tuple of (updated_leads, stats)
        """
        stats = BatchDiscoveryStats(total_leads=len(leads))

        for i, lead in enumerate(leads):
            # Get current values
            if hasattr(lead, website_field):
                website = getattr(lead, website_field)
                existing_email = getattr(lead, email_field, None)
            else:
                website = lead.get(website_field)
                existing_email = lead.get(email_field)

            # Progress callback
            if progress_callback:
                progress_callback(i, len(leads), lead)

            # If already has email from maps, keep it
            if existing_email:
                stats.leads_with_maps_email += 1

                # Set email_source to "maps"
                if hasattr(lead, "email_source"):
                    lead.email_source = "maps"
                elif isinstance(lead, dict):
                    lead["email_source"] = "maps"

                continue

            # Try to discover email from website
            if website:
                result = self.discover_email(website)
                stats.total_pages_crawled += result.pages_crawled

                if result.error:
                    stats.total_errors += 1

                if result.discovered_email:
                    stats.leads_with_website_email += 1

                    # Update lead with discovered email
                    if hasattr(lead, email_field):
                        setattr(lead, email_field, result.discovered_email)
                        if hasattr(lead, "discovered_email"):
                            lead.discovered_email = result.discovered_email
                        if hasattr(lead, "email_source"):
                            lead.email_source = "website"
                        if hasattr(lead, "discovery_url"):
                            lead.discovery_url = result.discovery_url
                    elif isinstance(lead, dict):
                        lead[email_field] = result.discovered_email
                        lead["discovered_email"] = result.discovered_email
                        lead["email_source"] = "website"
                        lead["discovery_url"] = result.discovery_url
                else:
                    stats.leads_with_no_email += 1
            else:
                stats.leads_with_no_email += 1

        return (leads, stats)


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

def discover_email_from_website(
    url: str,
    timeout: int = 10,
    max_pages: int = 3
) -> Optional[str]:
    """
    Convenience function to discover email from a website.

    Args:
        url: Website URL
        timeout: Request timeout
        max_pages: Maximum pages to crawl

    Returns:
        Email address or None
    """
    extractor = WebsiteEmailExtractor(
        timeout=timeout,
        max_pages_per_site=max_pages
    )
    result = extractor.discover_email(url)
    return result.discovered_email


# =============================================================================
# CLI FOR TESTING
# =============================================================================

def main():
    """CLI for testing email extraction."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Extract email from a business website"
    )
    parser.add_argument(
        "url",
        help="Website URL to extract email from"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=10,
        help="Request timeout in seconds"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=3,
        help="Maximum pages to crawl"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed output"
    )

    args = parser.parse_args()

    extractor = WebsiteEmailExtractor(
        timeout=args.timeout,
        max_pages_per_site=args.max_pages
    )

    print(f"Extracting email from: {args.url}")
    print("-" * 50)

    result = extractor.discover_email(args.url)

    if args.verbose:
        print(f"Pages crawled: {result.pages_crawled}")
        print(f"All emails found: {result.all_emails_found}")
        print(f"Discovery URL: {result.discovery_url}")
        if result.error:
            print(f"Error: {result.error}")
        print("-" * 50)

    if result.discovered_email:
        print(f"Discovered email: {result.discovered_email}")
        print(f"Source: {result.email_source}")
    else:
        print("No email found")
        sys.exit(1)


if __name__ == "__main__":
    main()
