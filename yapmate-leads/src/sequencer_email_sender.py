"""Email Sender for City-Trade Sequencing Engine.

This module handles email sending with:
- SEND_ENABLED gate (fail-closed)
- Email sanitization pipeline
- Daily limits enforced at sender level
- Warm-up ramp to gradually increase sending volume
- Safety checks based on bounce/complaint rates
- Integration with Resend API
- Status updates to Google Sheets
- Structured logging for each lead
"""

import os
import time
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

import resend
from dotenv import load_dotenv

from src.sequencer_config import DEFAULT_EMAIL_SENDER_CONFIG, EmailSenderConfig
from src.sequencer_models import EnhancedLead, RunnerState
from src.sequencer_sheets import SequencerSheetsManager
from src.sequencer_alerts import alert_sending_paused, alert_sender_error
from src.email_sanitizer import sanitize_email, SanitizationResult
from src.config import get_config


# =============================================================================
# STRUCTURED LOGGING
# =============================================================================

class SendStatus(Enum):
    """Status of a send operation."""
    SENT = "SENT"
    BLOCKED = "BLOCKED"
    INVALID = "INVALID"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


@dataclass
class StructuredLog:
    """Structured log entry for each lead."""
    lead_id: str
    status: SendStatus
    reason: str
    email_original: str
    email_sanitized: Optional[str]
    business_name: str
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lead_id": self.lead_id,
            "status": self.status.value,
            "reason": self.reason,
            "email_original": self.email_original,
            "email_sanitized": self.email_sanitized,
            "business_name": self.business_name,
            "timestamp": self.timestamp,
        }

    def log(self) -> None:
        """Print structured log entry."""
        print(f"  STATUS: {self.status.value}")
        print(f"  REASON: {self.reason}")
        print(f"  EMAIL_ORIGINAL: {self.email_original}")
        print(f"  EMAIL_SANITIZED: {self.email_sanitized or 'N/A'}")
        print(f"  BUSINESS: {self.business_name}")
        print(f"  TIMESTAMP: {self.timestamp}")
        print("-" * 40)


@dataclass
class SendResult:
    """Result of an email send attempt."""

    lead_id: str
    success: bool
    status: SendStatus = SendStatus.FAILED
    email_id: Optional[str] = None  # Resend email ID
    error: Optional[str] = None
    email_original: Optional[str] = None
    email_sanitized: Optional[str] = None


@dataclass
class SendBatchResult:
    """Result of a batch send operation."""

    total_attempted: int
    total_sent: int
    total_failed: int
    total_blocked: int
    total_invalid: int
    total_sanitized: int
    results: List[SendResult]
    logs: List[StructuredLog]
    stopped_reason: Optional[str] = None  # Why sending stopped (if not all sent)


class SequencerEmailSender:
    """
    Email sender with warm-up ramp and safety checks.

    Safety thresholds (based on lookback window):
    - Bounce rate > 10%: Pause sending
    - Complaint rate > 0.1%: Pause sending

    Opens and clicks are tracked for informational purposes only.
    """

    def __init__(
        self,
        sheets: SequencerSheetsManager,
        config: EmailSenderConfig = None
    ):
        """
        Initialize the email sender.

        Args:
            sheets: Sheets manager instance
            config: Email sender configuration
        """
        self.sheets = sheets
        self.config = config or DEFAULT_EMAIL_SENDER_CONFIG

        # Load environment
        load_dotenv()

        # Initialize Resend - strip whitespace to handle secrets with trailing newlines
        resend_key = os.getenv("RESEND_API_KEY", "").strip()
        if not resend_key:
            raise ValueError("RESEND_API_KEY not found in environment")

        resend.api_key = resend_key

        # Get email configuration from env (with fallbacks from config)
        # Use 'or' to handle empty strings from GitHub Actions when secrets aren't set
        self.from_email = os.getenv("EMAIL_FROM") or self.config.from_email
        self.from_name = os.getenv("EMAIL_FROM_NAME") or self.config.from_name
        self.reply_to = os.getenv("EMAIL_REPLY_TO") or self.config.reply_to
        self.footer_image_url = os.getenv("EMAIL_FOOTER_IMAGE_URL", "")

    # =========================================================================
    # DAILY LIMIT CALCULATION
    # =========================================================================

    def calculate_daily_limit(self) -> int:
        """
        Calculate today's daily sending limit.

        If warm-up is enabled, limit increases gradually from
        warmup_start_daily_limit to warmup_max_daily_limit.

        Returns:
            Maximum emails allowed today
        """
        if not self.config.warmup_enabled:
            return self.config.daily_limit

        # Check if warm-up has started
        if not self.config.warmup_start_date:
            # Warm-up not started, use base limit
            return self.config.warmup_start_daily_limit

        try:
            start_date = datetime.strptime(self.config.warmup_start_date, "%Y-%m-%d")
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            days_since_start = (today - start_date).days

            if days_since_start < 0:
                # Warm-up hasn't started yet
                return self.config.warmup_start_daily_limit

            # Calculate ramped limit
            ramped_limit = (
                self.config.warmup_start_daily_limit +
                (days_since_start * self.config.warmup_increment_per_day)
            )

            # Cap at maximum
            return min(ramped_limit, self.config.warmup_max_daily_limit)

        except ValueError:
            # Invalid date format, use base limit
            return self.config.daily_limit

    def get_remaining_daily_quota(self) -> int:
        """
        Get remaining emails that can be sent today.

        Counts actual SENT leads with today's date from the sheet
        for accurate tracking (not relying on a state counter).

        Returns:
            Number of emails remaining in today's quota
        """
        daily_limit = self.calculate_daily_limit()

        # Count actual emails sent today from the leads sheet
        sent_today = self._count_emails_sent_today()
        print(f"    Sent today (from sheet): {sent_today}")

        return max(0, daily_limit - sent_today)

    def _count_emails_sent_today(self) -> int:
        """Count actual SENT leads with today's sent_at date from the sheet."""
        try:
            all_rows = self.sheets.get_leads_tab().get_all_values()
            if not all_rows or len(all_rows) < 2:
                return 0

            headers = all_rows[0]
            col_status = headers.index("status") if "status" in headers else None
            col_sent_at = headers.index("sent_at") if "sent_at" in headers else None

            if col_status is None:
                return 0

            today = datetime.utcnow().strftime("%Y-%m-%d")
            count = 0

            for row in all_rows[1:]:
                if len(row) <= col_status:
                    continue
                status = str(row[col_status]).strip().upper()
                if status != "SENT":
                    continue

                # Check sent_at date if available
                if col_sent_at and len(row) > col_sent_at:
                    sent_at = str(row[col_sent_at]).strip()
                    if sent_at and sent_at.startswith(today):
                        count += 1
                    elif not sent_at:
                        # No sent_at date, count it conservatively
                        count += 1
                else:
                    # No sent_at column accessible, count it
                    count += 1

            return count
        except Exception as e:
            print(f"    Warning: Could not count sent today: {e}")
            return 0

    def increment_send_counter(self, count: int = 1):
        """
        Increment the daily send counter.

        Args:
            count: Number to increment by
        """
        state = self.sheets.get_runner_state()
        today = datetime.now().strftime("%Y-%m-%d")

        # Reset counter if from different day
        if state.focus_trade_date != today:
            state.emails_sent_today = count
        else:
            state.emails_sent_today += count

        # Also update the date (to track which day the counter is for)
        state.focus_trade_date = today
        state.last_run_at = datetime.utcnow()

        self.sheets.save_runner_state(state)

    # =========================================================================
    # SAFETY CHECKS
    # =========================================================================

    def check_safety_thresholds(self) -> tuple[bool, Optional[str]]:
        """
        Check if sending should be paused due to safety thresholds.

        Returns:
            Tuple of (is_safe_to_send, pause_reason)
        """
        metrics = self.sheets.get_safety_metrics(
            lookback_days=self.config.safety_lookback_days
        )

        # Check bounce rate
        if metrics["bounce_rate"] > self.config.max_bounce_rate:
            reason = f"Bounce rate {metrics['bounce_rate']:.1%} exceeds threshold {self.config.max_bounce_rate:.1%}"
            return (False, reason)

        # Check complaint rate
        if metrics["complaint_rate"] > self.config.max_complaint_rate:
            reason = f"Complaint rate {metrics['complaint_rate']:.3%} exceeds threshold {self.config.max_complaint_rate:.3%}"
            return (False, reason)

        return (True, None)

    def pause_sending(self, reason: str):
        """
        Pause sending and update state.

        Args:
            reason: Why sending is being paused
        """
        state = self.sheets.get_runner_state()
        state.sending_paused = True
        state.pause_reason = reason
        self.sheets.save_runner_state(state)
        print(f"\nSENDING PAUSED: {reason}")

        # Send alert
        metrics = self.sheets.get_safety_metrics(
            lookback_days=self.config.safety_lookback_days
        )
        alert_sending_paused(
            bounce_rate=metrics["bounce_rate"],
            complaint_rate=metrics["complaint_rate"],
            total_sent=metrics["total_sent"],
            bounce_threshold=self.config.max_bounce_rate,
            complaint_threshold=self.config.max_complaint_rate,
            pause_reason=reason,
            sheets_manager=self.sheets
        )

    def resume_sending(self):
        """Resume sending if previously paused."""
        state = self.sheets.get_runner_state()
        if state.sending_paused:
            state.sending_paused = False
            state.pause_reason = None
            self.sheets.save_runner_state(state)
            print("\nSending resumed")

    # =========================================================================
    # EMAIL GENERATION
    # =========================================================================

    def generate_subject(self, lead: EnhancedLead) -> str:
        """
        Generate email subject line.

        Args:
            lead: Lead to generate subject for

        Returns:
            Subject line
        """
        # Import from existing templates module if available
        try:
            from src.templates import generate_email_subject
            return generate_email_subject(lead.business_name, lead.trade)
        except ImportError:
            # Fallback
            return f"Invoice software for {lead.trade}s - YapMate"

    def generate_html_body(self, lead: EnhancedLead) -> str:
        """
        Generate HTML email body.

        Args:
            lead: Lead to generate email for

        Returns:
            HTML email body
        """
        try:
            from src.templates import generate_email_html
            return generate_email_html(
                business_name=lead.business_name,
                hook=lead.ai_hook or "",
                trade=lead.trade,
                image_url=self.footer_image_url
            )
        except ImportError:
            # Fallback basic HTML
            return f"""
            <html>
            <body>
            <p>Hi {lead.business_name},</p>
            <p>{lead.ai_hook or "We noticed you're a " + lead.trade + " in " + lead.city + "."}</p>
            <p>YapMate lets you create professional invoices just by speaking. No typing, no forms - just yap your job details and we handle the rest.</p>
            <p>Perfect for busy tradespeople who'd rather be working than doing paperwork.</p>
            <p>Learn more: <a href="https://www.yapmate.co.uk">www.yapmate.co.uk</a></p>
            <p>Cheers,<br>The YapMate Team</p>
            </body>
            </html>
            """

    def generate_text_body(self, lead: EnhancedLead) -> str:
        """
        Generate plain text email body.

        Args:
            lead: Lead to generate email for

        Returns:
            Plain text email body
        """
        try:
            from src.templates import generate_email_text
            return generate_email_text(
                business_name=lead.business_name,
                hook=lead.ai_hook or "",
                trade=lead.trade
            )
        except ImportError:
            # Fallback basic text
            return f"""
Hi {lead.business_name},

{lead.ai_hook or "We noticed you're a " + lead.trade + " in " + lead.city + "."}

YapMate lets you create professional invoices just by speaking. No typing, no forms - just yap your job details and we handle the rest.

Perfect for busy tradespeople who'd rather be working than doing paperwork.

Learn more: www.yapmate.co.uk

Cheers,
The YapMate Team
            """.strip()

    # =========================================================================
    # SENDING
    # =========================================================================

    def _send_test_email(self, to_email: str) -> bool:
        """
        Send a test email to verify email sending works.

        Used as a fallback when TEST_EMAIL is set but no eligible leads exist.

        Args:
            to_email: Email address to send test to

        Returns:
            True if test email sent successfully
        """
        try:
            from_header = f"{self.from_name} <{self.from_email}>"
            clean_to = to_email.strip() if to_email else None

            if not clean_to:
                print("    Test email failed: No recipient address")
                return False

            # Build test email content
            html_content = """
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>YapMate Lead Engine - Test Email</h2>
            <p>This is a test email from the YapMate Lead Engine.</p>
            <p>If you received this, the email sender is working correctly.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
                Sent at: {timestamp}<br>
                From: {from_email}
            </p>
            </body>
            </html>
            """.format(
                timestamp=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                from_email=self.from_email
            )

            text_content = f"""
YapMate Lead Engine - Test Email

This is a test email from the YapMate Lead Engine.

If you received this, the email sender is working correctly.

Sent at: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}
From: {self.from_email}
            """.strip()

            params = {
                "from": from_header,
                "to": [clean_to],
                "subject": "YapMate Lead Engine - Test Email",
                "html": html_content,
                "text": text_content,
            }

            if self.reply_to:
                params["reply_to"] = self.reply_to

            response = resend.Emails.send(params)
            email_id = response.get("id", "unknown")
            print(f"    Test email sent successfully (ID: {email_id})")
            return True

        except Exception as e:
            print(f"    Test email failed: {e}")
            return False

    def _check_send_enabled(self) -> tuple[bool, str]:
        """
        Check if sending is enabled. Fail-closed logic.

        Returns:
            Tuple of (is_enabled, reason)
        """
        config = get_config()

        # Hard block if SEND_ENABLED is not explicitly "true"
        if not config.pipeline.send_enabled:
            return (False, "SEND_ENABLED is not 'true' - sending blocked")

        return (True, "SEND_ENABLED is true")

    def _get_emails_sent_today(self) -> set:
        """
        Get set of email addresses already sent to today.

        This prevents sending duplicate emails to the same address
        across multiple runs in the same day.

        Returns:
            Set of lowercase email addresses
        """
        try:
            # Get all leads with status SENT and sent_at today
            all_rows = self.sheets.get_leads_tab().get_all_values()
            if not all_rows:
                return set()

            headers = all_rows[0]
            col_status = headers.index("status") if "status" in headers else None
            col_email = headers.index("email") if "email" in headers else None
            col_sent_at = headers.index("sent_at") if "sent_at" in headers else None

            if col_status is None or col_email is None:
                return set()

            today = datetime.utcnow().strftime("%Y-%m-%d")
            emails_sent = set()

            for row in all_rows[1:]:
                if len(row) <= max(col_status, col_email):
                    continue

                status = str(row[col_status]).strip().upper()
                if status != "SENT":
                    continue

                # Check if sent today
                if col_sent_at and len(row) > col_sent_at:
                    sent_at = str(row[col_sent_at]).strip()
                    if sent_at and not sent_at.startswith(today):
                        continue

                email = str(row[col_email]).strip().lower()
                if email:
                    emails_sent.add(email)

            return emails_sent

        except Exception as e:
            print(f"  Warning: Could not get emails sent today: {e}")
            return set()

    def sanitize_and_validate_email(self, lead: EnhancedLead) -> tuple[SanitizationResult, StructuredLog]:
        """
        Sanitize and validate lead email.

        Returns:
            Tuple of (sanitization_result, structured_log)
        """
        original_email = lead.email or ""
        result = sanitize_email(original_email)

        if not result.valid:
            log = StructuredLog(
                lead_id=lead.lead_id,
                status=SendStatus.INVALID,
                reason=result.reason or "Unknown validation error",
                email_original=original_email,
                email_sanitized=None,
                business_name=lead.business_name,
            )
            return (result, log)

        # Check if email was modified during sanitization
        was_sanitized = result.sanitized != original_email.lower().strip()

        log = StructuredLog(
            lead_id=lead.lead_id,
            status=SendStatus.SENT,  # Will be updated later
            reason="Email valid" + (" (sanitized)" if was_sanitized else ""),
            email_original=original_email,
            email_sanitized=result.sanitized,
            business_name=lead.business_name,
        )

        return (result, log)

    def send_email(self, lead: EnhancedLead, dry_run: bool = False) -> tuple[SendResult, StructuredLog]:
        """
        Send an email to a single lead with sanitization.

        Pipeline: lead.email → sanitize_email() → validate → send

        Args:
            lead: Lead to send email to
            dry_run: If True, validate but don't actually send

        Returns:
            Tuple of (SendResult, StructuredLog)
        """
        config = get_config()

        # Step 1: Check if sending is enabled (fail-closed)
        send_enabled, enable_reason = self._check_send_enabled()

        if not send_enabled and not dry_run:
            log = StructuredLog(
                lead_id=lead.lead_id,
                status=SendStatus.BLOCKED,
                reason=enable_reason,
                email_original=lead.email or "",
                email_sanitized=None,
                business_name=lead.business_name,
            )
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.BLOCKED,
                error=enable_reason,
                email_original=lead.email,
            ), log)

        # Step 2: Check if email exists
        if not lead.email:
            log = StructuredLog(
                lead_id=lead.lead_id,
                status=SendStatus.INVALID,
                reason="No email address",
                email_original="",
                email_sanitized=None,
                business_name=lead.business_name,
            )
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.INVALID,
                error="No email address",
                email_original="",
            ), log)

        # Step 3: Sanitize and validate email
        sanitization, log = self.sanitize_and_validate_email(lead)

        if not sanitization.valid:
            # Mark as INVALID in sheets
            self.sheets.update_lead_status(
                lead.lead_id,
                "INVALID",
                eligibility_reason=sanitization.reason
            )
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.INVALID,
                error=sanitization.reason,
                email_original=lead.email,
            ), log)

        # Use sanitized email
        clean_email = sanitization.sanitized

        # Step 4: Check eligibility
        if not lead.send_eligible:
            log.status = SendStatus.BLOCKED
            log.reason = f"Not eligible: {lead.eligibility_reason}"
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.BLOCKED,
                error=f"Not eligible: {lead.eligibility_reason}",
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

        # Step 5: Dry run check
        if dry_run or config.pipeline.dry_run:
            log.status = SendStatus.BLOCKED
            log.reason = "Dry run mode - email validated but not sent"
            return (SendResult(
                lead_id=lead.lead_id,
                success=True,  # Validation passed
                status=SendStatus.BLOCKED,
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

        # Step 6: Actually send the email
        try:
            # Generate email content
            subject = self.generate_subject(lead)
            html_body = self.generate_html_body(lead)
            text_body = self.generate_text_body(lead)

            # Log CTA link URL for deliverability verification
            from src.templates import APP_STORE_URL
            print(f"  → CTA Link URL: {APP_STORE_URL}")

            # Prepare send parameters (use sanitized email)
            params = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [clean_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
                "headers": {
                    "List-Unsubscribe": "<https://www.yapmate.co.uk/unsubscribe>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                }
            }

            if self.reply_to:
                params["reply_to"] = self.reply_to

            # Send via Resend
            response = resend.Emails.send(params)
            email_id = response.get("id", "unknown")
            
            # Log Resend email ID for verification
            print(f"  ✓ Resend email ID: {email_id}")

            # Update lead status with Resend ID
            self.sheets.update_lead_status(
                lead.lead_id,
                "SENT",
                sent_at=datetime.utcnow(),
                resend_id=email_id  # Store Resend email ID for tracking
            )

            log.status = SendStatus.SENT
            log.reason = f"Email sent successfully (Resend ID: {email_id})"

            return (SendResult(
                lead_id=lead.lead_id,
                success=True,
                status=SendStatus.SENT,
                email_id=email_id,
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

        except Exception as e:
            # Update lead status to FAILED
            self.sheets.update_lead_status(
                lead.lead_id,
                "FAILED",
                eligibility_reason=str(e)
            )

            log.status = SendStatus.FAILED
            log.reason = f"Send failed: {str(e)}"

            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.FAILED,
                error=str(e),
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

    def send_email_no_sheet_write(self, lead: EnhancedLead, dry_run: bool = False) -> tuple[SendResult, StructuredLog]:
        """
        Send an email to a single lead WITHOUT writing to sheets.

        This is used by send_batch() which collects all updates and
        writes them in a single batch at the end to avoid rate limits.

        Pipeline: lead.email → sanitize_email() → validate → send

        Args:
            lead: Lead to send email to
            dry_run: If True, validate but don't actually send

        Returns:
            Tuple of (SendResult, StructuredLog)
        """
        config = get_config()

        # Step 1: Check if sending is enabled (fail-closed)
        send_enabled, enable_reason = self._check_send_enabled()

        if not send_enabled and not dry_run:
            log = StructuredLog(
                lead_id=lead.lead_id,
                status=SendStatus.BLOCKED,
                reason=enable_reason,
                email_original=lead.email or "",
                email_sanitized=None,
                business_name=lead.business_name,
            )
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.BLOCKED,
                error=enable_reason,
                email_original=lead.email,
            ), log)

        # Step 2: Check if email exists
        if not lead.email:
            log = StructuredLog(
                lead_id=lead.lead_id,
                status=SendStatus.INVALID,
                reason="No email address",
                email_original="",
                email_sanitized=None,
                business_name=lead.business_name,
            )
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.INVALID,
                error="No email address",
                email_original="",
            ), log)

        # Step 3: Sanitize and validate email
        sanitization, log = self.sanitize_and_validate_email(lead)

        if not sanitization.valid:
            # NO sheet write - caller handles this in batch
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.INVALID,
                error=sanitization.reason,
                email_original=lead.email,
            ), log)

        # Use sanitized email
        clean_email = sanitization.sanitized

        # Step 4: Check eligibility
        if not lead.send_eligible:
            log.status = SendStatus.BLOCKED
            log.reason = f"Not eligible: {lead.eligibility_reason}"
            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.BLOCKED,
                error=f"Not eligible: {lead.eligibility_reason}",
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

        # Step 5: Dry run check
        if dry_run or config.pipeline.dry_run:
            log.status = SendStatus.BLOCKED
            log.reason = "Dry run mode - email validated but not sent"
            return (SendResult(
                lead_id=lead.lead_id,
                success=True,  # Validation passed
                status=SendStatus.BLOCKED,
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

        # Step 6: Actually send the email
        try:
            # Generate email content
            subject = self.generate_subject(lead)
            html_body = self.generate_html_body(lead)
            text_body = self.generate_text_body(lead)

            # Log CTA link URL for deliverability verification
            from src.templates import APP_STORE_URL
            print(f"  → CTA Link URL: {APP_STORE_URL}")

            # Prepare send parameters (use sanitized email)
            params = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [clean_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
                "headers": {
                    "List-Unsubscribe": "<https://www.yapmate.co.uk/unsubscribe>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                }
            }

            if self.reply_to:
                params["reply_to"] = self.reply_to

            # Send via Resend
            response = resend.Emails.send(params)
            email_id = response.get("id", "unknown")

            # Log Resend email ID for verification
            print(f"  ✓ Resend email ID: {email_id}")

            # NO sheet write - caller handles this in batch

            log.status = SendStatus.SENT
            log.reason = f"Email sent successfully (Resend ID: {email_id})"

            return (SendResult(
                lead_id=lead.lead_id,
                success=True,
                status=SendStatus.SENT,
                email_id=email_id,
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

        except Exception as e:
            # NO sheet write - caller handles this in batch

            log.status = SendStatus.FAILED
            log.reason = f"Send failed: {str(e)}"

            return (SendResult(
                lead_id=lead.lead_id,
                success=False,
                status=SendStatus.FAILED,
                error=str(e),
                email_original=lead.email,
                email_sanitized=clean_email,
            ), log)

    def _log_eligibility_breakdown(self) -> Dict[str, Any]:
        """
        Compute and log eligibility breakdown (counts only, no PII).

        Returns:
            Dictionary with breakdown statistics
        """
        print("\n" + "=" * 70)
        print("ELIGIBILITY BREAKDOWN")
        print("=" * 70)

        # Get all leads
        all_leads = self.sheets.get_all_leads(limit=10000)
        total_leads = len(all_leads)

        print(f"  Total leads: {total_leads}")

        # Count by status
        status_counts = {}
        approved_count = 0
        approved_not_sent_count = 0
        has_email_count = 0
        valid_email_count = 0
        send_eligible_count = 0
        final_eligible_count = 0

        # Reasons for ineligibility (for top reasons)
        reason_counts = {
            "No email address": 0,
            "Already sent": 0,
            "Invalid email": 0,
            "Not approved (status)": 0,
            "send_eligible = False": 0,
            "Not eligible (other)": 0,
        }

        for lead in all_leads:
            # Count by status
            status = (lead.status or "UNKNOWN").upper()
            status_counts[status] = status_counts.get(status, 0) + 1

            # Approved count
            if status == "APPROVED":
                approved_count += 1
                if status != "SENT":
                    approved_not_sent_count += 1

            # Email checks
            has_email = bool(lead.email and lead.email.strip())
            if has_email:
                has_email_count += 1

                # Sanitize and validate
                sanitization = sanitize_email(lead.email)
                if sanitization.valid:
                    valid_email_count += 1

            # Send eligible check
            if getattr(lead, 'send_eligible', False):
                send_eligible_count += 1

            # Final eligibility check (all criteria must pass)
            is_eligible = (
                status in ("NEW", "APPROVED") and
                has_email and
                getattr(lead, 'send_eligible', False)
            )
            
            if is_eligible:
                # Double-check email is valid
                if has_email:
                    sanitization = sanitize_email(lead.email)
                    if sanitization.valid:
                        final_eligible_count += 1
                    else:
                        reason_counts["Invalid email"] += 1
                else:
                    reason_counts["No email address"] += 1
            else:
                # Track reasons for ineligibility
                if status == "SENT":
                    reason_counts["Already sent"] += 1
                elif not has_email:
                    reason_counts["No email address"] += 1
                elif status not in ("NEW", "APPROVED"):
                    reason_counts["Not approved (status)"] += 1
                elif not getattr(lead, 'send_eligible', False):
                    reason_counts["send_eligible = False"] += 1
                else:
                    reason_counts["Not eligible (other)"] += 1

        # Log breakdown
        print(f"\n  By status:")
        for status in sorted(status_counts.keys()):
            print(f"    {status}: {status_counts[status]}")

        print(f"\n  Approved: {approved_count}")
        print(f"  Approved + not sent: {approved_not_sent_count}")
        print(f"  Has email: {has_email_count}")
        print(f"  Valid email (sanitized): {valid_email_count}")
        print(f"  send_eligible = True: {send_eligible_count}")
        print(f"  Final eligible (status=APPROVED + has_email + send_eligible=True + valid_email): {final_eligible_count}")

        # If 0 eligible, show top reasons
        if final_eligible_count == 0:
            print(f"\n  TOP REASONS (counts only, no PII):")
            sorted_reasons = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)
            for i, (reason, count) in enumerate(sorted_reasons[:3], 1):
                if count > 0:
                    print(f"    {i}. {reason}: {count}")

        print("=" * 70)

        return {
            "total_leads": total_leads,
            "status_counts": status_counts,
            "approved_count": approved_count,
            "approved_not_sent_count": approved_not_sent_count,
            "has_email_count": has_email_count,
            "valid_email_count": valid_email_count,
            "send_eligible_count": send_eligible_count,
            "final_eligible_count": final_eligible_count,
            "reason_counts": reason_counts,
        }

    def send_batch(self, limit: int = None, dry_run: bool = False, force_run: bool = False) -> SendBatchResult:
        """
        Send emails to eligible leads up to the daily limit.

        Pipeline per lead:
        1. Fetch eligible leads
        2. Claim lead (idempotency)
        3. Sanitize email
        4. Validate email
        5. Check SEND_ENABLED gate
        6. Send (or dry-run)
        7. Log structured output

        Args:
            limit: Maximum emails to send (defaults to remaining daily quota)
            dry_run: If True, validate but don't actually send
            force_run: If True, bypass pause flags (for manual overrides)

        Returns:
            SendBatchResult with outcomes and structured logs
        """
        config = get_config()

        print("\n" + "=" * 70)
        print("EMAIL SENDER - STRUCTURED PIPELINE")
        print("=" * 70)
        print(f"  Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")

        # =====================================================================
        # GATE CHAIN - DETERMINISTIC LOGIC
        # =====================================================================
        
        # Gate 1: SEND_ENABLED (fail-closed)
        send_enabled, enable_reason = self._check_send_enabled()
        
        # Gate 2: GLOBAL_PAUSE (environment override)
        global_pause = os.getenv("GLOBAL_PAUSE", "false").lower() == "true"
        
        # Gate 3: EMERGENCY_STOP (environment override)
        emergency_stop = os.getenv("EMERGENCY_STOP", "false").lower() == "true"
        
        # Gate 4: Sheet-based pause flag
        state = self.sheets.get_runner_state()
        sheet_paused = state.sending_paused if state.sending_paused else False
        
        # Gate 5: Force run override
        force_run_env = os.getenv("FORCE_RUN", "false").lower() == "true"
        force_run = force_run or force_run_env
        
        # Calculate effective dry run
        effective_dry_run = dry_run or config.pipeline.dry_run or not send_enabled
        
        # Deterministic send allowed logic
        # SEND_ALLOWED = SEND_ENABLED == true AND GLOBAL_PAUSE != true AND EMERGENCY_STOP != true AND (force_run == true OR sending_paused != true)
        send_allowed = (
            send_enabled and
            not global_pause and
            not emergency_stop and
            (force_run or not sheet_paused)
        )
        
        # Single explicit block reason
        block_reason = None
        if not send_enabled:
            block_reason = f"SEND_ENABLED is not 'true' - sending blocked"
        elif global_pause:
            block_reason = f"GLOBAL_PAUSE is 'true' - sending blocked"
        elif emergency_stop:
            block_reason = f"EMERGENCY_STOP is 'true' - sending blocked"
        elif sheet_paused and not force_run:
            block_reason = f"Sending is PAUSED in Google Sheet (reason: {state.pause_reason or 'No reason provided'})"
        
        # Print full gate chain
        print(f"\n  GATE CHECKS:")
        print(f"    SEND_ENABLED: {send_enabled} ({enable_reason})")
        print(f"    GLOBAL_PAUSE: {global_pause}")
        print(f"    EMERGENCY_STOP: {emergency_stop}")
        print(f"    Sheet paused: {sheet_paused}")
        if state.pause_reason:
            print(f"      Pause reason: {state.pause_reason}")
        print(f"    FORCE_RUN: {force_run}")
        print(f"    DRY_RUN: {config.pipeline.dry_run}")
        print(f"    SAFE_MODE: {config.pipeline.safe_mode}")
        print(f"    EFFECTIVE MODE: {'DRY RUN' if effective_dry_run else 'LIVE SEND'}")
        print(f"    SEND_ALLOWED: {send_allowed}")
        
        if block_reason:
            print(f"\n  ⚠️  BLOCKED: {block_reason}")
            if not send_enabled:
                print(f"      Pipeline will run for validation/logging only")
            elif force_run:
                print(f"      Note: FORCE_RUN would bypass this, but other gates are blocking")
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                total_blocked=0,
                total_invalid=0,
                total_sanitized=0,
                results=[],
                logs=[],
                stopped_reason=block_reason
            )

        # Check safety thresholds (only matters if actually sending and not force_run)
        if send_allowed and not effective_dry_run and not force_run:
            is_safe, pause_reason = self.check_safety_thresholds()
            if not is_safe:
                block_reason = f"Safety threshold exceeded: {pause_reason}"
                print(f"\n  ⚠️  BLOCKED: {block_reason}")
                self.pause_sending(pause_reason)
                return SendBatchResult(
                    total_attempted=0,
                    total_sent=0,
                    total_failed=0,
                    total_blocked=0,
                    total_invalid=0,
                    total_sanitized=0,
                    results=[],
                    logs=[],
                    stopped_reason=block_reason
                )

        # =====================================================================
        # WARMUP STATUS & DAILY LIMIT
        # =====================================================================
        print(f"\n  WARMUP CONFIGURATION:")
        print(f"    WARMUP_ENABLED: {self.config.warmup_enabled}")

        if self.config.warmup_enabled:
            print(f"    WARMUP_START_DAILY_LIMIT: {self.config.warmup_start_daily_limit}")
            print(f"    WARMUP_RAMP_INCREMENT: {self.config.warmup_increment_per_day}/day")
            print(f"    WARMUP_MAX_CAP: {self.config.warmup_max_daily_limit}")
            print(f"    WARMUP_START_DATE: {self.config.warmup_start_date or '(not set - using start limit)'}")
            daily_limit = self.calculate_daily_limit()
            print(f"    → Effective daily limit (warmup): {daily_limit}")
        else:
            daily_limit = self.config.daily_limit
            print(f"    → Warmup BYPASSED - using DAILY_LIMIT: {daily_limit}")

        # Calculate remaining quota (uses actual sheet count, not state counter)
        remaining_quota = self.get_remaining_daily_quota()
        print(f"    Remaining quota: {remaining_quota}")

        # Get sending limits from config
        send_limit_per_run = config.limits.send_limit_per_run
        delay_between_sends = config.limits.delay_between_sends
        print(f"  SEND_LIMIT_PER_RUN: {send_limit_per_run}")
        print(f"  DELAY_BETWEEN_SENDS: {delay_between_sends}s")

        if remaining_quota <= 0 and not effective_dry_run:
            print("\n  ⚠️  BLOCKED: Daily limit reached")
            print(f"      Daily limit: {daily_limit}, Sent today: {state.emails_sent_today}")
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                total_blocked=0,
                total_invalid=0,
                total_sanitized=0,
                results=[],
                logs=[],
                stopped_reason="Daily limit reached"
            )

        # Check for LIVE_SEND_TEST_MODE (send exactly 1 email for testing)
        test_mode = os.getenv("LIVE_SEND_TEST_MODE", "false").lower() == "true"
        if test_mode:
            print(f"\n  🧪 LIVE_SEND_TEST_MODE: ENABLED (will send exactly 1 email)")
            send_limit = 1
        else:
            # Use limit if provided, otherwise use SEND_LIMIT_PER_RUN, then remaining quota
            if limit:
                send_limit = min(limit, remaining_quota) if not effective_dry_run else limit
            else:
                send_limit = min(send_limit_per_run, remaining_quota) if not effective_dry_run else send_limit_per_run

        print(f"  Will process up to: {send_limit}")

        # Log eligibility breakdown BEFORE fetching
        breakdown = self._log_eligibility_breakdown()

        # Get eligible leads
        print(f"\n  Fetching eligible leads...")
        leads = self.sheets.get_eligible_leads(limit=send_limit)
        print(f"  Found {len(leads)} eligible leads")

        if not leads:
            # Log why no eligible leads (breakdown already shown above)
            print(f"\n  ⚠️  NO ELIGIBLE LEADS")
            print(f"      Breakdown shown above. Top reasons:")
            sorted_reasons = sorted(breakdown["reason_counts"].items(), key=lambda x: x[1], reverse=True)
            for i, (reason, count) in enumerate(sorted_reasons[:3], 1):
                if count > 0:
                    print(f"        {i}. {reason}: {count}")
            # Check for TEST_EMAIL fallback
            test_email = os.getenv("TEST_EMAIL", "").strip()
            if test_email and not effective_dry_run:
                print(f"\n  No eligible leads, but TEST_EMAIL is set: {test_email}")
                print(f"  Sending test email...")
                try:
                    test_result = self._send_test_email(test_email)
                    if test_result:
                        print(f"  Test email sent successfully!")
                        return SendBatchResult(
                            total_attempted=1,
                            total_sent=1,
                            total_failed=0,
                            total_blocked=0,
                            total_invalid=0,
                            total_sanitized=0,
                            results=[],
                            logs=[],
                            stopped_reason="No eligible leads (sent test email)"
                        )
                except Exception as e:
                    print(f"  Test email failed: {e}")

            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                total_blocked=0,
                total_invalid=0,
                total_sanitized=0,
                results=[],
                logs=[],
                stopped_reason="No eligible leads"
            )

        # Process leads with structured logging
        # IMPORTANT: We collect ALL status updates and batch them at the end
        # to avoid hitting Google Sheets 60 writes/minute quota
        results = []
        logs = []
        sent_count = 0
        failed_count = 0
        blocked_count = 0
        invalid_count = 0
        sanitized_count = 0
        skipped_count = 0
        duplicate_count = 0

        # Collect status updates for batch write at end
        pending_updates = []

        # CRITICAL: Track emails already sent in this batch to prevent duplicates
        # This catches cases where multiple leads have the same email address
        emails_sent_this_batch = set()

        # Also get emails already sent today (from previous runs)
        emails_sent_today = self._get_emails_sent_today()
        print(f"\n  Emails already sent today: {len(emails_sent_today)}")

        print(f"\n" + "=" * 70)
        print("PROCESSING LEADS")
        print("=" * 70)

        try:
            for i, lead in enumerate(leads, 1):
                print(f"\n[{i}/{len(leads)}] {lead.business_name}")
                print(f"  Lead ID: {lead.lead_id[:8]}...")
                print(f"  Email: {lead.email}")
                print(f"  Status: {lead.status}")
                print("-" * 40)

                # DUPLICATE CHECK: Skip if we've already sent to this email
                email_lower = (lead.email or "").lower().strip()
                if email_lower in emails_sent_this_batch:
                    print(f"  ⚠️  SKIPPED: Duplicate email (already sent in this batch)")
                    duplicate_count += 1
                    skipped_count += 1
                    # Mark as skipped so it's not picked up again
                    pending_updates.append({
                        'lead_id': lead.lead_id,
                        'status': 'SKIPPED',
                        'eligibility_reason': 'Duplicate email - already sent to this address',
                    })
                    continue

                if email_lower in emails_sent_today:
                    print(f"  ⚠️  SKIPPED: Duplicate email (already sent today)")
                    duplicate_count += 1
                    skipped_count += 1
                    pending_updates.append({
                        'lead_id': lead.lead_id,
                        'status': 'SKIPPED',
                        'eligibility_reason': 'Duplicate email - already sent today',
                    })
                    continue

                # Step 1: Send the email (NO sheet writes during this loop)
                result, log = self.send_email_no_sheet_write(lead, dry_run=effective_dry_run)
                results.append(result)
                logs.append(log)
                log.log()

                # Track sanitization
                if result.email_original and result.email_sanitized:
                    if result.email_original.lower().strip() != result.email_sanitized:
                        sanitized_count += 1

                # Collect status update for batch write
                if result.status == SendStatus.SENT:
                    sent_count += 1
                    # Track this email to prevent duplicates within the batch
                    emails_sent_this_batch.add(email_lower)
                    pending_updates.append({
                        'lead_id': lead.lead_id,
                        'status': 'SENT',
                        'sent_at': datetime.utcnow().isoformat(),
                        'resend_id': result.email_id or '',
                    })
                elif result.status == SendStatus.BLOCKED:
                    blocked_count += 1
                    # Revert to original status
                    pending_updates.append({
                        'lead_id': lead.lead_id,
                        'status': lead.status,  # Keep original
                        'eligibility_reason': log.reason,
                    })
                elif result.status == SendStatus.INVALID:
                    invalid_count += 1
                    pending_updates.append({
                        'lead_id': lead.lead_id,
                        'status': 'INVALID',
                        'eligibility_reason': log.reason,
                    })
                elif result.status == SendStatus.FAILED:
                    failed_count += 1
                    pending_updates.append({
                        'lead_id': lead.lead_id,
                        'status': lead.status,  # Keep original so lead isn't lost
                        'eligibility_reason': f"Send failed: {result.error}",
                    })
                elif result.status == SendStatus.SKIPPED:
                    skipped_count += 1
                    # No update needed for skipped

                # Rate limiting for email deliverability only (no sheet writes in loop)
                if result.status == SendStatus.SENT:
                    time.sleep(delay_between_sends)

            # BATCH UPDATE: Write all status changes in ONE API call
            if pending_updates:
                print(f"\n  Batch updating {len(pending_updates)} leads (single API call)...")
                try:
                    updated = self.sheets.batch_update_leads(pending_updates)
                    print(f"  Successfully updated {updated} leads")
                except Exception as batch_err:
                    print(f"  WARNING: Batch update failed: {batch_err}")
                    print(f"  Will retry with delays...")
                    # Fallback: individual updates with long delays
                    for j, update in enumerate(pending_updates):
                        try:
                            self.sheets.update_lead_status(
                                update['lead_id'],
                                update['status'],
                                **{k: v for k, v in update.items() if k not in ('lead_id', 'status')}
                            )
                            if j < len(pending_updates) - 1:
                                time.sleep(2)  # 2 second delay between writes
                        except Exception as inner_err:
                            print(f"  Failed to update {update['lead_id']}: {inner_err}")

        except Exception as e:
            # Unexpected error in sender loop - alert and re-raise
            print(f"\n  UNEXPECTED ERROR: {e}")
            alert_sender_error(e, sheets_manager=self.sheets)
            raise

        # Update send counter (only for actual sends)
        if sent_count > 0:
            self.increment_send_counter(sent_count)

        # Summary
        print("\n" + "=" * 70)
        print("BATCH SUMMARY")
        print("=" * 70)
        print(f"  Total processed: {len(leads)}")
        print(f"  SENT:      {sent_count}")
        print(f"  BLOCKED:   {blocked_count}")
        print(f"  INVALID:   {invalid_count}")
        print(f"  FAILED:    {failed_count}")
        print(f"  SKIPPED:   {skipped_count}")
        if duplicate_count > 0:
            print(f"  DUPLICATES:{duplicate_count} (same email, skipped)")
        print(f"  Sanitized: {sanitized_count}")
        print("=" * 70)

        return SendBatchResult(
            total_attempted=len(leads) - skipped_count,
            total_sent=sent_count,
            total_failed=failed_count,
            total_blocked=blocked_count,
            total_invalid=invalid_count,
            total_sanitized=sanitized_count,
            results=results,
            logs=logs,
        )


# =============================================================================
# CLI
# =============================================================================

def main():
    """CLI entry point for email sender."""
    import argparse
    import sys
    from pathlib import Path

    # Add parent directory to path
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    sys.path.insert(0, str(project_dir))
    os.chdir(project_dir)

    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Send emails to eligible leads"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum emails to send (defaults to remaining daily quota)"
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show sending status without sending"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume sending if paused"
    )

    args = parser.parse_args()

    # Connect to sheets
    print("Connecting to Google Sheets...")
    sheets = SequencerSheetsManager()
    sheets.ensure_all_tabs()

    # Create sender
    sender = SequencerEmailSender(sheets)

    if args.status:
        print("\n" + "=" * 60)
        print("SENDER STATUS")
        print("=" * 60)

        state = sheets.get_runner_state()
        daily_limit = sender.calculate_daily_limit()
        remaining = sender.get_remaining_daily_quota()
        metrics = sheets.get_safety_metrics()

        print(f"  Paused: {state.sending_paused}")
        if state.pause_reason:
            print(f"  Pause reason: {state.pause_reason}")
        print(f"  Daily limit: {daily_limit}")
        print(f"  Sent today: {state.emails_sent_today}")
        print(f"  Remaining: {remaining}")
        print(f"\n  Safety metrics (last 7 days):")
        print(f"    Total sent: {metrics['total_sent']}")
        print(f"    Bounces: {metrics['bounce_count']} ({metrics['bounce_rate']:.1%})")
        print(f"    Complaints: {metrics['complaint_count']} ({metrics['complaint_rate']:.3%})")
        print("=" * 60)
        return

    if args.resume:
        sender.resume_sending()
        return

    # Send emails
    result = sender.send_batch(limit=args.limit)

    if result.stopped_reason:
        print(f"\nSending stopped: {result.stopped_reason}")


if __name__ == "__main__":
    main()
