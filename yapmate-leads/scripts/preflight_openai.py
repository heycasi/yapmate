#!/usr/bin/env python3
"""Pre-flight OpenAI key validation script.

Uses centralized secrets module for validation.
Prints only: configured status, key length, prefix/suffix (safe).

Usage:
    python scripts/preflight_openai.py
    python scripts/preflight_openai.py --verbose

Exit codes:
    0 = Valid key
    1 = Invalid/missing key
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))

from dotenv import load_dotenv
load_dotenv()

from src.secrets import get_openai_api_key, SecretValidationError, print_safe_diagnostics


def main():
    """Run OpenAI pre-flight validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate OpenAI API key")
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed diagnostics for all secrets"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("OpenAI Pre-flight Validation (Centralized)")
    print("=" * 60)

    if args.verbose:
        print_safe_diagnostics()

    # Check raw presence first
    raw_key = os.getenv("OPENAI_API_KEY")
    print(f"\nRaw key present: {raw_key is not None}")
    if raw_key:
        print(f"Raw key length: {len(raw_key)}")
        has_quotes = raw_key.startswith('"') or raw_key.startswith("'")
        print(f"Has quotes: {has_quotes}")
        has_newlines = chr(10) in raw_key or chr(13) in raw_key
        print(f"Has newlines: {has_newlines}")

    # Validate using centralized module
    print("\nValidating with centralized secrets module...")
    try:
        secret = get_openai_api_key(required=True)
        print(f"\nOpenAI configured: YES")
        print(f"Key length: {secret.length}")
        print(f"Prefix: {secret.prefix}")
        print(f"Suffix: {secret.suffix}")
        print(f"Format: {'sk-proj-' if secret.prefix.startswith('sk-p') else 'sk-'}")
        print()
        print("=" * 60)
        print("STATUS: VALID")
        print("=" * 60)
        return 0

    except SecretValidationError as e:
        print(f"\nOpenAI configured: NO")
        print(f"Error: {e}")
        print()
        print("=" * 60)
        print("STATUS: INVALID")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
