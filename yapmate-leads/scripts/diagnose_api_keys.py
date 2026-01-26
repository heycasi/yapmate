#!/usr/bin/env python3
"""
Diagnose API key issues.

Prints safe diagnostic info about environment variables without exposing secrets.
Uses centralized secrets module for validation.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

# Don't load dotenv initially - we want to see raw environment first
# This helps diagnose if dotenv is overriding GitHub secrets


def main():
    print("=" * 60)
    print("API KEY DIAGNOSTICS (Centralized)")
    print("=" * 60)
    print(f"\nNote: Showing raw environment BEFORE dotenv loading")

    # Check if there's a .env file
    env_path = project_dir / ".env"
    if env_path.exists():
        print(f"\nWARNING: .env file exists at: {env_path}")
        print("If running in CI, this file should NOT be present.")
        print("Local .env may OVERRIDE GitHub secrets!")
    else:
        print(f"\nNo .env file found (expected in CI)")

    # Show raw environment state
    print("\n" + "-" * 40)
    print("RAW ENVIRONMENT (before dotenv):")
    print("-" * 40)

    for name in ["OPENAI_API_KEY", "APIFY_API_TOKEN", "APIFY_ACTOR_ID",
                 "RESEND_API_KEY", "GOOGLE_SHEET_ID"]:
        raw = os.getenv(name)
        if raw is None:
            print(f"  {name}: NOT SET")
        else:
            # Safe preview
            if len(raw) < 10:
                preview = f"[{len(raw)} chars - too short]"
            else:
                preview = f"{raw[:4]}...{raw[-4:]} ({len(raw)} chars)"
            print(f"  {name}: {preview}")

    # Now load dotenv and use centralized validation
    print("\n" + "-" * 40)
    print("CENTRALIZED VALIDATION:")
    print("-" * 40)

    from dotenv import load_dotenv
    load_dotenv()

    from src.secrets import (
        get_openai_api_key, get_apify_token, get_apify_actor_id,
        get_resend_api_key, SecretValidationError, print_safe_diagnostics
    )

    # Print full diagnostics
    print_safe_diagnostics()

    # Final summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY:")
    print("=" * 60)

    all_valid = True

    # OpenAI
    try:
        secret = get_openai_api_key(required=True)
        print(f"  OpenAI: VALID ({secret.prefix}...{secret.suffix})")
    except SecretValidationError as e:
        print(f"  OpenAI: INVALID - {e}")
        all_valid = False

    # Apify
    try:
        token = get_apify_token(required=True)
        actor = get_apify_actor_id(required=True)
        print(f"  Apify: VALID (token: {token.prefix}..., actor: {actor[:15]}...)")
    except SecretValidationError as e:
        print(f"  Apify: INVALID - {e}")
        all_valid = False

    # Resend (not required for sequencer)
    try:
        secret = get_resend_api_key(required=False)
        if secret:
            print(f"  Resend: VALID ({secret.prefix}...{secret.suffix})")
        else:
            print(f"  Resend: NOT SET (optional)")
    except SecretValidationError as e:
        print(f"  Resend: INVALID - {e}")

    print("=" * 60)

    if all_valid:
        print("\nRESULT: ALL REQUIRED SECRETS VALID")
        return 0
    else:
        print("\nRESULT: VALIDATION FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
