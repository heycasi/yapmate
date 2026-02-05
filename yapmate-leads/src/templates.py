"""Email templates for lead outreach.

3 fixed templates rotated randomly. No trade-specific wording.
Each template has its own subject line, HTML body, and plain text body.
"""

import random


# Constants
# Use yapmate.co.uk/app redirect for better deliverability (links match sending domain)
# This redirects to: https://apps.apple.com/gb/app/yapmate/id6756750891
APP_STORE_URL = "https://www.yapmate.co.uk/app"
UNSUBSCRIBE_URL = "https://www.yapmate.co.uk/unsubscribe"
LOGO_URL = "https://www.yapmate.co.uk/email/yapmate-logo.png"
APPSTORE_BADGE_URL = "https://www.yapmate.co.uk/email/appstore-badge.png"
INVOICE_IMAGE_URL = "https://www.yapmate.co.uk/invoice-showcase.png"


# =========================================================================
# TEMPLATE DEFINITIONS
# =========================================================================
# Each template is a dict with: subject, body_paragraphs (list of strings)
# body_paragraphs use {business_name} placeholder only.

TEMPLATES = [
    {
        # Template 1: Story + simple use case
        "subject": "Built for tradies who work by voice",
        "paragraphs": [
            "I built YapMate after watching my uncle run his whole business by voice notes while my auntie ended up doing his invoices on her phone at night. I built it for him first, then realised it could help other tradies \u2014 that\u2019s how YapMate started.",
            "With YapMate, you speak the job and it turns that into a proper invoice automatically (labour, materials, VAT, CIS where relevant). No forms. No typing.",
            "If you want to try it, there\u2019s a 7-day free trial so you can test it properly.",
        ],
    },
    {
        # Template 3: Problem-first, generic
        "subject": "Less paperwork, same work done",
        "paragraphs": [
            "A lot of people in trades lose time to paperwork \u2014 especially invoicing.",
            "YapMate lets you talk through a job and get a proper invoice straight away, without typing everything out. It handles materials, labour, VAT and CIS correctly.",
            "I built it originally for a family member who worked mostly by voice. You can test it with a 7-day free trial.",
        ],
    },
    {
        # Template 5: Benefit-led, clean
        "subject": "Faster invoices without admin",
        "paragraphs": [
            "YapMate converts your spoken job details into a proper invoice instantly \u2014 including materials, labour, VAT and CIS where needed.",
            "No forms. No manual data entry.",
            "You can test it on a 7-day free trial.",
        ],
    },
]


def _pick_template() -> dict:
    """Pick a random template from the pool."""
    return random.choice(TEMPLATES)


# =========================================================================
# HTML EMAIL WRAPPER
# =========================================================================

def _wrap_html(business_name: str, body_paragraphs: list) -> str:
    """
    Wrap body paragraphs in the standard HTML email layout.

    Outlook-safe table-based layout with logo header, App Store CTA,
    invoice screenshot, and unsubscribe footer.
    """
    # Build paragraph HTML
    paragraphs_html = ""
    for p in body_paragraphs:
        paragraphs_html += f"""
                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                {p}
                            </p>"""

    return f"""<!DOCTYPE html>
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
                        <td style="padding: 30px 0 40px 0; text-align: center;">
                            <table role="presentation" style="margin: 0 auto; border-collapse: collapse;">
                                <tr>
                                    <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 30px 40px; border-radius: 12px; text-align: center;">
                                        <a href="{APP_STORE_URL}" style="text-decoration: none; display: inline-block;">
                                            <img src="{LOGO_URL}"
                                                 alt="YapMate"
                                                 style="display: block; max-width: 400px; width: 100%; height: auto; border: 0;">
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Email Body -->
                    <tr>
                        <td style="padding: 0;">

                            <p style="margin: 0 0 20px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                                Hi {business_name},
                            </p>
{paragraphs_html}
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
                                Connor<br>
                                YapMate
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


# =========================================================================
# PLAIN TEXT EMAIL WRAPPER
# =========================================================================

def _wrap_text(business_name: str, body_paragraphs: list) -> str:
    """Wrap body paragraphs in plain text email format."""
    body = "\n\n".join(body_paragraphs)
    return f"""Hi {business_name},

{body}

Connor
YapMate

Download YapMate on the App Store:
{APP_STORE_URL}

---

Unsubscribe: {UNSUBSCRIBE_URL}
"""


# =========================================================================
# PUBLIC API (same signatures as before for backwards compatibility)
# =========================================================================

def generate_email_html(
    business_name: str,
    hook: str = "",
    trade: str = "",
    image_url: str = None,
    _template: dict = None,
) -> str:
    """
    Generate HTML email from a randomly selected template.

    Args:
        business_name: Lead's business name
        hook: Ignored (kept for backwards compatibility)
        trade: Ignored (kept for backwards compatibility)
        image_url: Ignored (kept for backwards compatibility)
        _template: Internal - pre-selected template (used to keep
                   HTML/text/subject in sync for the same email)

    Returns:
        HTML email content
    """
    tpl = _template or _pick_template()
    return _wrap_html(business_name, tpl["paragraphs"])


def generate_email_text(
    business_name: str,
    hook: str = "",
    trade: str = "",
    _template: dict = None,
) -> str:
    """
    Generate plain-text email from a randomly selected template.

    Args:
        business_name: Lead's business name
        hook: Ignored (kept for backwards compatibility)
        trade: Ignored (kept for backwards compatibility)
        _template: Internal - pre-selected template

    Returns:
        Plain text email content
    """
    tpl = _template or _pick_template()
    return _wrap_text(business_name, tpl["paragraphs"])


def generate_email_subject(
    business_name: str = "",
    trade: str = "",
    _template: dict = None,
) -> str:
    """
    Generate email subject line from a randomly selected template.

    Args:
        business_name: Ignored (kept for backwards compatibility)
        trade: Ignored (kept for backwards compatibility)
        _template: Internal - pre-selected template

    Returns:
        Email subject line
    """
    tpl = _template or _pick_template()
    return tpl["subject"]


def generate_email_content(business_name: str) -> tuple:
    """
    Generate a complete email (subject, HTML, plain text) from one template.

    This ensures the subject, HTML body, and plain text body all come from
    the same randomly selected template.

    Args:
        business_name: Lead's business name

    Returns:
        Tuple of (subject, html_body, text_body)
    """
    tpl = _pick_template()
    return (
        tpl["subject"],
        _wrap_html(business_name, tpl["paragraphs"]),
        _wrap_text(business_name, tpl["paragraphs"]),
    )
