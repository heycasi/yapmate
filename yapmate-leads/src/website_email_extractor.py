"""Website Email Extraction for City-Trade Sequencing Engine.

This module discovers email addresses from business websites when
Google Maps listings don't include an email.

Pipeline placement:
    Scrape → Dedupe → Website Email Discovery → Enrichment → Eligibility → Storage

Features:
- Fetches homepage HTML
- Extracts mailto: links and regex emails
- Auto-crawls common contact paths
- Internal link discovery based on anchor text
- JSON-LD and microdata email extraction
- Email obfuscation handling (name [at] domain [dot] com)
- Domain validation (email domain must match website)
- Prioritizes personal emails over role-based emails
- Social media fallback (Facebook/Instagram)
- Hunter.io API fallback for professional email discovery
- Per-domain caching and throttling
- Respects robots.txt
- Timeout and page limits for safety
"""

import re
import json
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
    email_source: str = "none"  # "maps" | "website" | "facebook" | "instagram" | "none"
    discovery_url: Optional[str] = None
    all_emails_found: List[str] = field(default_factory=list)
    pages_crawled: int = 0
    domains_scanned: int = 0
    error: Optional[str] = None
    blocked_reason: Optional[str] = None  # If social media fetch was blocked


@dataclass
class BatchDiscoveryStats:
    """Statistics for a batch discovery operation."""

    total_leads: int = 0
    leads_with_maps_email: int = 0
    leads_with_website_email: int = 0
    leads_with_facebook_email: int = 0
    leads_with_instagram_email: int = 0
    leads_with_hunter_email: int = 0
    leads_with_no_email: int = 0
    total_pages_crawled: int = 0
    total_domains_scanned: int = 0
    total_errors: int = 0
    blocked_social_fetches: int = 0

    @property
    def discovery_success_rate(self) -> float:
        """Percentage of leads that ended up with an email."""
        if self.total_leads == 0:
            return 0.0
        with_email = (self.leads_with_maps_email + self.leads_with_website_email +
                      self.leads_with_facebook_email + self.leads_with_instagram_email +
                      self.leads_with_hunter_email)
        return (with_email / self.total_leads) * 100

    @property
    def emails_by_source(self) -> Dict[str, int]:
        """Return email counts by source."""
        return {
            "maps": self.leads_with_maps_email,
            "website": self.leads_with_website_email,
            "facebook": self.leads_with_facebook_email,
            "instagram": self.leads_with_instagram_email,
            "hunter": self.leads_with_hunter_email,
            "none": self.leads_with_no_email,
        }


class WebsiteEmailExtractor:
    """
    Extracts email addresses from business websites.

    Implements:
    - Homepage and contact page crawling
    - Internal link discovery based on anchor text
    - mailto: link extraction
    - Regex-based email extraction
    - JSON-LD and microdata email extraction
    - Email obfuscation handling
    - Domain validation
    - Email prioritization (personal > role-based)
    - Social media fallback (Facebook/Instagram)
    - Per-domain caching and throttling
    - robots.txt respect
    - Timeout and page limits
    """

    # Common contact page paths to crawl (extended list)
    CONTACT_PATHS = [
        "/contact",
        "/contact-us",
        "/contactus",
        "/get-in-touch",
        "/about",
        "/about-us",
        "/aboutus",
        "/privacy",
        "/privacy-policy",
        "/terms",
        "/terms-of-service",
        "/support",
        "/help",
        "/enquire",
        "/enquiry",
    ]

    # Anchor text patterns for internal link discovery
    CONTACT_ANCHOR_PATTERNS = [
        r"contact", r"about", r"privacy", r"terms", r"support",
        r"get\s*in\s*touch", r"enquir", r"help",
    ]

    # Email regex pattern
    EMAIL_PATTERN = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
    )

    # Obfuscation patterns: "name [at] domain [dot] com", "name(at)domain.com"
    OBFUSCATION_PATTERNS = [
        # [at] or (at) or {at} style
        re.compile(r'\b([A-Za-z0-9._%+-]+)\s*[\[\(\{]\s*at\s*[\]\)\}]\s*([A-Za-z0-9.-]+)\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*([A-Za-z]{2,7})\b', re.IGNORECASE),
        # name(at)domain.com style
        re.compile(r'\b([A-Za-z0-9._%+-]+)\s*\(at\)\s*([A-Za-z0-9.-]+)\.([A-Za-z]{2,7})\b', re.IGNORECASE),
        # name AT domain DOT com style (all caps or mixed)
        re.compile(r'\b([A-Za-z0-9._%+-]+)\s+AT\s+([A-Za-z0-9.-]+)\s+DOT\s+([A-Za-z]{2,7})\b', re.IGNORECASE),
    ]

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

    # User agent (realistic Chrome on Windows)
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    )

    def __init__(
        self,
        timeout: int = 10,
        max_pages_per_site: int = 6,
        delay_between_requests: float = 0.5,
        respect_robots_txt: bool = True,
        enable_social_fallback: bool = True,
        enable_json_ld: bool = True,
        enable_obfuscation: bool = True,
        enable_hunter_fallback: bool = True,
    ):
        """
        Initialize the extractor.

        Args:
            timeout: Request timeout in seconds
            max_pages_per_site: Maximum pages to crawl per website
            delay_between_requests: Delay between requests (seconds)
            respect_robots_txt: Whether to check robots.txt
            enable_social_fallback: Try Facebook/Instagram if no website
            enable_json_ld: Extract emails from JSON-LD and microdata
            enable_obfuscation: Handle email obfuscation patterns
            enable_hunter_fallback: Try Hunter.io API if website scraping fails
        """
        self.timeout = timeout
        self.max_pages_per_site = max_pages_per_site
        self.delay_between_requests = delay_between_requests
        self.respect_robots_txt = respect_robots_txt
        self.enable_social_fallback = enable_social_fallback
        self.enable_json_ld = enable_json_ld
        self.enable_obfuscation = enable_obfuscation
        self.enable_hunter_fallback = enable_hunter_fallback

        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": self.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-GB,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })

        # Cache for robots.txt parsers
        self._robots_cache: Dict[str, RobotFileParser] = {}

        # Per-domain cache to avoid re-scanning same domain
        self._domain_cache: Dict[str, EmailDiscoveryResult] = {}

        # Domain throttle timestamps
        self._domain_last_request: Dict[str, float] = {}

        # Initialize Hunter.io client (if API key is set)
        self._hunter_client = None
        if self.enable_hunter_fallback:
            try:
                from src.hunter_email_finder import HunterEmailFinder
                self._hunter_client = HunterEmailFinder()
                if not self._hunter_client.is_configured:
                    self._hunter_client = None
            except ImportError:
                pass

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
    # DOMAIN THROTTLING
    # =========================================================================

    def _throttle_domain(self, domain: str):
        """Apply per-domain throttling to avoid rate limits."""
        now = time.time()
        last_request = self._domain_last_request.get(domain, 0)
        elapsed = now - last_request

        if elapsed < self.delay_between_requests:
            time.sleep(self.delay_between_requests - elapsed)

        self._domain_last_request[domain] = time.time()

    def _check_domain_cache(self, domain: str) -> Optional[EmailDiscoveryResult]:
        """Check if we've already scanned this domain."""
        return self._domain_cache.get(domain)

    def _cache_domain_result(self, domain: str, result: EmailDiscoveryResult):
        """Cache the result for a domain."""
        self._domain_cache[domain] = result

    def clear_cache(self):
        """Clear all caches (useful between runs)."""
        self._domain_cache.clear()
        self._domain_last_request.clear()
        self._robots_cache.clear()

    # =========================================================================
    # OBFUSCATION HANDLING
    # =========================================================================

    def _extract_obfuscated_emails(self, text: str) -> List[str]:
        """
        Extract emails from obfuscated patterns.

        Handles:
        - "name [at] domain [dot] com"
        - "name(at)domain.com"
        - "name AT domain DOT com"
        """
        if not self.enable_obfuscation:
            return []

        emails = []
        for pattern in self.OBFUSCATION_PATTERNS:
            for match in pattern.finditer(text):
                try:
                    local, domain, tld = match.groups()
                    email = f"{local}@{domain}.{tld}".lower()
                    if self._is_valid_email_format(email):
                        emails.append(email)
                except Exception:
                    pass

        return emails

    # =========================================================================
    # JSON-LD AND MICRODATA EXTRACTION
    # =========================================================================

    def _extract_emails_from_json_ld(self, soup: BeautifulSoup, website_domain: str) -> List[str]:
        """
        Extract emails from JSON-LD structured data.

        Looks for application/ld+json scripts containing email fields.
        """
        if not self.enable_json_ld:
            return []

        emails = []

        # Find JSON-LD scripts
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                emails.extend(self._extract_emails_from_json_data(data, website_domain))
            except (json.JSONDecodeError, TypeError):
                continue

        return emails

    def _extract_emails_from_json_data(self, data: Any, website_domain: str, depth: int = 0) -> List[str]:
        """Recursively extract email fields from JSON data."""
        if depth > 5:  # Prevent infinite recursion
            return []

        emails = []

        if isinstance(data, dict):
            for key, value in data.items():
                # Direct email fields
                if key.lower() in ("email", "contactemail", "workemail", "mail"):
                    if isinstance(value, str) and self._is_valid_business_email(value, website_domain):
                        emails.append(value.lower())
                # Recurse into nested objects
                elif isinstance(value, (dict, list)):
                    emails.extend(self._extract_emails_from_json_data(value, website_domain, depth + 1))

        elif isinstance(data, list):
            for item in data:
                emails.extend(self._extract_emails_from_json_data(item, website_domain, depth + 1))

        return emails

    def _extract_emails_from_microdata(self, soup: BeautifulSoup, website_domain: str) -> List[str]:
        """
        Extract emails from HTML microdata (itemprop=email).
        """
        if not self.enable_json_ld:
            return []

        emails = []

        # Find elements with itemprop="email"
        for elem in soup.find_all(attrs={"itemprop": "email"}):
            # Check content attribute
            email = elem.get("content") or elem.get("href", "").replace("mailto:", "") or elem.get_text()
            email = email.strip().lower()
            if self._is_valid_business_email(email, website_domain):
                emails.append(email)

        return emails

    # =========================================================================
    # INTERNAL LINK DISCOVERY
    # =========================================================================

    def _discover_contact_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """
        Discover internal links that might contain contact information.

        Looks for links with anchor text matching contact-related patterns.
        """
        contact_links = []
        seen_paths = set()

        for link in soup.find_all("a", href=True):
            href = link["href"]
            anchor_text = link.get_text().lower().strip()

            # Check if anchor text matches contact patterns
            if any(re.search(pattern, anchor_text) for pattern in self.CONTACT_ANCHOR_PATTERNS):
                full_url = urljoin(base_url, href)
                parsed = urlparse(full_url)

                # Only internal links
                base_domain = urlparse(base_url).netloc
                if parsed.netloc == base_domain or parsed.netloc == "":
                    path = parsed.path.lower()
                    if path not in seen_paths and not self._is_non_html_url(full_url):
                        seen_paths.add(path)
                        contact_links.append(full_url)

        return contact_links[:5]  # Limit to 5 discovered links

    # =========================================================================
    # SOCIAL MEDIA FALLBACK
    # =========================================================================

    def _extract_email_from_social(self, url: str) -> EmailDiscoveryResult:
        """
        Attempt to extract email from Facebook/Instagram page.

        Args:
            url: Social media URL

        Returns:
            EmailDiscoveryResult with email if found, or blocked_reason if blocked
        """
        result = EmailDiscoveryResult()

        if not self.enable_social_fallback:
            return result

        # Determine platform
        parsed = urlparse(url)
        platform = None
        if "facebook.com" in parsed.netloc:
            platform = "facebook"
        elif "instagram.com" in parsed.netloc:
            platform = "instagram"

        if not platform:
            return result

        try:
            # Throttle requests
            self._throttle_domain(parsed.netloc)

            # Fetch page with social-specific headers
            headers = {
                "User-Agent": self.USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-GB,en;q=0.9",
            }

            response = self.session.get(url, timeout=self.timeout, headers=headers)

            if response.status_code == 200:
                # Extract emails from page
                soup = BeautifulSoup(response.text, "html.parser")
                text = soup.get_text(separator=" ")

                # Look for emails in text
                emails_found = []
                for match in self.EMAIL_PATTERN.findall(text):
                    email = match.lower().strip()
                    # For social pages, don't require domain match
                    if self._is_valid_email_format(email) and not self._is_invalid_email(email):
                        emails_found.append(email)

                # Also check obfuscated patterns
                emails_found.extend(self._extract_obfuscated_emails(text))

                if emails_found:
                    # Prioritize and take first
                    prioritized = self._prioritize_emails(emails_found)
                    result.discovered_email = prioritized[0]
                    result.email_source = platform
                    result.discovery_url = url
                    result.all_emails_found = emails_found

            elif response.status_code in (403, 429):
                result.blocked_reason = f"HTTP {response.status_code} - access blocked"
            else:
                result.error = f"HTTP {response.status_code}"

        except requests.exceptions.Timeout:
            result.blocked_reason = "Timeout"
        except requests.exceptions.ConnectionError:
            result.blocked_reason = "Connection error"
        except Exception as e:
            result.error = str(e)

        return result

    def _is_invalid_email(self, email: str) -> bool:
        """Check if email matches invalid patterns."""
        email_lower = email.lower()
        return any(email_lower.startswith(pattern) for pattern in self.INVALID_PATTERNS)

    # =========================================================================
    # HUNTER.IO FALLBACK
    # =========================================================================

    def _try_hunter_fallback(self, domain: str) -> Optional[str]:
        """
        Try to find email using Hunter.io API as a fallback.

        Args:
            domain: Business domain to search

        Returns:
            Email address if found, None otherwise
        """
        if not self._hunter_client:
            return None

        try:
            result = self._hunter_client.find_email_for_domain(domain)
            if result.email and not result.error:
                return result.email
        except Exception:
            pass

        return None

    # =========================================================================
    # EMAIL EXTRACTION
    # =========================================================================

    def _extract_emails_from_html(self, html: str, website_domain: str) -> List[str]:
        """
        Extract valid emails from HTML content using multiple methods.

        Methods:
        1. mailto: links
        2. Regex in visible text
        3. Regex in href attributes
        4. JSON-LD structured data
        5. Microdata (itemprop=email)
        6. Obfuscation patterns

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

            # Method 4: JSON-LD structured data
            for email in self._extract_emails_from_json_ld(soup, website_domain):
                if self._is_valid_business_email(email, website_domain):
                    emails_found.add(email.lower())

            # Method 5: Microdata (itemprop=email)
            for email in self._extract_emails_from_microdata(soup, website_domain):
                if self._is_valid_business_email(email, website_domain):
                    emails_found.add(email.lower())

            # Method 6: Obfuscation patterns
            for email in self._extract_obfuscated_emails(text):
                if self._is_valid_business_email(email, website_domain):
                    emails_found.add(email.lower())

        except Exception:
            pass

        return list(emails_found)

    # =========================================================================
    # MAIN DISCOVERY
    # =========================================================================

    def discover_email(
        self,
        website_url: str,
        source_url: Optional[str] = None,
        enable_social: bool = True
    ) -> EmailDiscoveryResult:
        """
        Discover email from a business website.

        Crawls homepage and contact pages to find a valid email.
        Falls back to social media if website is missing.

        Args:
            website_url: Business website URL (can be None)
            source_url: Original source URL (for social fallback)
            enable_social: Whether to try social media fallback

        Returns:
            EmailDiscoveryResult with findings
        """
        result = EmailDiscoveryResult()
        result.domains_scanned = 0

        # If no website, try social fallback
        if not website_url:
            if enable_social and source_url and self.enable_social_fallback:
                # Check if source is social media
                if "facebook.com" in source_url or "instagram.com" in source_url:
                    return self._extract_email_from_social(source_url)
            result.error = "No website URL"
            return result

        # Normalize URL
        base_url = self._normalize_url(website_url)
        website_domain = self._get_domain(base_url)

        if not website_domain:
            result.error = "Invalid URL"
            return result

        # Check domain cache
        cached = self._check_domain_cache(website_domain)
        if cached:
            return cached

        # Apply domain throttling
        self._throttle_domain(website_domain)

        all_emails: List[str] = []
        pages_crawled = 0
        discovered_links: List[str] = []

        # Build list of URLs to try
        urls_to_try = [base_url]
        for path in self.CONTACT_PATHS:
            urls_to_try.append(urljoin(base_url, path))

        # Remove duplicates while preserving order
        seen_urls = set()
        unique_urls = []
        for url in urls_to_try:
            normalized = url.lower().rstrip("/")
            if normalized not in seen_urls:
                seen_urls.add(normalized)
                unique_urls.append(url)
        urls_to_try = unique_urls

        # Crawl pages
        for url in urls_to_try:
            if pages_crawled >= self.max_pages_per_site:
                break

            html, error = self._fetch_page(url)
            if html:
                pages_crawled += 1
                soup = BeautifulSoup(html, "html.parser")

                # Extract emails from this page
                emails = self._extract_emails_from_html(html, website_domain)

                for email in emails:
                    if email not in all_emails:
                        all_emails.append(email)

                # If we found emails on this page, record the URL
                if emails and not result.discovery_url:
                    result.discovery_url = url

                # On first page, discover internal contact links
                if pages_crawled == 1:
                    discovered_links = self._discover_contact_links(soup, base_url)

            # Apply throttling between requests
            self._throttle_domain(website_domain)

        # Try discovered internal links if we have pages remaining
        for url in discovered_links:
            if pages_crawled >= self.max_pages_per_site:
                break

            # Skip if already tried
            if url.lower().rstrip("/") in seen_urls:
                continue

            html, error = self._fetch_page(url)
            if html:
                pages_crawled += 1
                emails = self._extract_emails_from_html(html, website_domain)

                for email in emails:
                    if email not in all_emails:
                        all_emails.append(email)

                if emails and not result.discovery_url:
                    result.discovery_url = url

            self._throttle_domain(website_domain)

        result.pages_crawled = pages_crawled
        result.domains_scanned = 1
        result.all_emails_found = all_emails

        # Prioritize and select best email
        if all_emails:
            prioritized = self._prioritize_emails(all_emails)
            result.discovered_email = prioritized[0]
            result.email_source = "website"

        # Fallback to Hunter.io if no email found and API is configured
        if not result.discovered_email and self.enable_hunter_fallback:
            hunter_result = self._try_hunter_fallback(website_domain)
            if hunter_result:
                result.discovered_email = hunter_result
                result.email_source = "hunter"
                result.all_emails_found.append(hunter_result)

        # Cache result for this domain
        self._cache_domain_result(website_domain, result)

        return result

    def discover_emails_batch(
        self,
        leads: List[Any],
        website_field: str = "website",
        email_field: str = "email",
        source_url_field: str = "source_url",
        progress_callback: callable = None
    ) -> Tuple[List[Any], BatchDiscoveryStats]:
        """
        Discover emails for a batch of leads.

        Args:
            leads: List of lead objects/dicts
            website_field: Field name for website URL
            email_field: Field name for existing email
            source_url_field: Field name for source URL (for social fallback)
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
                source_url = getattr(lead, source_url_field, None) if hasattr(lead, source_url_field) else None
            else:
                website = lead.get(website_field)
                existing_email = lead.get(email_field)
                source_url = lead.get(source_url_field)

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

            # Try to discover email from website (with social fallback)
            result = self.discover_email(
                website_url=website,
                source_url=source_url,
                enable_social=self.enable_social_fallback
            )

            stats.total_pages_crawled += result.pages_crawled
            stats.total_domains_scanned += result.domains_scanned

            if result.error:
                stats.total_errors += 1

            if result.blocked_reason:
                stats.blocked_social_fetches += 1

            if result.discovered_email:
                # Track by source
                if result.email_source == "website":
                    stats.leads_with_website_email += 1
                elif result.email_source == "facebook":
                    stats.leads_with_facebook_email += 1
                elif result.email_source == "instagram":
                    stats.leads_with_instagram_email += 1
                elif result.email_source == "hunter":
                    stats.leads_with_hunter_email += 1

                # Update lead with discovered email
                if hasattr(lead, email_field):
                    setattr(lead, email_field, result.discovered_email)
                    if hasattr(lead, "discovered_email"):
                        lead.discovered_email = result.discovered_email
                    if hasattr(lead, "email_source"):
                        lead.email_source = result.email_source
                    if hasattr(lead, "discovery_url"):
                        lead.discovery_url = result.discovery_url
                elif isinstance(lead, dict):
                    lead[email_field] = result.discovered_email
                    lead["discovered_email"] = result.discovered_email
                    lead["email_source"] = result.email_source
                    lead["discovery_url"] = result.discovery_url
            else:
                stats.leads_with_no_email += 1

                # Set email_source to "none"
                if hasattr(lead, "email_source"):
                    lead.email_source = "none"
                elif isinstance(lead, dict):
                    lead["email_source"] = "none"

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
