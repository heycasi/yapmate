"""Email extraction from business websites."""

import re
import requests
from bs4 import BeautifulSoup
from typing import Optional
from urllib.parse import urljoin, urlparse


class EmailFinder:
    """Extract email addresses from business websites"""

    # Common contact page paths to try
    CONTACT_PATHS = [
        "/contact",
        "/contact-us",
        "/contactus",
        "/get-in-touch",
        "/about",
        "/about-us"
    ]

    # Email regex pattern (matches common formats)
    EMAIL_PATTERN = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    )

    # User agent to avoid being blocked
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    def __init__(self, timeout: int = 10):
        """
        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

    def find_email_on_website(self, url: str) -> Optional[str]:
        """
        Find email address on a business website

        Args:
            url: Website URL to scrape

        Returns:
            First valid email found, or None
        """
        # Ensure URL has scheme
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Try homepage first
        email = self._extract_email_from_page(url)
        if email:
            return email

        # Try common contact pages
        for path in self.CONTACT_PATHS:
            contact_url = urljoin(url, path)
            email = self._extract_email_from_page(contact_url)
            if email:
                return email

        return None

    def _extract_email_from_page(self, url: str) -> Optional[str]:
        """
        Extract email from a single page

        Args:
            url: Page URL

        Returns:
            First email found, or None
        """
        try:
            response = self.session.get(url, timeout=self.timeout, allow_redirects=True)

            # Only process successful responses
            if response.status_code != 200:
                return None

            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')

            # Method 1: Look for mailto: links
            mailto_links = soup.find_all('a', href=re.compile(r'^mailto:'))
            if mailto_links:
                email = mailto_links[0]['href'].replace('mailto:', '').split('?')[0]
                if self._is_valid_email(email):
                    return email.lower()

            # Method 2: Search page text with regex
            page_text = soup.get_text()
            emails = self.EMAIL_PATTERN.findall(page_text)

            # Filter out common false positives
            for email in emails:
                email = email.lower()
                if self._is_valid_business_email(email):
                    return email

            return None

        except requests.exceptions.RequestException:
            # Timeout, connection error, etc - silently fail
            return None
        except Exception:
            # Any other error - silently fail
            return None

    def _is_valid_email(self, email: str) -> bool:
        """Check if string is a valid email format"""
        return bool(self.EMAIL_PATTERN.match(email))

    def _is_valid_business_email(self, email: str) -> bool:
        """
        Check if email is likely a real business email
        (filter out common false positives)
        """
        # Must be valid format
        if not self._is_valid_email(email):
            return False

        # Filter out image/asset file extensions that might match pattern
        if any(email.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js']):
            return False

        # Filter out example/placeholder emails
        if any(domain in email for domain in ['example.com', 'domain.com', 'test.com', 'yoursite.com']):
            return False

        # Filter out privacy/no-reply emails (these won't respond)
        if any(prefix in email for prefix in ['noreply@', 'no-reply@', 'donotreply@']):
            return False

        return True


# Convenience function for single-use
def find_email_on_website(url: str, timeout: int = 10) -> Optional[str]:
    """
    Find email on website (convenience function)

    Args:
        url: Website URL
        timeout: Request timeout in seconds

    Returns:
        Email address or None
    """
    finder = EmailFinder(timeout=timeout)
    return finder.find_email_on_website(url)
