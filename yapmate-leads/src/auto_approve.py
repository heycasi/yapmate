"""
Auto-Approval Module for YapMate Leads.

Automatically approves leads that pass all safety checks,
removing the need for manual review.

Rules (all must pass):
1. send_eligible == true
2. Email passes sanitization
3. Not a free email provider (gmail, yahoo, etc.) - UNLESS sole_trader_mode
4. Not a placeholder/example domain
5. No malformed scraped strings
6. Domain matches website domain (or subdomain)

Sole Trader Mode:
When enabled, allows personal email domains (gmail, btinternet, etc.) with
extra validation to filter out larger businesses:
- Reject if business name contains: ltd, limited, group, holdings, plc
- For free email domains, require at least one sole trader signal:
  - Mobile phone (07xxx)
  - Low review count (≤25)
  - Personal name pattern in business name
"""

import re
from typing import Optional, List, Tuple, Dict, Any
from dataclasses import dataclass
from urllib.parse import urlparse

from src.email_sanitizer import sanitize_email, SanitizationResult
from src.config import get_config


# =============================================================================
# SOLE TRADER DETECTION
# =============================================================================

# Corporate name patterns that indicate a larger business (NOT a sole trader)
CORPORATE_NAME_PATTERNS = [
    r'\bltd\b',
    r'\blimited\b',
    r'\bgroup\b',
    r'\bholdings\b',
    r'\bplc\b',
    r'\binc\b',
    r'\bcorp\b',
    r'\bcorporation\b',
    r'\b& sons\b',
    r'\b& co\b',
]

# Common UK first names for detecting personal business names
UK_FIRST_NAMES = {
    'dave', 'david', 'john', 'mike', 'michael', 'steve', 'steven', 'paul',
    'mark', 'gary', 'chris', 'christopher', 'andy', 'andrew', 'rob', 'robert',
    'james', 'jim', 'tony', 'anthony', 'pete', 'peter', 'nick', 'nicholas',
    'tom', 'thomas', 'dan', 'daniel', 'matt', 'matthew', 'rich', 'richard',
    'brian', 'barry', 'keith', 'kevin', 'lee', 'martin', 'simon', 'wayne',
    'alan', 'adam', 'ben', 'benjamin', 'carl', 'colin', 'craig', 'darren',
    'dean', 'derek', 'doug', 'douglas', 'frank', 'fred', 'geoff', 'george',
    'graham', 'greg', 'ian', 'jack', 'jason', 'jeff', 'joe', 'jon', 'karl',
    'ken', 'larry', 'len', 'les', 'neil', 'nigel', 'pat', 'patrick', 'phil',
    'ray', 'roger', 'ron', 'roy', 'russell', 'sam', 'scott', 'sean', 'shaun',
    'stan', 'stuart', 'terry', 'tim', 'trevor', 'vic', 'will', 'william',
}


def is_corporate_name(business_name: str) -> bool:
    """Check if business name contains corporate indicators."""
    if not business_name:
        return False
    name_lower = business_name.lower()
    for pattern in CORPORATE_NAME_PATTERNS:
        if re.search(pattern, name_lower):
            return True
    return False


def has_personal_name_pattern(business_name: str) -> bool:
    """
    Check if business name looks like a personal/sole trader name.

    Examples that match:
    - "Dave's Plumbing"
    - "John Smith Electrical"
    - "Mike the Plumber"
    - "A. Jones Roofing"
    """
    if not business_name:
        return False

    name_lower = business_name.lower()

    # Check for possessive pattern (Dave's, Mike's)
    if "'" in business_name or "'" in business_name:
        return True

    # Check for first name at start
    first_word = name_lower.split()[0] if name_lower.split() else ""
    if first_word in UK_FIRST_NAMES:
        return True

    # Check for initial pattern (A. Smith, J. Brown)
    if re.match(r'^[a-z]\.\s*[a-z]', name_lower):
        return True

    return False


def calculate_sole_trader_score(
    business_name: str,
    email: Optional[str],
    phone: Optional[str],
    website: Optional[str],
    review_count: Optional[int] = None,
) -> int:
    """
    Calculate a 0-100 score indicating likelihood of being a sole trader.

    Higher score = more likely to be a sole trader / owner-operator.

    Scoring:
    - No Ltd/Limited/Group/Holdings/Plc in name: +20
    - Review count 0-10: +20, 11-25: +10
    - Mobile phone (07xxx): +15
    - Personal email domain: +15
    - No website: +10
    - Personal name pattern in business name: +10
    - Has possessive in name (Dave's, Mike's): +10 (included in personal name)

    Returns:
        Score from 0-100
    """
    score = 0

    # Check business name for corporate patterns
    if not is_corporate_name(business_name):
        score += 20

    # Check for personal name pattern
    if has_personal_name_pattern(business_name):
        score += 10

    # Review count (lower = more likely sole trader)
    if review_count is not None:
        if review_count <= 10:
            score += 20
        elif review_count <= 25:
            score += 10

    # Mobile phone (07xxx = personal mobile)
    if phone:
        phone_clean = re.sub(r'[^\d]', '', phone)
        if phone_clean.startswith('07') or phone_clean.startswith('447'):
            score += 15

    # Personal email domain
    if email and '@' in email:
        email_domain = email.split('@')[1].lower()
        if email_domain in FREE_EMAIL_PROVIDERS:
            score += 15

    # No website (sole traders often don't have websites)
    if not website or not website.strip():
        score += 10

    return min(score, 100)


def estimate_business_size(
    business_name: str,
    review_count: Optional[int],
    website: Optional[str],
    phone: Optional[str],
) -> str:
    """
    Estimate business size from available signals.

    Returns:
        'sole_trader': 1 person (owner-operator)
        'small': 2-10 employees
        'medium': 10+ employees (not our target market)
    """
    score = 0

    # Review count is strongest signal
    if review_count is None or review_count <= 10:
        score += 3  # Likely sole trader
    elif review_count <= 25:
        score += 2  # Likely small
    elif review_count <= 50:
        score += 1  # Possibly small
    else:
        score -= 2  # Likely medium/large

    # Corporate name = definitely not sole trader
    if is_corporate_name(business_name):
        score -= 3
    elif has_personal_name_pattern(business_name):
        score += 2  # Likely sole trader

    # No website = smaller operation
    if not website or not website.strip():
        score += 1

    # Mobile = owner's personal phone
    if phone:
        phone_clean = re.sub(r'[^\d]', '', phone)
        if phone_clean.startswith('07') or phone_clean.startswith('447'):
            score += 1

    if score >= 4:
        return 'sole_trader'
    elif score >= 1:
        return 'small'
    else:
        return 'medium'


def passes_sole_trader_validation(
    business_name: str,
    email: Optional[str],
    phone: Optional[str],
    website: Optional[str] = None,
    review_count: Optional[int] = None,
    min_score: int = 40,
) -> Tuple[bool, str, int]:
    """
    Extra validation for leads with personal email domains in sole trader mode.

    For leads using gmail/btinternet/etc, we require a minimum sole trader
    score (default 40, roughly 2 signals) to filter out larger businesses
    using personal emails.

    Args:
        business_name: Business name to check
        email: Email address
        phone: Phone number
        website: Website URL (if any)
        review_count: Number of Google reviews (if available)
        min_score: Minimum sole trader score required (default 40)

    Returns:
        Tuple of (passes, reason, score)
    """
    # First, reject if business name has corporate indicators
    if is_corporate_name(business_name):
        return False, f"Business name contains corporate indicator (Ltd/Limited/Group/etc)", 0

    # Calculate sole trader score
    score = calculate_sole_trader_score(
        business_name=business_name,
        email=email,
        phone=phone,
        website=website,
        review_count=review_count,
    )

    # Collect signals for logging
    signals = []
    if phone:
        phone_clean = re.sub(r'[^\d]', '', phone)
        if phone_clean.startswith('07') or phone_clean.startswith('447'):
            signals.append("mobile_phone")
    if review_count is None or review_count <= 25:
        signals.append("low_reviews")
    if has_personal_name_pattern(business_name):
        signals.append("personal_name")
    if not website or not website.strip():
        signals.append("no_website")

    # Require minimum score (roughly 2+ signals)
    if score >= min_score:
        return True, f"Sole trader score {score} (signals: {', '.join(signals) or 'none'})", score
    else:
        return False, f"Sole trader score {score} below threshold {min_score} (signals: {', '.join(signals) or 'none'})", score


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
    sole_trader_score: int = 0  # 0-100 score indicating likelihood of sole trader


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
    phone: Optional[str] = None,
    review_count: Optional[int] = None,
    sole_trader_mode: bool = True,
) -> ApprovalResult:
    """
    Check if a lead should be auto-approved.

    Args:
        email: Raw email address
        website: Business website URL
        send_eligible: Whether lead passed eligibility checks
        business_name: Business name for logging
        allow_free_emails: If True, don't reject free email providers
        phone: Phone number (used for sole trader validation)
        review_count: Number of Google reviews (used for sole trader validation)
        sole_trader_mode: If True, allows personal emails with extra validation

    Returns:
        ApprovalResult with approval status and reasons
    """
    checks_passed = []
    checks_failed = []

    # Get config for thresholds
    config = get_config()
    max_review_count = config.auto_approve.max_review_count
    min_sole_trader_score = config.auto_approve.min_sole_trader_score

    # ==========================================================================
    # Check 0a: High review count rejection (business size filter)
    # ==========================================================================
    # Businesses with many reviews likely have admin staff and existing systems.
    # YapMate targets sole traders/small businesses (1-10 staff) doing their
    # own admin at night/weekends.
    if sole_trader_mode and review_count is not None and review_count > max_review_count:
        checks_failed.append(f"high_reviews: {review_count} reviews > {max_review_count} threshold")
        return ApprovalResult(
            approved=False,
            reason=f"High review count ({review_count}) - likely established business with admin staff",
            email_original=email or "",
            email_sanitized=None,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    if sole_trader_mode:
        checks_passed.append(f"review_count_check: {review_count or 'unknown'} reviews <= {max_review_count}")

    # ==========================================================================
    # Check 0b: Business size estimation
    # ==========================================================================
    # Estimate if this is a sole trader, small business (2-10), or medium (10+)
    if sole_trader_mode:
        estimated_size = estimate_business_size(
            business_name=business_name,
            review_count=review_count,
            website=website,
            phone=phone,
        )
        if estimated_size == 'medium':
            checks_failed.append(f"business_size: estimated as 'medium' (10+ employees)")
            return ApprovalResult(
                approved=False,
                reason=f"Business appears too large (estimated 10+ employees based on signals)",
                email_original=email or "",
                email_sanitized=None,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
            )
        checks_passed.append(f"business_size_check: estimated as '{estimated_size}'")

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
    # Check 6: Free email providers (with Sole Trader Mode)
    # ==========================================================================
    is_free_email = email_domain in FREE_EMAIL_PROVIDERS

    if is_free_email:
        if allow_free_emails:
            # Explicitly allowed - skip all free email checks
            checks_passed.append(f"free_email: allowed ({email_domain})")
        elif sole_trader_mode:
            # Sole Trader Mode: allow personal emails with extra validation
            # Requires minimum sole trader score (default 40, roughly 2 signals)
            passes, reason, st_score = passes_sole_trader_validation(
                business_name=business_name,
                email=clean_email,
                phone=phone,
                website=website,
                review_count=review_count,
                min_score=min_sole_trader_score,
            )
            if passes:
                checks_passed.append(f"sole_trader_mode: {reason}")
            else:
                checks_failed.append(f"sole_trader_mode: {reason}")
                return ApprovalResult(
                    approved=False,
                    reason=f"Free email rejected (sole trader check failed): {reason}",
                    email_original=email,
                    email_sanitized=clean_email,
                    checks_passed=checks_passed,
                    checks_failed=checks_failed,
                    sole_trader_score=st_score,
                )
        else:
            # Neither allow_free_emails nor sole_trader_mode - reject
            checks_failed.append(f"free_email: {email_domain} is a free email provider")
            return ApprovalResult(
                approved=False,
                reason=f"Free email provider not allowed: {email_domain}",
                email_original=email,
                email_sanitized=clean_email,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
            )
    else:
        checks_passed.append("free_email_check: business domain")

    # ==========================================================================
    # Check 6b: Corporate name rejection (Sole Trader Mode)
    # ==========================================================================
    # When sole_trader_mode is enabled, reject companies with corporate indicators
    # like Ltd, Limited, Group, PLC, etc. - even if they have business emails.
    # This ensures we're targeting owner-operators, not larger companies.
    if sole_trader_mode and is_corporate_name(business_name):
        checks_failed.append(f"corporate_name: '{business_name}' contains Ltd/Limited/Group/etc.")
        return ApprovalResult(
            approved=False,
            reason=f"Corporate name pattern detected (sole trader mode): {business_name}",
            email_original=email,
            email_sanitized=clean_email,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
        )

    if sole_trader_mode:
        checks_passed.append("corporate_name_check: no corporate indicators")

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

    # Calculate sole trader score for logging/diagnostics
    score = calculate_sole_trader_score(
        business_name=business_name,
        email=clean_email,
        phone=phone,
        website=website,
        review_count=review_count,
    )

    return ApprovalResult(
        approved=True,
        reason=f"All {len(checks_passed)} checks passed",
        email_original=email,
        email_sanitized=clean_email,
        checks_passed=checks_passed,
        checks_failed=checks_failed,
        sole_trader_score=score,
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
        Dict with approval statistics including sole trader scores
    """
    config = get_config()
    sole_trader_mode = config.auto_approve.sole_trader_mode

    stats = {
        'processed': 0,
        'approved': 0,
        'rejected': 0,
        'skipped': 0,
        'approval_reasons': [],
        'rejection_reasons': [],
        'sole_trader_scores': [],  # Track scores for logging
    }

    print(f"\n" + "=" * 70)
    print("AUTO-APPROVAL PIPELINE")
    print("=" * 70)
    print(f"  Leads to process: {len(leads)}")
    print(f"  Max per run: {max_per_run}")
    print(f"  Allow free emails: {allow_free_emails}")
    print(f"  Sole Trader Mode: {sole_trader_mode}")

    # Collect ALL updates for true batch write (approved + rejected)
    all_updates = []

    for i, lead in enumerate(leads[:max_per_run], 1):
        print(f"\n[{i}/{min(len(leads), max_per_run)}] {lead.business_name}")
        print("-" * 40)

        stats['processed'] += 1

        # Extract review count from raw_data if available
        review_count = None
        if hasattr(lead, 'raw_data') and lead.raw_data:
            review_count = lead.raw_data.get('reviewsCount') or lead.raw_data.get('totalScore')

        # Run approval checks with sole trader mode
        result = check_auto_approval(
            email=lead.email,
            website=getattr(lead, 'website', None),
            send_eligible=lead.send_eligible,
            business_name=lead.business_name,
            allow_free_emails=allow_free_emails,
            phone=getattr(lead, 'phone', None),
            review_count=review_count,
            sole_trader_mode=sole_trader_mode,
        )

        # Track sole trader score
        stats['sole_trader_scores'].append(result.sole_trader_score)

        print(f"  Email: {result.email_original}")
        print(f"  Sanitized: {result.email_sanitized or 'N/A'}")
        print(f"  Sole Trader Score: {result.sole_trader_score}/100")
        print(f"  Approved: {result.approved}")
        print(f"  Reason: {result.reason}")

        if result.approved:
            stats['approved'] += 1
            stats['approval_reasons'].append({
                'lead_id': lead.lead_id,
                'business': lead.business_name,
                'email': result.email_sanitized,
                'reason': result.reason,
                'sole_trader_score': result.sole_trader_score,
            })

            # Queue for batch update (include send_eligible=True)
            all_updates.append({
                'lead_id': lead.lead_id,
                'status': 'APPROVED',
                'send_eligible': True,  # Ensure send_eligible is set to True
                'eligibility_reason': result.reason,
            })

            print(f"  -> AUTO-APPROVED (score: {result.sole_trader_score})")
        else:
            stats['rejected'] += 1
            stats['rejection_reasons'].append({
                'lead_id': lead.lead_id,
                'business': lead.business_name,
                'email': result.email_original,
                'reason': result.reason,
                'checks_failed': result.checks_failed,
                'sole_trader_score': result.sole_trader_score,
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

    # Sole trader score distribution
    if stats['sole_trader_scores']:
        scores = stats['sole_trader_scores']
        avg_score = sum(scores) / len(scores)
        print(f"\n  SOLE TRADER SCORES:")
        print(f"    Min: {min(scores)}")
        print(f"    Avg: {avg_score:.1f}")
        print(f"    Max: {max(scores)}")
        print(f"    Score ≥50 (likely sole trader): {sum(1 for s in scores if s >= 50)}/{len(scores)}")

    print("=" * 70)

    return stats
