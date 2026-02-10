#!/usr/bin/env python3
"""
Test script for Sole Trader Mode changes.

Validates the bias fix by checking:
- Sole trader scoring works correctly
- Personal emails are allowed with proper validation
- Corporate names are rejected

Usage:
    python scripts/test_sole_trader_mode.py
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.auto_approve import (
    calculate_sole_trader_score,
    is_corporate_name,
    has_personal_name_pattern,
    passes_sole_trader_validation,
    check_auto_approval,
    FREE_EMAIL_PROVIDERS,
)
from src.config import get_config


def test_corporate_name_detection():
    """Test detection of corporate names."""
    print("\n" + "=" * 60)
    print("TEST: Corporate Name Detection")
    print("=" * 60)

    test_cases = [
        ("ABC Plumbing Ltd", True),
        ("Smith Electrical Limited", True),
        ("Jones Holdings", True),
        ("Acme Group", True),
        ("Dave's Plumbing", False),
        ("John Smith Electrical", False),
        ("Mike the Plumber", False),
        ("A. Jones Roofing", False),
        ("Birmingham Plumbers", False),
    ]

    passed = 0
    for name, expected in test_cases:
        result = is_corporate_name(name)
        status = "PASS" if result == expected else "FAIL"
        if result == expected:
            passed += 1
        print(f"  [{status}] '{name}' -> corporate={result} (expected {expected})")

    print(f"\n  Result: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def test_personal_name_pattern():
    """Test detection of personal name patterns."""
    print("\n" + "=" * 60)
    print("TEST: Personal Name Pattern Detection")
    print("=" * 60)

    test_cases = [
        ("Dave's Plumbing", True),  # Possessive
        ("Mike's Electrical", True),
        ("John Smith Roofing", True),  # First name
        ("A. Jones Building", True),  # Initial pattern
        ("ABC Plumbing", False),
        ("Birmingham Electricians", False),
        ("City Plumbers", False),
    ]

    passed = 0
    for name, expected in test_cases:
        result = has_personal_name_pattern(name)
        status = "PASS" if result == expected else "FAIL"
        if result == expected:
            passed += 1
        print(f"  [{status}] '{name}' -> personal={result} (expected {expected})")

    print(f"\n  Result: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def test_sole_trader_score():
    """Test sole trader scoring."""
    print("\n" + "=" * 60)
    print("TEST: Sole Trader Score Calculation")
    print("=" * 60)

    test_cases = [
        # (name, email, phone, website, reviews, expected_min_score)
        ("Dave's Plumbing", "dave@gmail.com", "07123456789", None, 5, 70),
        ("ABC Plumbing Ltd", "info@abcplumbing.co.uk", "01onal234567", "abcplumbing.co.uk", 150, 0),
        ("John Smith Electrical", "john@btinternet.com", "07987654321", None, 3, 70),
        ("City Plumbers", "info@cityplumbers.co.uk", "0121 000 0000", "cityplumbers.co.uk", 50, 10),
    ]

    passed = 0
    for name, email, phone, website, reviews, expected_min in test_cases:
        score = calculate_sole_trader_score(
            business_name=name,
            email=email,
            phone=phone,
            website=website,
            review_count=reviews,
        )
        status = "PASS" if score >= expected_min else "FAIL"
        if score >= expected_min:
            passed += 1
        print(f"  [{status}] '{name}' -> score={score} (expected >={expected_min})")
        print(f"          email={email}, phone={phone}, reviews={reviews}")

    print(f"\n  Result: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def test_sole_trader_validation():
    """Test sole trader validation for personal emails."""
    print("\n" + "=" * 60)
    print("TEST: Sole Trader Validation for Personal Emails")
    print("=" * 60)

    test_cases = [
        # (name, email, phone, reviews, should_pass)
        ("Dave's Plumbing", "dave@gmail.com", "07123456789", 5, True),
        ("John Smith", "john@btinternet.com", None, 10, True),  # Low reviews
        ("Mike Electrical", "mike@yahoo.co.uk", "07555123456", None, True),  # Mobile
        ("ABC Plumbing Ltd", "info@gmail.com", "07123456789", 5, False),  # Corporate name
        ("Generic Business", "test@outlook.com", "0121 000 0000", 100, False),  # High reviews, no mobile
    ]

    passed = 0
    for name, email, phone, reviews, expected in test_cases:
        passes, reason = passes_sole_trader_validation(
            business_name=name,
            email=email,
            phone=phone,
            review_count=reviews,
        )
        status = "PASS" if passes == expected else "FAIL"
        if passes == expected:
            passed += 1
        print(f"  [{status}] '{name}' -> passes={passes} (expected {expected})")
        print(f"          Reason: {reason}")

    print(f"\n  Result: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def test_check_auto_approval_with_sole_trader_mode():
    """Test full auto-approval with sole trader mode."""
    print("\n" + "=" * 60)
    print("TEST: Full Auto-Approval with Sole Trader Mode")
    print("=" * 60)

    test_cases = [
        # (name, email, phone, reviews, website, should_approve)
        ("Dave's Plumbing", "dave@gmail.com", "07123456789", 5, None, True),
        ("John Smith Electrical", "john@btinternet.com", None, 8, None, True),
        ("ABC Plumbing Ltd", "info@gmail.com", "07123456789", 5, None, False),
        ("Acme Services", "info@acmeservices.co.uk", "0121 000 0000", 200, "acmeservices.co.uk", True),
    ]

    passed = 0
    for name, email, phone, reviews, website, expected in test_cases:
        result = check_auto_approval(
            email=email,
            website=website,
            send_eligible=True,
            business_name=name,
            allow_free_emails=False,
            phone=phone,
            review_count=reviews,
            sole_trader_mode=True,
        )
        status = "PASS" if result.approved == expected else "FAIL"
        if result.approved == expected:
            passed += 1
        print(f"  [{status}] '{name}' -> approved={result.approved} (expected {expected})")
        print(f"          Score: {result.sole_trader_score}, Reason: {result.reason}")

    print(f"\n  Result: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)


def show_config():
    """Show current configuration."""
    print("\n" + "=" * 60)
    print("CURRENT CONFIGURATION")
    print("=" * 60)

    config = get_config()
    print(f"  max_results_per_search: {config.limits.max_results_per_search}")
    print(f"  sole_trader_mode: {config.auto_approve.sole_trader_mode}")
    print(f"  allow_free_emails: {config.auto_approve.allow_free_emails}")
    print(f"  Free email providers: {len(FREE_EMAIL_PROVIDERS)} domains")


def main():
    print("\n" + "=" * 60)
    print("SOLE TRADER MODE - TEST SUITE")
    print("=" * 60)

    show_config()

    all_passed = True
    all_passed &= test_corporate_name_detection()
    all_passed &= test_personal_name_pattern()
    all_passed &= test_sole_trader_score()
    all_passed &= test_sole_trader_validation()
    all_passed &= test_check_auto_approval_with_sole_trader_mode()

    print("\n" + "=" * 60)
    if all_passed:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
    print("=" * 60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
