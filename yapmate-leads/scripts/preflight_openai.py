#!/usr/bin/env python3
"""Pre-flight OpenAI key validation script.

Validates OpenAI API key without exposing sensitive data.
Prints only: configured status, key length, last 4 chars (optional).

Usage:
    python scripts/preflight_openai.py
    python scripts/preflight_openai.py --show-last4

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

from src.api_key_utils import validate_openai_key


def main():
    """Run OpenAI pre-flight validation."""
    import argparse

    parser = argparse.ArgumentParser(description="Validate OpenAI API key")
    parser.add_argument(
        "--show-last4",
        action="store_true",
        help="Show last 4 characters of key (for debugging)"
    )
    args = parser.parse_args()

    print("=" * 50)
    print("OpenAI Pre-flight Validation")
    print("=" * 50)

    raw_key = os.getenv("OPENAI_API_KEY")

    # Basic presence check
    if raw_key is None:
        print("OpenAI configured: no")
        print("Reason: OPENAI_API_KEY environment variable not set")
        return 1

    # Check for whitespace/newline issues (diagnostic)
    has_newlines = '\n' in raw_key or '\r' in raw_key
    has_leading_trailing = raw_key != raw_key.strip()
    has_shell_var = raw_key.startswith('$') or '${' in raw_key

    print(f"Raw key present: yes")
    print(f"Key length (raw): {len(raw_key)}")
    print(f"Has newlines: {has_newlines}")
    print(f"Has leading/trailing whitespace: {has_leading_trailing}")
    print(f"Contains shell variable syntax: {has_shell_var}")

    # Run full validation
    result = validate_openai_key(raw_key)

    print()
    if result.is_valid:
        print(f"OpenAI configured: yes")
        print(f"Key length (cleaned): {len(result.cleaned_key)}")
        print(f"Starts with 'sk-': yes")

        if args.show_last4:
            last4 = result.cleaned_key[-4:]
            print(f"Key last 4 chars: ...{last4}")

        print()
        print("Status: VALID")
        return 0
    else:
        print(f"OpenAI configured: no")
        print(f"Reason: {result.error_message}")
        print()
        print("Status: INVALID")
        return 1


if __name__ == "__main__":
    sys.exit(main())
