#!/usr/bin/env python3
"""Quick validation script for API key pre-flight checks.

Uses centralized secrets module to validate:
1. OpenAI key is valid and properly formatted
2. Apify credentials are set
3. Keys don't have whitespace/newline/quote issues

Usage:
    python scripts/validate_api_keys.py
"""

import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))

from dotenv import load_dotenv
load_dotenv()

from src.secrets import (
    run_mandatory_preflight, SecretValidationError, print_safe_diagnostics
)


def main():
    print("=" * 60)
    print("API Key Validation Script (Centralized)")
    print("=" * 60)

    # Show safe diagnostics first
    print_safe_diagnostics()

    # Run mandatory pre-flight checks
    print("\n" + "=" * 60)
    print("RUNNING MANDATORY PREFLIGHT")
    print("=" * 60)

    try:
        result = run_mandatory_preflight(
            require_openai=True,
            require_apify=True,
            require_resend=False,  # Optional
            require_sheets=False   # Not testing sheets here
        )

        print("\n" + "=" * 60)
        print("RESULT: ALL CHECKS PASSED")
        print("=" * 60)
        print(f"  OpenAI key length: {len(result.openai_key)}")
        print(f"  Apify actor: {result.apify_actor}")
        return 0

    except SecretValidationError as e:
        print("\n" + "=" * 60)
        print("RESULT: VALIDATION FAILED")
        print("=" * 60)
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
