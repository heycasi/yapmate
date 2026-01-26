"""API Key validation utilities.

DEPRECATED: This module is kept for backward compatibility only.
All new code should use src.secrets module directly.

The functions in this module now delegate to the centralized
secrets module for validation.
"""

import warnings
from typing import Optional, Tuple
from dataclasses import dataclass

from src.secrets import (
    get_openai_api_key,
    get_apify_token,
    get_apify_actor_id,
    SecretValidationError,
    _clean_secret
)


@dataclass
class KeyValidationResult:
    """Result of API key validation."""
    is_valid: bool
    cleaned_key: Optional[str]
    error_message: Optional[str] = None


def strip_and_validate_key(key: Optional[str], key_name: str = "API key") -> KeyValidationResult:
    """
    Strip whitespace/newlines from key and validate basic format.

    DEPRECATED: Use src.secrets module directly.
    """
    if key is None:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"{key_name} not set"
        )

    cleaned = _clean_secret(key)

    if not cleaned:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"{key_name} is empty after stripping whitespace"
        )

    if cleaned.startswith('$') or '${' in cleaned:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"{key_name} appears to contain unresolved shell variables"
        )

    return KeyValidationResult(
        is_valid=True,
        cleaned_key=cleaned,
        error_message=None
    )


def validate_openai_key(key: Optional[str], verbose: bool = False) -> KeyValidationResult:
    """
    Validate OpenAI API key format.

    DEPRECATED: Use src.secrets.get_openai_api_key() directly.
    """
    if key is None:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message="OPENAI_API_KEY not set"
        )

    cleaned = _clean_secret(key)

    if not cleaned:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message="OPENAI_API_KEY is empty after stripping"
        )

    # Use same validation pattern as secrets module
    import re
    pattern = re.compile(r'^sk-(?:proj-)?[A-Za-z0-9_-]{30,200}$')

    if not pattern.match(cleaned):
        prefix = cleaned[:6] if len(cleaned) >= 6 else cleaned
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"OPENAI_API_KEY invalid format. Got prefix: '{prefix}...'"
        )

    return KeyValidationResult(
        is_valid=True,
        cleaned_key=cleaned,
        error_message=None
    )


def preflight_check_openai(verbose: bool = None) -> Tuple[bool, Optional[str]]:
    """
    Pre-flight check for OpenAI API key.

    DEPRECATED: Use src.secrets.get_openai_api_key() directly.
    """
    try:
        secret = get_openai_api_key(required=False)
        if secret:
            print(f"  [PASS] OpenAI: {secret.prefix}...{secret.suffix} ({secret.length} chars)")
            return True, secret.value
        else:
            print("  [FAIL] OpenAI: not set")
            return False, None
    except SecretValidationError as e:
        print(f"  [FAIL] OpenAI: {e}")
        return False, None


def preflight_check_apify() -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Pre-flight check for Apify credentials.

    DEPRECATED: Use src.secrets.get_apify_token() and get_apify_actor_id() directly.
    """
    try:
        token = get_apify_token(required=False)
        actor = get_apify_actor_id(required=False)

        if token and actor:
            print(f"  [PASS] Apify: token={token.prefix}..., actor={actor[:15]}...")
            return True, token.value, actor
        else:
            print("  [FAIL] Apify: credentials not set")
            return False, None, None
    except SecretValidationError as e:
        print(f"  [FAIL] Apify: {e}")
        return False, None, None


def run_preflight_checks() -> dict:
    """
    Run all pre-flight checks and return status dict.

    DEPRECATED: Use src.secrets.run_mandatory_preflight() for production code.
    This function returns a dict for backward compatibility but new code should
    use the centralized module directly.
    """
    print("\n--- Pre-flight API Checks (Legacy) ---")

    openai_ok, openai_key = preflight_check_openai()
    apify_ok, apify_token, apify_actor = preflight_check_apify()

    print("--------------------------------------\n")

    return {
        'openai_key': openai_key,
        'openai_valid': openai_ok,
        'apify_token': apify_token,
        'apify_actor': apify_actor,
        'apify_valid': apify_ok,
        'all_valid': openai_ok and apify_ok
    }
