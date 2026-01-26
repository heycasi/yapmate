"""API Key validation utilities.

Provides pre-flight validation for API keys to catch configuration issues
early and fail gracefully rather than mid-pipeline.
"""

import os
import re
from typing import Optional, Tuple
from dataclasses import dataclass


@dataclass
class KeyValidationResult:
    """Result of API key validation."""
    is_valid: bool
    cleaned_key: Optional[str]
    error_message: Optional[str] = None


def _safe_key_preview(key: str) -> str:
    """Return safe preview of key for debugging (first 3, last 4 chars)."""
    if len(key) < 10:
        return f"[too short: {len(key)} chars]"
    return f"{key[:3]}...{key[-4:]} ({len(key)} chars)"


def strip_and_validate_key(key: Optional[str], key_name: str = "API key") -> KeyValidationResult:
    """
    Strip whitespace/newlines from key and validate basic format.

    Args:
        key: Raw key value (may contain whitespace/newlines)
        key_name: Name for logging purposes

    Returns:
        KeyValidationResult with cleaned key if valid
    """
    if key is None:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"{key_name} not set"
        )

    # Strip whitespace, newlines, and any shell artifacts
    cleaned = key.strip().replace('\n', '').replace('\r', '')

    # Strip surrounding quotes (common copy-paste error)
    if (cleaned.startswith('"') and cleaned.endswith('"')) or \
       (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1]

    if not cleaned:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"{key_name} is empty after stripping whitespace"
        )

    # Check for common shell interpolation issues
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

    OpenAI keys typically start with 'sk-' and are 40-60+ characters.

    Args:
        key: Raw OpenAI API key
        verbose: If True, print diagnostic info (safe - no secrets exposed)

    Returns:
        KeyValidationResult with cleaned key if valid
    """
    result = strip_and_validate_key(key, "OPENAI_API_KEY")

    if not result.is_valid:
        if verbose and key is not None:
            # Log diagnostics for non-None keys that failed basic validation
            print(f"  [DEBUG] Key raw length: {len(key)}")
            print(f"  [DEBUG] Key preview: {_safe_key_preview(key)}")
        return result

    cleaned = result.cleaned_key

    if verbose:
        print(f"  [DEBUG] Key after cleaning: {_safe_key_preview(cleaned)}")
        print(f"  [DEBUG] Starts with 'sk-': {cleaned.startswith('sk-')}")

    # OpenAI keys start with sk- (or sk-proj- for project keys)
    if not cleaned.startswith('sk-'):
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"OPENAI_API_KEY does not start with 'sk-' (invalid format). Got prefix: '{cleaned[:6] if len(cleaned) >= 6 else cleaned}...'"
        )

    # Keys should be reasonably long (at least 30 chars)
    if len(cleaned) < 30:
        return KeyValidationResult(
            is_valid=False,
            cleaned_key=None,
            error_message=f"OPENAI_API_KEY too short ({len(cleaned)} chars, expected 30+)"
        )

    return KeyValidationResult(
        is_valid=True,
        cleaned_key=cleaned,
        error_message=None
    )


def preflight_check_openai(verbose: bool = None) -> Tuple[bool, Optional[str]]:
    """
    Pre-flight check for OpenAI API key.

    Reads from environment, validates, and returns cleaned key.
    Logs status without exposing key contents.

    Args:
        verbose: Enable debug logging. If None, uses DEBUG_API_KEYS env var.

    Returns:
        Tuple of (success, cleaned_key or None)
    """
    if verbose is None:
        verbose = os.getenv("DEBUG_API_KEYS", "").lower() in ("true", "1", "yes")

    raw_key = os.getenv("OPENAI_API_KEY")
    result = validate_openai_key(raw_key, verbose=verbose)

    if result.is_valid:
        print(f"  ✓ OpenAI configured: yes (key length: {len(result.cleaned_key)})")
        return True, result.cleaned_key
    else:
        print(f"  ✗ OpenAI configured: no - {result.error_message}")
        return False, None


def preflight_check_apify() -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Pre-flight check for Apify credentials.

    Returns:
        Tuple of (success, cleaned_token, actor_id)
    """
    raw_token = os.getenv("APIFY_API_TOKEN")
    actor_id = os.getenv("APIFY_ACTOR_ID")

    token_result = strip_and_validate_key(raw_token, "APIFY_API_TOKEN")

    if not token_result.is_valid:
        print(f"  ✗ Apify configured: no - {token_result.error_message}")
        return False, None, None

    if not actor_id or not actor_id.strip():
        print("  ✗ Apify configured: no - APIFY_ACTOR_ID not set")
        return False, None, None

    print(f"  ✓ Apify configured: yes (actor: {actor_id.strip()[:20]}...)")
    return True, token_result.cleaned_key, actor_id.strip()


def run_preflight_checks() -> dict:
    """
    Run all pre-flight checks and return status dict.

    Returns:
        Dict with keys: openai_key, apify_token, apify_actor, all_valid
    """
    print("\n--- Pre-flight API Checks ---")

    openai_ok, openai_key = preflight_check_openai()
    apify_ok, apify_token, apify_actor = preflight_check_apify()

    print("-----------------------------\n")

    return {
        'openai_key': openai_key,
        'openai_valid': openai_ok,
        'apify_token': apify_token,
        'apify_actor': apify_actor,
        'apify_valid': apify_ok,
        'all_valid': openai_ok and apify_ok
    }
