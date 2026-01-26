#!/usr/bin/env python3
"""CI End-to-End Verification Script.

Runs before the main pipeline to verify:
1. Secret preflight (safe diagnostics)
2. Tab and schema validation for leads sheet
3. Dry-run pipeline wiring test

Usage:
    python scripts/ci_end_to_end_check.py           # Full check
    python scripts/ci_end_to_end_check.py --quick   # Preflight only

Exit codes:
    0 = All checks passed
    1 = Critical failure (secrets, sheets, or schema)
    2 = Warning (non-critical issues)
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

# =============================================================================
# PATH SETUP
# =============================================================================
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))
os.chdir(project_dir)

# =============================================================================
# IMPORTS (after path setup)
# =============================================================================
from dotenv import load_dotenv
load_dotenv()


def check_secrets() -> bool:
    """
    Run secret preflight checks (safe diagnostics).

    Returns:
        True if all required secrets are valid
    """
    print("\n" + "=" * 60)
    print("STEP 1: SECRET PREFLIGHT")
    print("=" * 60)

    from src.secrets import (
        get_openai_api_key,
        get_apify_token,
        get_apify_actor_id,
        get_resend_api_key,
        get_google_sheets_credentials,
        get_google_sheet_id,
        SecretValidationError,
    )

    all_ok = True
    checks = []

    # OpenAI
    try:
        secret = get_openai_api_key(required=False)
        if secret:
            checks.append(("OPENAI_API_KEY", "OK", f"{secret.prefix}...{secret.suffix} ({secret.length} chars)"))
        else:
            checks.append(("OPENAI_API_KEY", "MISSING", "Not set"))
            all_ok = False
    except SecretValidationError as e:
        checks.append(("OPENAI_API_KEY", "INVALID", str(e)[:50]))
        all_ok = False

    # Apify
    try:
        token = get_apify_token(required=False)
        actor = get_apify_actor_id(required=False)
        if token and actor:
            checks.append(("APIFY_API_TOKEN", "OK", f"{token.prefix}...{token.suffix}"))
            checks.append(("APIFY_ACTOR_ID", "OK", actor[:30] + "..."))
        else:
            checks.append(("APIFY_API_TOKEN", "MISSING", "Not set"))
            all_ok = False
    except SecretValidationError as e:
        checks.append(("APIFY_API_TOKEN", "INVALID", str(e)[:50]))
        all_ok = False

    # Resend (optional for preflight)
    try:
        secret = get_resend_api_key(required=False)
        if secret:
            checks.append(("RESEND_API_KEY", "OK", f"{secret.prefix}...{secret.suffix}"))
        else:
            checks.append(("RESEND_API_KEY", "OPTIONAL", "Not set (sending disabled)"))
    except SecretValidationError as e:
        checks.append(("RESEND_API_KEY", "INVALID", str(e)[:50]))

    # Google Sheets
    try:
        get_google_sheets_credentials()
        sheet_id = get_google_sheet_id()
        checks.append(("GOOGLE_SHEETS_CREDENTIALS_JSON", "OK", "Valid JSON"))
        checks.append(("GOOGLE_SHEET_ID", "OK", sheet_id[:20] + "..."))
    except SecretValidationError as e:
        checks.append(("GOOGLE_SHEETS_CREDENTIALS_JSON", "MISSING", str(e)[:50]))
        all_ok = False

    # Print results
    for name, status, detail in checks:
        icon = {"OK": "[PASS]", "MISSING": "[FAIL]", "INVALID": "[FAIL]", "OPTIONAL": "[SKIP]"}.get(status, "[????]")
        print(f"  {icon} {name}: {status}")
        if detail and status != "OK":
            print(f"        {detail}")

    print("-" * 60)
    print(f"Secret Preflight: {'PASSED' if all_ok else 'FAILED'}")

    return all_ok


def check_sheets_schema() -> bool:
    """
    Validate Google Sheets tabs and schema.

    Returns:
        True if all tabs exist with correct schema
    """
    print("\n" + "=" * 60)
    print("STEP 2: SHEETS TAB + SCHEMA VALIDATION")
    print("=" * 60)

    try:
        from src.sequencer_sheets import SequencerSheetsManager
        from src.sequencer_config import SHEETS_TABS

        sheets = SequencerSheetsManager()

        # Check required tabs
        required_tabs = ["leads", "queue", "state", "run_log", "dedupe_keys"]
        all_ok = True

        for tab_name in required_tabs:
            actual_name = SHEETS_TABS.get(tab_name, tab_name)
            try:
                worksheet = sheets.get_or_create_tab(actual_name)
                headers = worksheet.row_values(1)
                print(f"  [PASS] Tab '{actual_name}': {len(headers)} columns")
            except Exception as e:
                print(f"  [FAIL] Tab '{actual_name}': {e}")
                all_ok = False

        # Validate leads schema
        leads_tab = SHEETS_TABS.get("leads", "leads")
        try:
            worksheet = sheets.get_or_create_tab(leads_tab)
            headers = [h.lower() for h in worksheet.row_values(1)]

            required_columns = ["lead_id", "email", "status", "send_eligible", "trade", "city"]
            missing = [col for col in required_columns if col not in headers]

            if missing:
                print(f"  [WARN] Missing columns in leads tab: {missing}")
            else:
                print(f"  [PASS] Leads schema valid ({len(headers)} columns)")

        except Exception as e:
            print(f"  [FAIL] Cannot validate leads schema: {e}")
            all_ok = False

        print("-" * 60)
        print(f"Schema Validation: {'PASSED' if all_ok else 'FAILED'}")

        return all_ok

    except Exception as e:
        print(f"  [FAIL] Cannot connect to sheets: {e}")
        print("-" * 60)
        print("Schema Validation: FAILED")
        return False


def check_pipeline_wiring() -> bool:
    """
    Run a dry-mode pipeline to verify wiring.

    Returns:
        True if pipeline can be instantiated without errors
    """
    print("\n" + "=" * 60)
    print("STEP 3: PIPELINE WIRING CHECK (DRY)")
    print("=" * 60)

    try:
        from src.pipeline_orchestrator import PipelineOrchestrator, PipelineConfig

        # Load config and verify
        config = PipelineConfig.from_env()
        print(f"  [PASS] Config loaded")
        print(f"         target_emails_min: {config.target_emails_min}")
        print(f"         max_iterations: {config.max_iterations}")
        print(f"         max_runtime_seconds: {config.max_runtime_seconds}")
        print(f"         send_enabled: {config.send_enabled}")
        print(f"         pipeline_enabled: {config.pipeline_enabled}")

        # Create orchestrator (doesn't run anything)
        orchestrator = PipelineOrchestrator(config=config)
        print(f"  [PASS] Orchestrator instantiated")

        # Verify task runner can be created
        from src.secrets import run_mandatory_preflight
        preflight = run_mandatory_preflight(
            require_openai=True,
            require_apify=True,
            require_resend=False,
            require_sheets=True,
        )
        print(f"  [PASS] Preflight passed")

        print("-" * 60)
        print("Pipeline Wiring: PASSED")
        return True

    except Exception as e:
        print(f"  [FAIL] Pipeline wiring error: {e}")
        print("-" * 60)
        print("Pipeline Wiring: FAILED")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="CI End-to-End Verification")
    parser.add_argument("--quick", action="store_true", help="Only run secret preflight")
    parser.add_argument("--skip-wiring", action="store_true", help="Skip pipeline wiring check")

    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("YAPMATE LEADS - CI END-TO-END VERIFICATION")
    print("=" * 70)
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Mode: {'QUICK' if args.quick else 'FULL'}")

    all_passed = True

    # Step 1: Secrets
    if not check_secrets():
        all_passed = False
        if args.quick:
            print("\n[RESULT] FAILED - Secret preflight failed")
            sys.exit(1)

    if args.quick:
        print("\n[RESULT] PASSED - Quick check complete")
        sys.exit(0)

    # Step 2: Schema
    if not check_sheets_schema():
        all_passed = False

    # Step 3: Wiring
    if not args.skip_wiring:
        if not check_pipeline_wiring():
            all_passed = False

    # Final result
    print("\n" + "=" * 70)
    if all_passed:
        print("[RESULT] ALL CHECKS PASSED")
        print("=" * 70)
        sys.exit(0)
    else:
        print("[RESULT] SOME CHECKS FAILED")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()
