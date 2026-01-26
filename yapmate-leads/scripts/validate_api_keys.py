#!/usr/bin/env python3
"""Quick validation script for API key pre-flight checks.

Run this locally to verify:
1. OpenAI key is valid and properly formatted
2. Apify credentials are set
3. Keys don't have whitespace/newline issues

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

from src.api_key_utils import run_preflight_checks, validate_openai_key
import os


def main():
    print("=" * 60)
    print("API Key Validation Script")
    print("=" * 60)

    # Run all pre-flight checks
    results = run_preflight_checks()

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    if results['openai_valid']:
        print(f"✅ OpenAI: VALID (key length: {len(results['openai_key'])})")
    else:
        print("❌ OpenAI: INVALID or MISSING")
        # Show debug info
        raw_key = os.getenv("OPENAI_API_KEY")
        if raw_key:
            print(f"   Raw key length: {len(raw_key)}")
            has_newlines = '\n' in raw_key or '\r' in raw_key
            has_whitespace = raw_key != raw_key.strip()
            print(f"   Has newlines: {has_newlines}")
            print(f"   Has leading/trailing whitespace: {has_whitespace}")
            print(f"   First 10 chars: {raw_key[:10]}...")
        else:
            print("   Key not set in environment")

    if results['apify_valid']:
        print(f"✅ Apify: VALID")
    else:
        print("❌ Apify: INVALID or MISSING")

    print()

    if results['all_valid']:
        print("✅ All pre-flight checks passed!")
        return 0
    else:
        print("⚠️  Some checks failed - see details above")
        return 1


if __name__ == "__main__":
    sys.exit(main())
