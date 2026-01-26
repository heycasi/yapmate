#!/usr/bin/env python3
"""
Diagnose API key issues.

Prints safe diagnostic info about environment variables without exposing secrets.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

# Don't load dotenv - we want to see what's in the environment ONLY
# This helps diagnose if dotenv is overriding GitHub secrets


def safe_preview(value: str) -> str:
    """Return safe preview of key for debugging."""
    if value is None:
        return "[None]"
    if len(value) == 0:
        return "[empty string]"
    if len(value) < 10:
        return f"[{len(value)} chars - too short to preview]"
    return f"{value[:4]}...{value[-4:]} ({len(value)} chars)"


def analyze_key(name: str, value: str):
    """Analyze a key and print diagnostic info."""
    print(f"\n{name}:")
    print(f"  Present: {value is not None}")

    if value is None:
        return

    print(f"  Length: {len(value)}")
    print(f"  Preview: {safe_preview(value)}")

    # Check for common issues
    issues = []

    if value.startswith('"') or value.startswith("'"):
        issues.append("starts with quote")
    if value.endswith('"') or value.endswith("'"):
        issues.append("ends with quote")
    if '\n' in value:
        issues.append("contains newline")
    if '\r' in value:
        issues.append("contains carriage return")
    if value.startswith(' ') or value.endswith(' '):
        issues.append("has leading/trailing spaces")
    if value.startswith('$'):
        issues.append("starts with $ (unresolved variable?)")
    if '${' in value:
        issues.append("contains ${ (unresolved variable?)")

    # Key-specific checks
    if name == "OPENAI_API_KEY":
        if not value.strip("'\"").startswith('sk-'):
            issues.append(f"does not start with 'sk-' (first 4 chars: '{value[:4]}')")

    if issues:
        print(f"  Issues: {', '.join(issues)}")
    else:
        print(f"  Issues: None detected")


def main():
    print("=" * 60)
    print("API KEY DIAGNOSTICS")
    print("=" * 60)
    print(f"\nNote: NOT loading .env file - showing raw environment only")

    # Check if there's a .env file
    env_path = project_dir / ".env"
    if env_path.exists():
        print(f"\n.env file exists at: {env_path}")
        print("If running in CI, this file should NOT be present.")
    else:
        print(f"\nNo .env file found (expected in CI)")

    # Analyze each key
    analyze_key("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY"))
    analyze_key("APIFY_API_TOKEN", os.getenv("APIFY_API_TOKEN"))
    analyze_key("APIFY_ACTOR_ID", os.getenv("APIFY_ACTOR_ID"))
    analyze_key("RESEND_API_KEY", os.getenv("RESEND_API_KEY"))
    analyze_key("GOOGLE_SHEET_ID", os.getenv("GOOGLE_SHEET_ID"))

    # Check for credentials JSON (just check presence, not content)
    creds_json = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
    print(f"\nGOOGLE_SHEETS_CREDENTIALS_JSON:")
    print(f"  Present: {creds_json is not None}")
    if creds_json:
        print(f"  Length: {len(creds_json)}")
        print(f"  Looks like JSON: {creds_json.strip().startswith('{')}")

    print("\n" + "=" * 60)

    # Now test with the full validation
    print("\nRunning full validation (loads dotenv):")
    print("-" * 40)

    # Import after analysis to see the difference
    from src.api_key_utils import run_preflight_checks

    os.environ["DEBUG_API_KEYS"] = "true"
    result = run_preflight_checks()

    print("-" * 40)
    print(f"OpenAI valid: {result['openai_valid']}")
    print(f"Apify valid: {result['apify_valid']}")
    print("=" * 60)

    return 0 if result['openai_valid'] else 1


if __name__ == "__main__":
    sys.exit(main())
