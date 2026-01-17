"""Email HTML templates for lead outreach."""

import random


# Constants
APP_STORE_URL = "https://apps.apple.com/gb/app/yapmate/id6756750891"
UNSUBSCRIBE_URL = "https://www.yapmate.co.uk/unsubscribe"
LOGO_URL = "https://www.yapmate.co.uk/email/yapmate-logo.png"
APPSTORE_BADGE_URL = "https://www.yapmate.co.uk/email/appstore-badge.png"
INVOICE_IMAGE_URL = "https://www.yapmate.co.uk/invoice-showcase.png"


def generate_email_html(
    business_name: str,
    hook: str,
    trade: str,
    image_url: str = None  # Kept for backwards compatibility, not used
) -> str:
    """
    Generate personalized email HTML (Outlook-safe)

    Args:
        business_name: Lead's business name
        hook: AI-generated hook sentence
        trade: Trade type (Plumber, Electrician, etc.)
        image_url: Deprecated, kept for backwards compatibility

    Returns:
        HTML email content
    """

    # Trade-specific context
    trade_context = {
        "Plumber": "boiler parts",
        "Electrician": "wiring",
        "Builder": "materials",
        "Heating Engineer": "boiler parts",
        "Gas Engineer": "boiler parts",
        "Sparky": "wiring",
        "Carpenter": "timber",
        "Joiner": "timber",
        "Roofer": "roofing materials",
        "Plasterer": "plaster",
        "Painter": "paint",
        "Decorator": "materials"
    }

    materials = trade_context.get(trade, "materials")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YapMate</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 30px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto;">

                    <!-- Logo Header -->
                    <tr>
                        <td style="padding: 20px 0 30px 0; text-align: center; background-color: #ffffff;">
                            <a href="{APP_STORE_URL}" style="text-decoration: none; display: inline-block; background-color: #ffffff; padding: 20px 40px; border-radius: 12px;">
                                <img src="{LOGO_URL}"
                                     alt="YapMate"
                                     height="180"
                                     style="display: block; height: 180px; width: auto; border: 0;">
                            </a>
                        </td>
                    </tr>

                    <!-- Email Body -->
                    <tr>
                        <td style="padding: 0;">

                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                Hi {business_name},
                            </p>

                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                {hook}
                            </p>

                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                We built YapMate for trades who want invoices done without the admin.
                            </p>

                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                Just talk through the job (labour, {materials}) and YapMate builds a clean PDF invoice instantly.
                            </p>

                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                Handles labour, materials, VAT, CIS and Reverse Charge properly.
                            </p>

                            <p style="margin: 0 0 30px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                No typing. No forms.
                            </p>

                        </td>
                    </tr>

                    <!-- CTA Section -->
                    <tr>
                        <td style="padding: 0 0 30px 0; text-align: center;">
                            <p style="margin: 0 0 12px; color: #1a1a1a; font-size: 16px; font-weight: 500;">
                                Download YapMate on the App Store
                            </p>
                            <a href="{APP_STORE_URL}" style="text-decoration: none; display: inline-block;">
                                <img src="{APPSTORE_BADGE_URL}"
                                     alt="Download on the App Store"
                                     height="40"
                                     style="display: block; height: 40px; width: auto; border: 0;">
                            </a>
                            <p style="margin: 10px 0 0; font-size: 13px; color: #666666;">
                                <a href="{APP_STORE_URL}" style="color: #0066cc; text-decoration: none;">{APP_STORE_URL}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Invoice Screenshot -->
                    <tr>
                        <td style="padding: 0 0 30px 0;">
                            <a href="{APP_STORE_URL}" style="display: block; text-decoration: none;">
                                <img src="{INVOICE_IMAGE_URL}"
                                     alt="YapMate invoice example"
                                     width="600"
                                     style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;">
                            </a>
                        </td>
                    </tr>

                    <!-- Signoff -->
                    <tr>
                        <td style="padding: 0;">
                            <p style="margin: 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                Cheers,<br>
                                Connor
                            </p>
                        </td>
                    </tr>

                    <!-- Unsubscribe -->
                    <tr>
                        <td style="padding: 30px 0 0 0;">
                            <p style="margin: 0; text-align: center; color: #999999; font-size: 12px;">
                                <a href="{UNSUBSCRIBE_URL}" style="color: #999999; text-decoration: underline;">Unsubscribe</a>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

    return html


def generate_email_text(
    business_name: str,
    hook: str,
    trade: str
) -> str:
    """
    Generate plain-text version of email (for deliverability)

    Args:
        business_name: Lead's business name
        hook: AI-generated hook sentence
        trade: Trade type

    Returns:
        Plain text email content
    """

    trade_context = {
        "Plumber": "boiler parts",
        "Electrician": "wiring",
        "Builder": "materials",
        "Heating Engineer": "boiler parts",
        "Gas Engineer": "boiler parts",
        "Sparky": "wiring",
        "Carpenter": "timber",
        "Joiner": "timber",
        "Roofer": "roofing materials",
        "Plasterer": "plaster",
        "Painter": "paint",
        "Decorator": "materials"
    }

    materials = trade_context.get(trade, "materials")

    text = f"""Hi {business_name},

{hook}

We built YapMate for trades who want invoices done without the admin.

Just talk through the job (labour, {materials}) and YapMate builds a clean PDF invoice instantly.

Handles labour, materials, VAT, CIS and Reverse Charge properly.

No typing. No forms.

Download YapMate on the App Store:
{APP_STORE_URL}

Cheers,
Connor

---

Unsubscribe: {UNSUBSCRIBE_URL}
"""

    return text


def generate_email_subject(business_name: str, trade: str) -> str:
    """
    Generate email subject line

    Args:
        business_name: Lead's business name (not used)
        trade: Trade type (not used)

    Returns:
        Email subject (randomly selected from 4 options)
    """
    subject_lines = [
        "Stop doing invoices at 9pm",
        "Invoices done before you leave site",
        "Talk the job. Invoice done.",
        "Still typing invoices at night?"
    ]

    return random.choice(subject_lines)
