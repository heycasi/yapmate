"""Email HTML templates for lead outreach."""

import random


# Constants
APP_STORE_URL = "https://apps.apple.com/gb/app/yapmate/id6756750891"
UNSUBSCRIBE_URL = "https://www.yapmate.co.uk/unsubscribe"
LOGO_URL = "https://www.yapmate.co.uk/email/yapmate-logo.png"
APPSTORE_BADGE_URL = "https://www.yapmate.co.uk/email/appstore-badge.png"
IOS_ICON_URL = "https://www.yapmate.co.uk/email/yapmate-ios-icon.png"
FOOTER_IMAGE_URL = "https://www.yapmate.co.uk/invoice-showcase.png"


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
    <title>YapMate - Voice to Invoice</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
        <tr>
            <td style="padding: 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">

                    <!-- Header with Centered Logo -->
                    <tr>
                        <td style="padding: 22px 30px 10px 30px; text-align: center;">
                            <a href="{APP_STORE_URL}" style="text-decoration: none;">
                                <img src="{LOGO_URL}"
                                     alt="YapMate"
                                     height="56"
                                     width="auto"
                                     style="display: inline-block; border: 0; outline: none; text-decoration: none; height: 56px; width: auto;">
                            </a>
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 30px 30px 40px 30px;">

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Hi {business_name},
                            </p>

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                {hook}
                            </p>

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                We built YapMate for trades who want invoices done without the admin.
                            </p>

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Just talk through the job (labour, {materials}) and YapMate builds a clean PDF invoice instantly.
                            </p>

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Handles labour, materials, VAT, CIS and Reverse Charge properly.
                            </p>

                            <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                                No typing. No forms.
                            </p>

                            <!-- Branded CTA Block -->
                            <table role="presentation" style="margin: 0 0 20px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="margin: 0 0 12px; color: #374151; font-size: 16px; font-weight: 600;">
                                            Click here to download
                                        </p>
                                        <a href="{APP_STORE_URL}" style="text-decoration: none; display: inline-block;">
                                            <table role="presentation" style="border-collapse: collapse; margin: 0 auto;">
                                                <tr>
                                                    <td style="padding-right: 10px; vertical-align: middle;">
                                                        <img src="{IOS_ICON_URL}"
                                                             alt="YapMate iOS"
                                                             height="44"
                                                             width="44"
                                                             style="display: block; border: 0; outline: none; text-decoration: none; height: 44px; width: 44px; border-radius: 8px;">
                                                    </td>
                                                    <td style="vertical-align: middle;">
                                                        <img src="{APPSTORE_BADGE_URL}"
                                                             alt="Download on the App Store"
                                                             height="44"
                                                             width="auto"
                                                             style="display: block; border: 0; outline: none; text-decoration: none; height: 44px; width: auto;">
                                                    </td>
                                                </tr>
                                            </table>
                                        </a>
                                        <p style="margin: 10px 0 0; font-size: 12px; color: #9CA3AF;">
                                            App Store: <a href="{APP_STORE_URL}" style="color: #9CA3AF; text-decoration: underline;">{APP_STORE_URL}</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- Invoice Showcase Image (Moved Up) -->
                    <tr>
                        <td style="padding: 0;">
                            <a href="{APP_STORE_URL}" style="display: block; text-decoration: none;">
                                <img src="{FOOTER_IMAGE_URL}"
                                     alt="YapMate – voice to invoice for UK trades"
                                     width="600"
                                     style="width: 100%; max-width: 600px; height: auto; display: block; border: 0; outline: none; text-decoration: none;">
                            </a>
                        </td>
                    </tr>

                    <!-- Fallback + Signoff -->
                    <tr>
                        <td style="padding: 20px 30px 30px 30px;">
                            <p style="margin: 0 0 20px; font-size: 12px; color: #9CA3AF; text-align: center;">
                                Trouble seeing the screenshot? <a href="{FOOTER_IMAGE_URL}" style="color: #9CA3AF; text-decoration: underline;">View it here</a>
                            </p>

                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Reply if you've got any questions.
                            </p>

                            <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Cheers,<br>
                                Connor
                            </p>

                        </td>
                    </tr>

                </table>

                <!-- Unsubscribe -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0;">
                    <tr>
                        <td style="text-align: center; color: #9CA3AF; font-size: 12px;">
                            <a href="{UNSUBSCRIBE_URL}" style="color: #9CA3AF; text-decoration: underline;">Unsubscribe</a> | YapMate | Built for tradies, by tradies
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

Download YapMate:
{APP_STORE_URL}

Reply if you've got any questions.

Cheers,
Connor

---

View invoice screenshot: {FOOTER_IMAGE_URL}

Unsubscribe: {UNSUBSCRIBE_URL}
YapMate | Built for tradies, by tradies
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
