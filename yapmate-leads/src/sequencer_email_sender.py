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

        # Initialize Resend
        resend_key = os.getenv("RESEND_API_KEY")
        if not resend_key:
            raise ValueError("RESEND_API_KEY not found in environment")

        resend.api_key = resend_key

        # Get email configuration from env (with fallbacks from config)
        self.from_email = os.getenv("EMAIL_FROM", self.config.from_email)
        self.from_name = os.getenv("EMAIL_FROM_NAME", self.config.from_name)
        self.reply_to = os.getenv("EMAIL_REPLY_TO", self.config.reply_to)
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

        Returns:
            Number of emails remaining in today's quota
        """
        state = self.sheets.get_runner_state()
        daily_limit = self.calculate_daily_limit()

        # Check if counter is from today
        today = datetime.now().strftime("%Y-%m-%d")
        if state.focus_trade_date != today:
            # Counter is from a different day, reset to full quota
            return daily_limit

        return max(0, daily_limit - state.emails_sent_today)

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

            # Update lead status
            self.sheets.update_lead_status(
                lead.lead_id,
                "SENT",
                sent_at=datetime.utcnow()
            )

            log.status = SendStatus.SENT
            log.reason = f"Email sent successfully (ID: {email_id})"

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

    def send_batch(self, limit: int = None, dry_run: bool = False) -> SendBatchResult:
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

        Returns:
            SendBatchResult with outcomes and structured logs
        """
        config = get_config()

        print("\n" + "=" * 70)
        print("EMAIL SENDER - STRUCTURED PIPELINE")
        print("=" * 70)
        print(f"  Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")

        # Check SEND_ENABLED gate (fail-closed)
        send_enabled, enable_reason = self._check_send_enabled()
        effective_dry_run = dry_run or config.pipeline.dry_run or not send_enabled

        print(f"\n  SEND_ENABLED: {send_enabled} ({enable_reason})")
        print(f"  DRY_RUN: {config.pipeline.dry_run}")
        print(f"  SAFE_MODE: {config.pipeline.safe_mode}")
        print(f"  EFFECTIVE MODE: {'DRY RUN' if effective_dry_run else 'LIVE SEND'}")

        if not send_enabled:
            print(f"\n  ⚠️  SEND_ENABLED gate is CLOSED - all sends will be BLOCKED")
            print(f"      Pipeline will run for validation/logging only")

        # Check if sending is paused
        state = self.sheets.get_runner_state()
        if state.sending_paused:
            print(f"\nSending is PAUSED: {state.pause_reason}")
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                total_blocked=0,
                total_invalid=0,
                total_sanitized=0,
                results=[],
                logs=[],
                stopped_reason=f"Sending paused: {state.pause_reason}"
            )

        # Check safety thresholds (only matters if actually sending)
        if send_enabled and not effective_dry_run:
            is_safe, pause_reason = self.check_safety_thresholds()
            if not is_safe:
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
                    stopped_reason=pause_reason
                )

        # Calculate how many to send
        remaining_quota = self.get_remaining_daily_quota()
        daily_limit = self.calculate_daily_limit()

        print(f"\n  Daily limit: {daily_limit}")
        print(f"  Remaining quota: {remaining_quota}")

        # Get SEND_LIMIT_PER_RUN from env
        send_limit_per_run = int(os.getenv("SEND_LIMIT_PER_RUN", "3"))
        print(f"  SEND_LIMIT_PER_RUN: {send_limit_per_run}")

        if remaining_quota <= 0 and not effective_dry_run:
            print("\n  Daily limit reached. No more emails will be sent today.")
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

        # Use limit if provided, otherwise use SEND_LIMIT_PER_RUN, then remaining quota
        if limit:
            send_limit = min(limit, remaining_quota) if not effective_dry_run else limit
        else:
            send_limit = min(send_limit_per_run, remaining_quota) if not effective_dry_run else send_limit_per_run

        print(f"  Will process up to: {send_limit}")

        # Get eligible leads
        print(f"\n  Fetching eligible leads...")
        leads = self.sheets.get_eligible_leads(limit=send_limit)
        print(f"  Found {len(leads)} eligible leads")

        if not leads:
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
        results = []
        logs = []
        sent_count = 0
        failed_count = 0
        blocked_count = 0
        invalid_count = 0
        sanitized_count = 0
        skipped_count = 0

        print(f"\n" + "=" * 70)
        print("PROCESSING LEADS")
        print("=" * 70)

        try:
            for i, lead in enumerate(leads, 1):
                print(f"\n[{i}/{len(leads)}] {lead.business_name}")
                print("-" * 40)

                # Step 1: Claim the lead (compare-and-set from NEW/APPROVED -> QUEUED)
                claimed = self.sheets.claim_lead_for_sending(lead.lead_id, lead.status)
                if not claimed:
                    skipped_count += 1
                    log = StructuredLog(
                        lead_id=lead.lead_id,
                        status=SendStatus.SKIPPED,
                        reason="Already claimed by another process",
                        email_original=lead.email or "",
                        email_sanitized=None,
                        business_name=lead.business_name,
                    )
                    log.log()
                    logs.append(log)
                    continue

                # Step 2: Send the email (includes sanitization)
                result, log = self.send_email(lead, dry_run=effective_dry_run)
                results.append(result)
                logs.append(log)
                log.log()

                # Track sanitization
                if result.email_original and result.email_sanitized:
                    if result.email_original.lower().strip() != result.email_sanitized:
                        sanitized_count += 1

                # Update counters
                if result.status == SendStatus.SENT:
                    sent_count += 1
                elif result.status == SendStatus.BLOCKED:
                    blocked_count += 1
                    # Revert to original status if blocked (not invalid)
                    if lead.status in ("NEW", "APPROVED"):
                        self.sheets.update_lead_status(
                            lead.lead_id,
                            lead.status,
                            eligibility_reason=log.reason
                        )
                elif result.status == SendStatus.INVALID:
                    invalid_count += 1
                    # Already marked as INVALID in send_email
                elif result.status == SendStatus.FAILED:
                    failed_count += 1
                    # Revert to original status so lead isn't lost
                    self.sheets.update_lead_status(
                        lead.lead_id,
                        lead.status,
                        eligibility_reason=f"Send failed: {result.error}"
                    )

                # Rate limiting (only if actually sending)
                if result.status == SendStatus.SENT:
                    time.sleep(self.config.delay_between_sends_seconds)

                # Re-check safety thresholds periodically (every 10 emails)
                if i % 10 == 0 and send_enabled and not effective_dry_run:
                    is_safe, pause_reason = self.check_safety_thresholds()
                    if not is_safe:
                        self.pause_sending(pause_reason)
                        break

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
