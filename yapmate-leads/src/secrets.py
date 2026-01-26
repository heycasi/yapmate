"""Centralized secret management.

This module is the SINGLE SOURCE OF TRUTH for all API key handling.
All secrets must be read through this module - no direct os.getenv() calls
for secrets anywhere else in the codebase.

Features:
- Centralized reading and validation
- Strict format validation with regex
- Quote and whitespace stripping
- Fail-fast behavior (no silent fallbacks)
- Safe diagnostics (no secret exposure)
"""

import os
import re
from typing import Optional, NamedTuple
from dataclasses import dataclass


class SecretValidationError(Exception):
    """Raised when a secret fails validation."""
    pass


@dataclass
class ValidatedSecret:
    """Result of secret validation."""
    name: str
    value: str
    length: int
    prefix: str  # First 3-4 chars for diagnostics
    suffix: str  # Last 4 chars for diagnostics


# =============================================================================
# VALIDATION PATTERNS
# =============================================================================

# OpenAI API key pattern:
# - Must start with sk- or sk-proj-
# - Followed by alphanumeric and some special chars
# - Total length 40-200 chars (project keys are longer)
OPENAI_KEY_PATTERN = re.compile(r'^sk-(?:proj-)?[A-Za-z0-9_-]{30,200}$')

# Apify token pattern:
# - apify_api_ prefix followed by alphanumeric
APIFY_TOKEN_PATTERN = re.compile(r'^apify_api_[A-Za-z0-9]{20,100}$')

# Resend API key pattern:
# - re_ prefix followed by alphanumeric and underscores
RESEND_KEY_PATTERN = re.compile(r'^re_[A-Za-z0-9_]{20,100}$')

# Invalid patterns to reject
INVALID_PATTERNS = [
    re.compile(r'^\*+$'),  # Masked values like ***
    re.compile(r'^your_.*_here$', re.IGNORECASE),  # Placeholders
    re.compile(r'^<.*>$'),  # Template placeholders like <API_KEY>
    re.compile(r'^\$\{?[A-Z_]+\}?$'),  # Unresolved shell variables
    re.compile(r'^org-[A-Za-z0-9]+$'),  # OpenAI org IDs
    re.compile(r'^proj_[A-Za-z0-9]+$'),  # OpenAI project IDs (not API keys)
    re.compile(r'^gpt-'),  # Model names
    re.compile(r'^sk-ant-'),  # Anthropic keys (wrong provider)
]


# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def _clean_secret(value: str) -> str:
    """
    Clean a secret value by stripping whitespace, newlines, and quotes.

    Args:
        value: Raw secret value

    Returns:
        Cleaned secret value
    """
    if not isinstance(value, str):
        return value

    # Strip whitespace and newlines
    cleaned = value.strip().replace('\n', '').replace('\r', '')

    # Strip surrounding quotes (common copy-paste error)
    if len(cleaned) >= 2:
        if (cleaned.startswith('"') and cleaned.endswith('"')) or \
           (cleaned.startswith("'") and cleaned.endswith("'")):
            cleaned = cleaned[1:-1]

    return cleaned


def _safe_preview(value: str, prefix_len: int = 4, suffix_len: int = 4) -> tuple[str, str]:
    """
    Get safe prefix and suffix for diagnostics.

    Args:
        value: Secret value
        prefix_len: Number of prefix chars to show
        suffix_len: Number of suffix chars to show

    Returns:
        Tuple of (prefix, suffix)
    """
    if len(value) < prefix_len + suffix_len + 4:
        return ("[short]", "[short]")
    return (value[:prefix_len], value[-suffix_len:])


def _validate_not_invalid(name: str, value: str) -> None:
    """
    Check that value doesn't match any invalid patterns.

    Args:
        name: Secret name for error messages
        value: Cleaned secret value

    Raises:
        SecretValidationError: If value matches an invalid pattern
    """
    for pattern in INVALID_PATTERNS:
        if pattern.match(value):
            raise SecretValidationError(
                f"{name} appears to be invalid (matched pattern: {pattern.pattern}). "
                f"Got: '{value[:10]}...'"
            )


# =============================================================================
# PUBLIC API - SINGLE SOURCE OF TRUTH FOR ALL SECRET READS
# =============================================================================

def get_openai_api_key(required: bool = True) -> Optional[ValidatedSecret]:
    """
    Get and validate the OpenAI API key.

    This is the ONLY function that should read OPENAI_API_KEY from environment.

    Args:
        required: If True, raises exception if key is missing/invalid

    Returns:
        ValidatedSecret if valid, None if not required and missing

    Raises:
        SecretValidationError: If required and key is missing/invalid
    """
    raw = os.getenv("OPENAI_API_KEY")

    if raw is None:
        if required:
            raise SecretValidationError(
                "OPENAI_API_KEY not set in environment. "
                "This is required for lead enrichment."
            )
        return None

    cleaned = _clean_secret(raw)

    if not cleaned:
        if required:
            raise SecretValidationError(
                "OPENAI_API_KEY is empty after cleaning whitespace/quotes."
            )
        return None

    # Check for invalid patterns
    _validate_not_invalid("OPENAI_API_KEY", cleaned)

    # Validate format with regex
    if not OPENAI_KEY_PATTERN.match(cleaned):
        prefix, suffix = _safe_preview(cleaned)
        raise SecretValidationError(
            f"OPENAI_API_KEY has invalid format. "
            f"Must match pattern: sk-[...] or sk-proj-[...] with 30+ chars after prefix. "
            f"Got: prefix='{prefix}', suffix='{suffix}', length={len(cleaned)}"
        )

    prefix, suffix = _safe_preview(cleaned)
    return ValidatedSecret(
        name="OPENAI_API_KEY",
        value=cleaned,
        length=len(cleaned),
        prefix=prefix,
        suffix=suffix
    )


def get_apify_token(required: bool = True) -> Optional[ValidatedSecret]:
    """
    Get and validate the Apify API token.

    This is the ONLY function that should read APIFY_API_TOKEN from environment.

    Args:
        required: If True, raises exception if token is missing/invalid

    Returns:
        ValidatedSecret if valid, None if not required and missing

    Raises:
        SecretValidationError: If required and token is missing/invalid
    """
    raw = os.getenv("APIFY_API_TOKEN")

    if raw is None:
        if required:
            raise SecretValidationError(
                "APIFY_API_TOKEN not set in environment. "
                "This is required for lead scraping."
            )
        return None

    cleaned = _clean_secret(raw)

    if not cleaned:
        if required:
            raise SecretValidationError(
                "APIFY_API_TOKEN is empty after cleaning whitespace/quotes."
            )
        return None

    # Check for invalid patterns
    _validate_not_invalid("APIFY_API_TOKEN", cleaned)

    # Validate format with regex
    if not APIFY_TOKEN_PATTERN.match(cleaned):
        prefix, suffix = _safe_preview(cleaned)
        raise SecretValidationError(
            f"APIFY_API_TOKEN has invalid format. "
            f"Must match pattern: apify_api_[...]. "
            f"Got: prefix='{prefix}', suffix='{suffix}', length={len(cleaned)}"
        )

    prefix, suffix = _safe_preview(cleaned)
    return ValidatedSecret(
        name="APIFY_API_TOKEN",
        value=cleaned,
        length=len(cleaned),
        prefix=prefix,
        suffix=suffix
    )


def get_apify_actor_id(required: bool = True) -> Optional[str]:
    """
    Get the Apify actor ID.

    Args:
        required: If True, raises exception if missing

    Returns:
        Actor ID string, or None if not required and missing

    Raises:
        SecretValidationError: If required and missing
    """
    raw = os.getenv("APIFY_ACTOR_ID")

    if raw is None or not raw.strip():
        if required:
            raise SecretValidationError(
                "APIFY_ACTOR_ID not set in environment. "
                "This is required for lead scraping."
            )
        return None

    return raw.strip()


def get_resend_api_key(required: bool = True) -> Optional[ValidatedSecret]:
    """
    Get and validate the Resend API key.

    Args:
        required: If True, raises exception if key is missing/invalid

    Returns:
        ValidatedSecret if valid, None if not required and missing

    Raises:
        SecretValidationError: If required and key is missing/invalid
    """
    raw = os.getenv("RESEND_API_KEY")

    if raw is None:
        if required:
            raise SecretValidationError(
                "RESEND_API_KEY not set in environment. "
                "This is required for email sending."
            )
        return None

    cleaned = _clean_secret(raw)

    if not cleaned:
        if required:
            raise SecretValidationError(
                "RESEND_API_KEY is empty after cleaning whitespace/quotes."
            )
        return None

    # Check for invalid patterns
    _validate_not_invalid("RESEND_API_KEY", cleaned)

    # Validate format with regex
    if not RESEND_KEY_PATTERN.match(cleaned):
        prefix, suffix = _safe_preview(cleaned)
        raise SecretValidationError(
            f"RESEND_API_KEY has invalid format. "
            f"Must match pattern: re_[...]. "
            f"Got: prefix='{prefix}', suffix='{suffix}', length={len(cleaned)}"
        )

    prefix, suffix = _safe_preview(cleaned)
    return ValidatedSecret(
        name="RESEND_API_KEY",
        value=cleaned,
        length=len(cleaned),
        prefix=prefix,
        suffix=suffix
    )


def get_google_sheets_credentials() -> str:
    """
    Get Google Sheets credentials JSON.

    Returns:
        Credentials JSON string

    Raises:
        SecretValidationError: If credentials are missing or invalid
    """
    raw = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")

    if raw is None:
        raise SecretValidationError(
            "GOOGLE_SHEETS_CREDENTIALS_JSON not set in environment. "
            "This is required for data storage."
        )

    cleaned = raw.strip()

    if not cleaned:
        raise SecretValidationError(
            "GOOGLE_SHEETS_CREDENTIALS_JSON is empty."
        )

    if not cleaned.startswith('{'):
        raise SecretValidationError(
            "GOOGLE_SHEETS_CREDENTIALS_JSON does not look like JSON. "
            "Must start with '{'."
        )

    return cleaned


def get_google_sheet_id() -> str:
    """
    Get Google Sheet ID.

    Returns:
        Sheet ID string

    Raises:
        SecretValidationError: If ID is missing
    """
    raw = os.getenv("GOOGLE_SHEET_ID")

    if raw is None or not raw.strip():
        raise SecretValidationError(
            "GOOGLE_SHEET_ID not set in environment. "
            "This is required for data storage."
        )

    return raw.strip()


# =============================================================================
# PREFLIGHT CHECKS
# =============================================================================

@dataclass
class PreflightResult:
    """Result of preflight checks."""
    all_valid: bool
    openai_key: Optional[str] = None
    apify_token: Optional[str] = None
    apify_actor: Optional[str] = None
    resend_key: Optional[str] = None
    sheet_id: Optional[str] = None
    errors: list = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


def run_mandatory_preflight(
    require_openai: bool = True,
    require_apify: bool = True,
    require_resend: bool = False,
    require_sheets: bool = True
) -> PreflightResult:
    """
    Run mandatory preflight checks.

    This function validates all required secrets and FAILS HARD if any are invalid.
    No silent fallbacks. No degraded mode.

    Args:
        require_openai: If True, OpenAI key is mandatory
        require_apify: If True, Apify credentials are mandatory
        require_resend: If True, Resend key is mandatory
        require_sheets: If True, Sheets credentials are mandatory

    Returns:
        PreflightResult with validated credentials

    Raises:
        SecretValidationError: If any required secret is invalid
    """
    result = PreflightResult(all_valid=True)
    errors = []

    print("\n" + "=" * 60)
    print("MANDATORY PREFLIGHT CHECKS")
    print("=" * 60)

    # OpenAI
    if require_openai:
        try:
            secret = get_openai_api_key(required=True)
            result.openai_key = secret.value
            print(f"  [PASS] OpenAI: {secret.prefix}...{secret.suffix} ({secret.length} chars)")
        except SecretValidationError as e:
            errors.append(str(e))
            print(f"  [FAIL] OpenAI: {e}")

    # Apify
    if require_apify:
        try:
            token = get_apify_token(required=True)
            result.apify_token = token.value
            print(f"  [PASS] Apify Token: {token.prefix}...{token.suffix} ({token.length} chars)")

            actor = get_apify_actor_id(required=True)
            result.apify_actor = actor
            print(f"  [PASS] Apify Actor: {actor[:20]}...")
        except SecretValidationError as e:
            errors.append(str(e))
            print(f"  [FAIL] Apify: {e}")

    # Resend
    if require_resend:
        try:
            secret = get_resend_api_key(required=True)
            result.resend_key = secret.value
            print(f"  [PASS] Resend: {secret.prefix}...{secret.suffix} ({secret.length} chars)")
        except SecretValidationError as e:
            errors.append(str(e))
            print(f"  [FAIL] Resend: {e}")

    # Google Sheets
    if require_sheets:
        try:
            get_google_sheets_credentials()  # Just validate, don't store
            result.sheet_id = get_google_sheet_id()
            print(f"  [PASS] Google Sheets: credentials present, sheet_id={result.sheet_id[:20]}...")
        except SecretValidationError as e:
            errors.append(str(e))
            print(f"  [FAIL] Google Sheets: {e}")

    print("=" * 60)

    if errors:
        result.all_valid = False
        result.errors = errors
        print("\nPREFLIGHT FAILED - Cannot continue")
        print("Errors:")
        for error in errors:
            print(f"  - {error}")
        print()
        raise SecretValidationError(
            f"Preflight checks failed with {len(errors)} error(s). "
            f"Fix the issues above before continuing."
        )

    print("\nPREFLIGHT PASSED - All secrets valid")
    print()

    return result


def print_safe_diagnostics():
    """
    Print safe diagnostics about all secrets without exposing values.

    This is safe to call and log - no secrets are exposed.
    """
    print("\n" + "=" * 60)
    print("SECRET DIAGNOSTICS (safe - no values exposed)")
    print("=" * 60)

    for name, getter in [
        ("OPENAI_API_KEY", lambda: get_openai_api_key(required=False)),
        ("APIFY_API_TOKEN", lambda: get_apify_token(required=False)),
        ("RESEND_API_KEY", lambda: get_resend_api_key(required=False)),
    ]:
        raw = os.getenv(name)
        print(f"\n{name}:")
        print(f"  Present in env: {raw is not None}")

        if raw is not None:
            print(f"  Raw length: {len(raw)}")
            has_quotes = raw.startswith('"') or raw.startswith("'")
            print(f"  Has quotes: {has_quotes}")
            print(f"  Has newlines: {chr(10) in raw or chr(13) in raw}")
            print(f"  Has whitespace: {raw != raw.strip()}")

            try:
                secret = getter()
                if secret:
                    print(f"  Cleaned length: {secret.length}")
                    print(f"  Prefix: {secret.prefix}")
                    print(f"  Suffix: {secret.suffix}")
                    print(f"  Valid: True")
            except SecretValidationError as e:
                print(f"  Valid: False")
                print(f"  Error: {e}")

    # Apify actor (not a secret, just a config value)
    actor = os.getenv("APIFY_ACTOR_ID")
    print(f"\nAPIFY_ACTOR_ID:")
    print(f"  Present: {actor is not None}")
    if actor:
        print(f"  Value: {actor}")

    # Google Sheets
    creds = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    print(f"\nGOOGLE_SHEETS_CREDENTIALS_JSON:")
    print(f"  Present: {creds is not None}")
    if creds:
        print(f"  Length: {len(creds)}")
        print(f"  Looks like JSON: {creds.strip().startswith('{')}")

    print(f"\nGOOGLE_SHEET_ID:")
    print(f"  Present: {sheet_id is not None}")
    if sheet_id:
        print(f"  Value: {sheet_id[:20]}...")

    print("\n" + "=" * 60)
