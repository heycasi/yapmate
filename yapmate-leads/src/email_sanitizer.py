"""
Email Sanitization Module for YapMate Leads.

Provides strict email validation and sanitization before sending.
Prevents malformed, dangerous, or spam-like emails from being processed.
"""

import re
from typing import Optional, Tuple, List
from dataclasses import dataclass


# Strict email regex pattern
# - Allows: letters, numbers, dots, hyphens, underscores, plus signs
# - Requires: @ symbol followed by domain with at least one dot
# - TLD must be 2-10 characters
EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$'
)

# Common invalid/test email patterns to reject
INVALID_PATTERNS = [
    r'test@',
    r'example@',
    r'sample@',
    r'demo@',
    r'fake@',
    r'noreply@',
    r'no-reply@',
    r'donotreply@',
    r'@example\.com$',
    r'@test\.com$',
    r'@localhost',
    r'@127\.0\.0\.1',
    r'\.\.+',  # Multiple consecutive dots
]

# Common spam trap domains
SPAM_TRAP_DOMAINS = {
    'mailinator.com',
    'guerrillamail.com',
    'tempmail.com',
    'throwaway.email',
    '10minutemail.com',
    'trashmail.com',
    'fakeinbox.com',
    'sharklasers.com',
}


@dataclass
class SanitizationResult:
    """Result of email sanitization."""
    original: str
    sanitized: Optional[str]
    valid: bool
    reason: Optional[str] = None


def sanitize_email(email: str) -> SanitizationResult:
    """
    Sanitize and validate an email address.

    Steps:
    1. Strip whitespace
    2. Convert to lowercase
    3. Remove target= and other junk prefixes
    4. Remove mailto: prefix
    5. Validate against strict regex
    6. Check against invalid patterns
    7. Check against spam trap domains

    Args:
        email: Raw email string to sanitize

    Returns:
        SanitizationResult with sanitized email and validation status
    """
    if not email:
        return SanitizationResult(
            original=email or "",
            sanitized=None,
            valid=False,
            reason="Empty email"
        )

    original = email
    cleaned = email

    # Step 1: Strip whitespace
    cleaned = cleaned.strip()

    # Step 2: Convert to lowercase
    cleaned = cleaned.lower()

    # Step 3: Remove common junk prefixes
    junk_prefixes = [
        'target=',
        'mailto:',
        'email:',
        'e-mail:',
        'to:',
    ]
    for prefix in junk_prefixes:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]

    # Step 4: Remove any remaining whitespace after prefix removal
    cleaned = cleaned.strip()

    # Step 5: Remove any trailing junk (query strings, anchors)
    if '?' in cleaned:
        cleaned = cleaned.split('?')[0]
    if '#' in cleaned:
        cleaned = cleaned.split('#')[0]

    # Step 6: Remove any HTML entities
    cleaned = cleaned.replace('&amp;', '&')
    cleaned = cleaned.replace('&#64;', '@')
    cleaned = cleaned.replace('%40', '@')

    # Step 7: Validate against strict regex
    if not EMAIL_REGEX.match(cleaned):
        return SanitizationResult(
            original=original,
            sanitized=None,
            valid=False,
            reason=f"Failed regex validation: {cleaned}"
        )

    # Step 8: Check against invalid patterns
    for pattern in INVALID_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return SanitizationResult(
                original=original,
                sanitized=None,
                valid=False,
                reason=f"Matches invalid pattern: {pattern}"
            )

    # Step 9: Check against spam trap domains
    domain = cleaned.split('@')[1]
    if domain in SPAM_TRAP_DOMAINS:
        return SanitizationResult(
            original=original,
            sanitized=None,
            valid=False,
            reason=f"Spam trap domain: {domain}"
        )

    # Step 10: Additional domain checks
    if domain.count('.') < 1:
        return SanitizationResult(
            original=original,
            sanitized=None,
            valid=False,
            reason=f"Invalid domain (no TLD): {domain}"
        )

    # Success
    return SanitizationResult(
        original=original,
        sanitized=cleaned,
        valid=True,
        reason=None
    )


def sanitize_emails(emails: List[str]) -> Tuple[List[str], List[SanitizationResult]]:
    """
    Sanitize a list of emails, returning valid ones and all results.

    Args:
        emails: List of raw email strings

    Returns:
        Tuple of (valid_emails, all_results)
    """
    results = [sanitize_email(email) for email in emails]
    valid_emails = [r.sanitized for r in results if r.valid and r.sanitized]
    return valid_emails, results


def is_valid_email(email: str) -> bool:
    """Quick check if an email is valid."""
    return sanitize_email(email).valid


def log_sanitization_summary(results: List[SanitizationResult]) -> None:
    """Log a summary of sanitization results."""
    total = len(results)
    valid = sum(1 for r in results if r.valid)
    invalid = total - valid

    print(f"[EMAIL SANITIZATION] Total: {total}, Valid: {valid}, Invalid: {invalid}")

    if invalid > 0:
        print("[EMAIL SANITIZATION] Invalid emails:")
        for r in results:
            if not r.valid:
                print(f"  - {r.original[:50]}... -> {r.reason}")
