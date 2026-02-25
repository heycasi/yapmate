"""Email templates for lead outreach.

Strategy:
- Plain text style (looks like a human wrote it, not a marketing blast)
- AI hook is used as the opening line (personalised per lead)
- 3 initial templates rotated randomly
- 2 follow-up templates for sequence (Day 3, Day 7)
- Subject lines are curiosity-driven, not product-focused
"""

import random


# Constants
APP_STORE_URL = "https://www.yapmate.co.uk/app"
LANDING_PAGE_URL = "https://www.yapmate.co.uk/app"
UNSUBSCRIBE_URL = "https://www.yapmate.co.uk/unsubscribe"
BLOG_CIS_URL = "https://www.yapmate.co.uk/blog/cis-deductions-explained"


# =========================================================================
# SUBJECT LINES (rotated independently of body template)
# =========================================================================
# Curiosity-driven, no product name, looks like a person emailing

SUBJECT_LINES = [
    "quick question about your invoicing",
    "do you still do invoices manually?",
    "thought of you when I built this",
    "saves about an hour a day",
    "how do you handle invoices after a long day?",
    "invoicing on the drive home",
    "30 seconds — that's it",
]

FOLLOW_UP_1_SUBJECTS = [
    "did you get a chance to look?",
    "just following up",
    "meant to ask",
]

FOLLOW_UP_2_SUBJECTS = [
    "thought this might help",
    "CIS deductions — quick guide",
    "useful if you're a subbie",
]


# =========================================================================
# INITIAL EMAIL TEMPLATES
# =========================================================================
# {hook} = AI-generated personalised opening line
# {business_name} = lead's business name
# Plain text tone — short, direct, mate-to-mate

TEMPLATES = [
    {
        "paragraphs": [
            "{hook}",
            "I built YapMate — you talk into your phone for 30 seconds, job details and materials, and it spits out a proper invoice. VAT and CIS done automatically.",
            "No typing. No forms. Free for 7 days.",
            "Have a look: {app_url}",
        ],
    },
    {
        "paragraphs": [
            "{hook}",
            "YapMate lets you invoice by voice. Speak your job details in the van and get a formatted PDF back — VAT, CIS, materials, the works. Takes about 30 seconds.",
            "Free trial, no card needed: {app_url}",
        ],
    },
    {
        "paragraphs": [
            "{hook}",
            "Most {trade}s I've spoken to spend their evenings doing invoices. YapMate does them in 30 seconds — you just talk through the job and it handles the rest. VAT, CIS, materials all sorted.",
            "Worth a look if admin's eating your evenings: {app_url}",
        ],
    },
]


# =========================================================================
# FOLLOW-UP TEMPLATES
# =========================================================================

FOLLOW_UP_1_TEMPLATES = [
    {
        "paragraphs": [
            "Dropped you an email a few days ago about YapMate — voice-to-invoice for {trade}s.",
            "No worries if it's not for you. A few {trade}s have started using it this week and the main thing they say is it saves them doing admin at night.",
            "Free to try: {app_url}",
        ],
    },
    {
        "paragraphs": [
            "Quick follow up on my last email.",
            "You talk, it invoices. 30 seconds, done. VAT and CIS handled.",
            "Free to try: {app_url}",
        ],
    },
]

FOLLOW_UP_2_TEMPLATES = [
    {
        "paragraphs": [
            "Last one from me — put together a quick guide on CIS deductions that might be useful if you're a subcontractor.",
            "Covers what you need on your invoices, how the 20% deduction works, and common mistakes: {blog_url}",
            "And if you want to try the voice invoicing: {app_url}",
        ],
    },
    {
        "paragraphs": [
            "Wrote a guide on CIS invoicing a few subbies have found useful — {blog_url}",
            "YapMate's still free to try if the admin's getting to you: {app_url}",
        ],
    },
]


# =========================================================================
# TEMPLATE SELECTION
# =========================================================================

def _pick_template(templates=None):
    """Pick a random template from the pool."""
    return random.choice(templates or TEMPLATES)


def _pick_subject(subjects=None):
    """Pick a random subject line."""
    return random.choice(subjects or SUBJECT_LINES)


# =========================================================================
# PLAIN TEXT EMAIL (primary format)
# =========================================================================

def _build_plain_text(business_name, paragraphs, hook="", trade=""):
    """Build plain text email body."""
    body_parts = []
    for p in paragraphs:
        formatted = p.format(
            hook=hook,
            business_name=business_name,
            trade=trade or "tradesperson",
            landing_url=LANDING_PAGE_URL,
            blog_url=BLOG_CIS_URL,
            app_url=APP_STORE_URL,
        )
        body_parts.append(formatted)

    body = "\n\n".join(body_parts)

    # Use first name if business_name looks like a person's name
    greeting_name = business_name

    return f"""Hi {greeting_name},

{body}

Cheers,
Connor

—
Try YapMate free: {APP_STORE_URL}

Unsubscribe: {UNSUBSCRIBE_URL}"""


# =========================================================================
# MINIMAL HTML EMAIL (looks like plain text, not a marketing blast)
# =========================================================================

def _build_html(business_name, paragraphs, hook="", trade=""):
    """Build minimal HTML email that looks like plain text."""
    body_parts = []
    for p in paragraphs:
        formatted = p.format(
            hook=hook,
            business_name=business_name,
            trade=trade or "tradesperson",
            landing_url=LANDING_PAGE_URL,
            blog_url=BLOG_CIS_URL,
            app_url=APP_STORE_URL,
        )
        # Convert URLs to links
        for url in [LANDING_PAGE_URL, BLOG_CIS_URL, APP_STORE_URL]:
            if url in formatted:
                formatted = formatted.replace(url, f'<a href="{url}" style="color:#0066cc">{url}</a>')
        body_parts.append(f'<p style="margin:0 0 16px;color:#1a1a1a;font-size:15px;line-height:1.6;">{formatted}</p>')

    paragraphs_html = "\n".join(body_parts)

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px;">

<p style="margin:0 0 16px;color:#1a1a1a;font-size:15px;line-height:1.6;">Hi {business_name},</p>

{paragraphs_html}

<p style="margin:0 0 16px;color:#1a1a1a;font-size:15px;line-height:1.6;">
Cheers,<br>Connor
</p>

<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;color:#999;font-size:12px;">
Try YapMate free: <a href="{APP_STORE_URL}" style="color:#0066cc">{APP_STORE_URL}</a><br>
<a href="{UNSUBSCRIBE_URL}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
</p>

</div>
</body>
</html>"""


# =========================================================================
# PUBLIC API
# =========================================================================

def generate_email_content(business_name, hook="", trade=""):
    """
    Generate a complete email (subject, HTML, plain text) from one template.

    Args:
        business_name: Lead's business name
        hook: AI-generated personalised opening line
        trade: Lead's trade type (for follow-ups)

    Returns:
        Tuple of (subject, html_body, text_body)
    """
    tpl = _pick_template(TEMPLATES)
    subject = _pick_subject(SUBJECT_LINES)
    return (
        subject,
        _build_html(business_name, tpl["paragraphs"], hook=hook, trade=trade),
        _build_plain_text(business_name, tpl["paragraphs"], hook=hook, trade=trade),
    )


def generate_followup1_content(business_name, trade=""):
    """Generate follow-up 1 email (Day 3)."""
    tpl = _pick_template(FOLLOW_UP_1_TEMPLATES)
    subject = _pick_subject(FOLLOW_UP_1_SUBJECTS)
    return (
        subject,
        _build_html(business_name, tpl["paragraphs"], trade=trade),
        _build_plain_text(business_name, tpl["paragraphs"], trade=trade),
    )


def generate_followup2_content(business_name, trade=""):
    """Generate follow-up 2 email (Day 7) — includes blog CTA."""
    tpl = _pick_template(FOLLOW_UP_2_TEMPLATES)
    subject = _pick_subject(FOLLOW_UP_2_SUBJECTS)
    return (
        subject,
        _build_html(business_name, tpl["paragraphs"], trade=trade),
        _build_plain_text(business_name, tpl["paragraphs"], trade=trade),
    )


# =========================================================================
# BACKWARDS COMPATIBILITY (old API still works)
# =========================================================================

def generate_email_html(business_name, hook="", trade="", image_url=None, _template=None):
    """Generate HTML email body."""
    tpl = _template or _pick_template(TEMPLATES)
    return _build_html(business_name, tpl["paragraphs"], hook=hook, trade=trade)


def generate_email_text(business_name, hook="", trade="", _template=None):
    """Generate plain text email body."""
    tpl = _template or _pick_template(TEMPLATES)
    return _build_plain_text(business_name, tpl["paragraphs"], hook=hook, trade=trade)


def generate_email_subject(business_name="", trade="", _template=None):
    """Generate email subject line."""
    return _pick_subject(SUBJECT_LINES)
