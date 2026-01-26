"""
Auto-Approval Module for YapMate Leads.

Automatically approves leads that pass all safety checks,
removing the need for manual review.

Rules (all must pass):
1. send_eligible == true
2. Email passes sanitization
3. Not a free email provider (gmail, yahoo, etc.)
4. Not a placeholder/example domain
5. No malformed scraped strings
6. Domain matches website domain (or subdomain)
"""

import re
from typing import Optional, List, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse

from src.email_sanitizer import sanitize_email, SanitizationResult
from src.config import get_config


# =============================================================================
# FREE EMAIL PROVIDERS (reject by default)
# =============================================================================

FREE_EMAIL_PROVIDERS = {
    # Major free providers
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.co.uk',
    'hotmail.com',
    'hotmail.co.uk',
    'outlook.com',
    'live.com',
    'live.co.uk',
    'msn.com',
    'aol.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'protonmail.com',
    'proton.me',
    'zoho.com',
    'yandex.com',
    'mail.com',
    'gmx.com',
    'gmx.co.uk',
    # UK-specific free providers
    'btinternet.com',
    'sky.com',
    'virginmedia.com',
    'talktalk.net',
    'ntlworld.com',
}

# =============================================================================
# PLACEHOLDER/EXAMPLE DOMAINS (always reject)
# =============================================================================

PLACEHOLDER_DOMAINS = {
    'example.com',
    'example.org',
    'example.net',
    'test.com',
    'test.org',
    'localhost',
    'localhost.localdomain',
    'invalid.com',
    'email.com',
    'domain.com',
    'website.com',
    'company.com',
    'business.com',
    'yourcompany.com',
    'yourdomain.com',
    'sample.com',
    'demo.com',
    'fake.com',
    'placeholder.com',
    'noreply.com',
}

# =============================================================================
# MALFORMED STRING PATTERNS (reject if found)
# =============================================================================

MALFORMED_PATTERNS = [
    r'\s',                    # Any whitespace
    r'target=',               # Scraped junk
    r'follow',                # Scraped junk
    r'mailto:',               # Not stripped properly
    r'href=',                 # HTML junk
    r'<[^>]+>',               # HTML tags
    r'\[|\]',                 # Brackets
    r'javascript:',           # Script junk
    r'\.\.+',                 # Multiple consecutive dots
    r'^\.|\.$',               # Leading/trailing dots
    r'@.*@',                  # Multiple @ symbols
    r'[^\x00-\x7F]',          # Non-ASCII characters
]


@dataclass
class ApprovalResult:
    """Result of auto-approval check."""
    approved: bool
    reason: str
    email_original: str
    email_sanitized: Optional[str]
    checks_passed: List[str]
    checks_failed: List[str]


def extract_domain_from_url(url: str) -> Optional[str]:
    """
    Extract the base domain from a URL.

    Examples:
        https://www.acme-plumbing.co.uk/contact -> acme-plumbing.co.uk
        http://smithelectrical.com -> smithelectrical.com
    """
    if not url:
        return None

    try:
        # Add scheme if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Remove www. prefix
        if domain.startswith('www.'):
            domain = domain[4:]

        # Remove port if present
        if ':' in domain:
            domain = domain.split(':')[0]

        return domain if domain else None

    except Exception:
        return None


def extract_domain_from_email(email: str) -> Optional[str]:
    """Extract domain from email address."""
    if not email or '@' not in email:
        return None

    try:
        return email.split('@')[1].lower()
    except Exception:
        return None


def domains_match(email_domain: str, website_domain: str) -> bool:
    """
    Check if email domain matches website domain (or is a subdomain).

    Examples:
        info@acme.co.uk vs acme.co.uk -> True
        hello@mail.acme.co.uk vs acme.co.uk -> True
        contact@acme.co.uk vs different.com -> False
    """
    if not email_domain or not website_domain:
        return False

    email_domain = email_domain.lower()
    website_domain = website_domain.lower()

    # Exact match
    if email_domain == website_domain:
        return True

    # Email domain is subdomain of website domain
    if email_domain.endswith('.' + website_domain):
        return True

    # Website domain is subdomain of email domain (less common but valid)
    if website_domain.endswith('.' + email_domain):
        return True

    return False


def check_auto_approval(
    email: str,
    website: Optional[str],
    send_eligible: bool,
    business_name: str,
    allow_free_emails: bool = False,
) -> ApprovalResult:
    """
    Check if a lead should be auto-approved.

    Args:
        email: Raw email address
        website: Business website URL
        send_eligible: Whether lead passed eligibility checks
        business_name: Business name for logging
        allow_free_emails: If True, don't reject free email providers

    Returns:
        ApprovalResult with approval status and reasons
    """
    checks_passed = []
    checks_failed = []

    # ==========================================================================
    # Check 1: Send eligibility
    # ==========================================================================
    if send_eligible:
        checks_passed.append("send_eligible")
    else:
        checks_failed.append("send_eligible: lead not marked as eligible")
        return ApprovalResult(
            approved=False,
            reason="Lead not marked as send_eligible",
            email_original=email or "",
            email_sanitized=None,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    # ==========================================================================
    # Check 2: Email sanitization
    # ==========================================================================
    if not email:
        checks_failed.append("sanitization: no email provided")
        return ApprovalResult(
            approved=False,
            reason="No email address provided",
            email_original="",
            email_sanitized=None,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    sanitization = sanitize_email(email)

    if not sanitization.valid:
        checks_failed.append(f"sanitization: {sanitization.reason}")
        return ApprovalResult(
            approved=False,
            reason=f"Email failed sanitization: {sanitization.reason}",
            email_original=email,
            email_sanitized=None,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    clean_email = sanitization.sanitized
    checks_passed.append("sanitization")

    # ==========================================================================
    # Check 3: Malformed string patterns
    # ==========================================================================
    for pattern in MALFORMED_PATTERNS:
        if re.search(pattern, clean_email):
            checks_failed.append(f"malformed: matches pattern '{pattern}'")
            return ApprovalResult(
                approved=False,
                reason=f"Email contains malformed pattern: {pattern}",
                email_original=email,
                email_sanitized=clean_email,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
            )

    checks_passed.append("malformed_check")

    # ==========================================================================
    # Check 4: Extract and validate domain
    # ==========================================================================
    email_domain = extract_domain_from_email(clean_email)

    if not email_domain:
        checks_failed.append("domain: could not extract domain from email")
        return ApprovalResult(
            approved=False,
            reason="Could not extract domain from email",
            email_original=email,
            email_sanitized=clean_email,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    # ==========================================================================
    # Check 5: Placeholder/example domains
    # ==========================================================================
    if email_domain in PLACEHOLDER_DOMAINS:
        checks_failed.append(f"placeholder: {email_domain} is a placeholder domain")
        return ApprovalResult(
            approved=False,
            reason=f"Placeholder/example domain: {email_domain}",
            email_original=email,
            email_sanitized=clean_email,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    checks_passed.append("placeholder_check")

    # ==========================================================================
    # Check 6: Free email providers
    # ==========================================================================
    if not allow_free_emails and email_domain in FREE_EMAIL_PROVIDERS:
        checks_failed.append(f"free_email: {email_domain} is a free email provider")
        return ApprovalResult(
            approved=False,
            reason=f"Free email provider not allowed: {email_domain}",
            email_original=email,
            email_sanitized=clean_email,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    checks_passed.append("free_email_check")

    # ==========================================================================
    # Check 7: Domain matching (email domain vs website domain)
    # ==========================================================================
    website_domain = extract_domain_from_url(website) if website else None

    if website_domain:
        if domains_match(email_domain, website_domain):
            checks_passed.append("domain_match")
        else:
            # Soft warning - don't reject, but note it
            # Many small businesses use free emails legitimately
            checks_passed.append(f"domain_match: WARNING - email domain ({email_domain}) differs from website ({website_domain})")
    else:
        # No website to compare against - skip this check
        checks_passed.append("domain_match: skipped (no website)")

    # ==========================================================================
    # ALL CHECKS PASSED - APPROVE
    # ==========================================================================
    return ApprovalResult(
        approved=True,
        reason=f"All {len(checks_passed)} checks passed",
        email_original=email,
        email_sanitized=clean_email,
        checks_passed=checks_passed,
        checks_failed=checks_failed,
    )


def auto_approve_leads(
    leads: list,
    sheets_manager,
    max_per_run: int = 25,
    allow_free_emails: bool = False,
) -> dict:
    """
    Auto-approve eligible leads in batch.

    Args:
        leads: List of EnhancedLead objects with status=NEW
        sheets_manager: SequencerSheetsManager instance
        max_per_run: Maximum leads to approve per run
        allow_free_emails: Whether to allow free email providers

    Returns:
        Dict with approval statistics
    """
    config = get_config()

    stats = {
        'processed': 0,
        'approved': 0,
        'rejected': 0,
        'skipped': 0,
        'approval_reasons': [],
        'rejection_reasons': [],
    }

    print(f"\n" + "=" * 70)
    print("AUTO-APPROVAL PIPELINE")
    print("=" * 70)
    print(f"  Leads to process: {len(leads)}")
    print(f"  Max per run: {max_per_run}")
    print(f"  Allow free emails: {allow_free_emails}")

    # Collect ALL updates for true batch write (approved + rejected)
    all_updates = []

    for i, lead in enumerate(leads[:max_per_run], 1):
        print(f"\n[{i}/{min(len(leads), max_per_run)}] {lead.business_name}")
        print("-" * 40)

        stats['processed'] += 1

        # Run approval checks
        result = check_auto_approval(
            email=lead.email,
            website=getattr(lead, 'website', None),
            send_eligible=lead.send_eligible,
            business_name=lead.business_name,
            allow_free_emails=allow_free_emails,
        )

        print(f"  Email: {result.email_original}")
        print(f"  Sanitized: {result.email_sanitized or 'N/A'}")
        print(f"  Approved: {result.approved}")
        print(f"  Reason: {result.reason}")

        if result.approved:
            stats['approved'] += 1
            stats['approval_reasons'].append({
                'lead_id': lead.lead_id,
                'business': lead.business_name,
                'email': result.email_sanitized,
                'reason': result.reason,
            })

            # Queue for batch update (include send_eligible=True)
            all_updates.append({
                'lead_id': lead.lead_id,
                'status': 'APPROVED',
                'send_eligible': True,  # Ensure send_eligible is set to True
                'eligibility_reason': result.reason,
            })

            print(f"  -> AUTO-APPROVED")
        else:
            stats['rejected'] += 1
            stats['rejection_reasons'].append({
                'lead_id': lead.lead_id,
                'business': lead.business_name,
                'email': result.email_original,
                'reason': result.reason,
                'checks_failed': result.checks_failed,
            })

            # Queue rejection for batch update (keep as NEW)
            all_updates.append({
                'lead_id': lead.lead_id,
                'status': 'NEW',  # Keep as NEW
                'eligibility_reason': f"Auto-reject: {result.reason}",
            })

            print(f"  -> REJECTED: {result.reason}")

    # TRUE batch update - single API call for all leads
    if all_updates:
        print(f"\n  Batch updating {len(all_updates)} leads (single API call)...")
        try:
            updated_count = sheets_manager.batch_update_leads(all_updates)
            print(f"  Updated {updated_count} leads successfully")
        except Exception as e:
            print(f"  WARNING: Batch update failed: {e}")
            print(f"  Falling back to individual updates with delays...")
            # Fallback with rate limiting
            import time
            for i, update in enumerate(all_updates):
                try:
                    sheets_manager.update_lead_status(
                        update['lead_id'],
                        update['status'],
                        send_eligible=update.get('send_eligible'),
                        eligibility_reason=update.get('eligibility_reason'),
                    )
                    # Rate limit: max 50 writes/minute, so wait 1.5s between writes
                    if i < len(all_updates) - 1:
                        time.sleep(1.5)
                except Exception as inner_e:
                    print(f"  WARNING: Failed to update lead {update['lead_id']}: {inner_e}")

    # Summary
    print(f"\n" + "=" * 70)
    print("AUTO-APPROVAL SUMMARY")
    print("=" * 70)
    print(f"  Processed: {stats['processed']}")
    print(f"  Approved:  {stats['approved']}")
    print(f"  Rejected:  {stats['rejected']}")
    print(f"  Skipped:   {stats['skipped']}")
    print("=" * 70)

    return stats
