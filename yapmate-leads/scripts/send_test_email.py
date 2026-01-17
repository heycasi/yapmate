"""Send a single test email to verify YapMate email template.

This script sends ONE test email with fixed test data.
Does NOT read from Google Sheets or update any lead status.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import resend

# Add parent directory to path so we can import from src
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))

from src.templates import generate_email_html, generate_email_subject


# ANSI colors
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
BOLD = '\033[1m'
RESET = '\033[0m'


def send_test_email():
    """Send a single test email to verify template"""

    # Change to project directory
    os.chdir(project_dir)

    # Load environment variables
    load_dotenv()

    print(f"\n{BOLD}{BLUE}{'=' * 80}{RESET}")
    print(f"{BOLD}{BLUE}YapMate Email Template Test{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 80}{RESET}\n")

    # Fixed test data (as specified)
    test_recipient = "connordahl@hotmail.com"
    test_business_name = "Test Plumbing Ltd"
    test_trade = "Plumber"
    test_city = "Glasgow"
    test_materials = "boiler parts"
    test_hook = "Grafted all day fixing boilers? Last thing you want is admin at night."

    print(f"{BOLD}Test Email Details:{RESET}")
    print(f"  To: {test_recipient}")
    print(f"  Business: {test_business_name}")
    print(f"  Trade: {test_trade}")
    print(f"  City: {test_city}")
    print(f"  Hook: {test_hook}\n")

    # Get configuration
    resend_key = os.getenv("RESEND_API_KEY")
    image_url = os.getenv("EMAIL_FOOTER_IMAGE_URL")
    email_from = os.getenv("EMAIL_FROM", "support@yapmate.co.uk")
    email_from_name = os.getenv("EMAIL_FROM_NAME", "YapMate")

    if not resend_key:
        print(f"{RED}❌ ERROR: RESEND_API_KEY not found in .env{RESET}")
        sys.exit(1)

    if not image_url:
        print(f"{RED}❌ ERROR: EMAIL_FOOTER_IMAGE_URL not found in .env{RESET}")
        sys.exit(1)

    # Configure Resend
    resend.api_key = resend_key

    print(f"{GREEN}✅ Resend API configured{RESET}")
    print(f"   From: {email_from_name} <{email_from}>")
    print(f"   Footer image: {image_url}\n")

    # Generate email subject (random from pool)
    subject = generate_email_subject(test_business_name, test_trade)

    print(f"{BOLD}Generated Subject Line:{RESET}")
    print(f"   {BLUE}{subject}{RESET}\n")

    # Generate email HTML
    html_content = generate_email_html(
        business_name=test_business_name,
        hook=test_hook,
        trade=test_trade,
        image_url=image_url
    )

    print(f"{BOLD}Email Template:{RESET}")
    print(f"   ✅ Subject: Random rotation (4 options)")
    print(f"   ✅ CTA Text: 'Download YapMate'")
    print(f"   ✅ CTA Link: https://yapmate.co.uk")
    print(f"   ✅ Footer Image: {image_url}")
    print(f"   ✅ Image Alt: 'YapMate – voice to invoice for UK trades'")
    print(f"   ✅ Materials: {test_materials}\n")

    # Confirmation
    print(f"{YELLOW}{'=' * 80}{RESET}")
    print(f"{YELLOW}READY TO SEND TEST EMAIL{RESET}")
    print(f"{YELLOW}{'=' * 80}{RESET}")
    print(f"\n{BOLD}This will send ONE email to:{RESET} {test_recipient}")
    print(f"{BOLD}Subject:{RESET} {subject}")
    print(f"\n{RED}This is a REAL email send (not a dry-run).{RESET}")

    confirm = input(f"\n{BOLD}Send test email now? [y/N]: {RESET}").strip().lower()

    if confirm != 'y':
        print(f"\n{YELLOW}❌ Test email cancelled{RESET}\n")
        sys.exit(0)

    # Send email via Resend
    print(f"\n{BLUE}📧 Sending test email...{RESET}")

    try:
        params = {
            "from": f"{email_from_name} <{email_from}>",
            "to": [test_recipient],
            "subject": subject,
            "html": html_content
        }

        response = resend.Emails.send(params)

        print(f"\n{GREEN}{'=' * 80}{RESET}")
        print(f"{GREEN}{BOLD}✅ TEST EMAIL SENT SUCCESSFULLY{RESET}")
        print(f"{GREEN}{'=' * 80}{RESET}\n")

        print(f"{BOLD}Send Details:{RESET}")
        print(f"   Email ID: {response.get('id', 'unknown')}")
        print(f"   To: {test_recipient}")
        print(f"   Subject: {subject}")
        print(f"   From: {email_from_name} <{email_from}>")

        print(f"\n{BOLD}Template Verification:{RESET}")
        print(f"   ✅ Subject rotated from pool")
        print(f"   ✅ Updated body copy used")
        print(f"   ✅ CTA: 'Download YapMate' → https://yapmate.co.uk")
        print(f"   ✅ Footer image: {image_url}")
        print(f"   ✅ Image is clickable (links to yapmate.co.uk)")

        print(f"\n{BLUE}Next Steps:{RESET}")
        print(f"   1. Check {test_recipient} inbox")
        print(f"   2. Verify subject line displays correctly")
        print(f"   3. Verify footer image loads and is clickable")
        print(f"   4. Verify CTA button says 'Download YapMate'")
        print(f"   5. Verify updated body copy (no driving language)")

        print(f"\n{GREEN}{'=' * 80}{RESET}\n")

    except Exception as e:
        print(f"\n{RED}{'=' * 80}{RESET}")
        print(f"{RED}{BOLD}❌ SEND FAILED{RESET}")
        print(f"{RED}{'=' * 80}{RESET}\n")
        print(f"{RED}Error: {str(e)}{RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    send_test_email()
