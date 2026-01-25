"""Email Sender for City-Trade Sequencing Engine.

This module handles email sending with:
- Daily limits enforced at sender level
- Warm-up ramp to gradually increase sending volume
- Safety checks based on bounce/complaint rates
- Integration with Resend API
- Status updates to Google Sheets
"""

import os
import time
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

import resend
from dotenv import load_dotenv

from src.sequencer_config import DEFAULT_EMAIL_SENDER_CONFIG, EmailSenderConfig
from src.sequencer_models import EnhancedLead, RunnerState
from src.sequencer_sheets import SequencerSheetsManager
from src.sequencer_alerts import alert_sending_paused, alert_sender_error


@dataclass
class SendResult:
    """Result of an email send attempt."""

    lead_id: str
    success: bool
    email_id: Optional[str] = None  # Resend email ID
    error: Optional[str] = None


@dataclass
class SendBatchResult:
    """Result of a batch send operation."""

    total_attempted: int
    total_sent: int
    total_failed: int
    results: List[SendResult]
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

    def send_email(self, lead: EnhancedLead) -> SendResult:
        """
        Send an email to a single lead.

        Args:
            lead: Lead to send email to

        Returns:
            SendResult with outcome
        """
        if not lead.email:
            return SendResult(
                lead_id=lead.lead_id,
                success=False,
                error="No email address"
            )

        if not lead.send_eligible:
            return SendResult(
                lead_id=lead.lead_id,
                success=False,
                error=f"Not eligible: {lead.eligibility_reason}"
            )

        try:
            # Generate email content
            subject = self.generate_subject(lead)
            html_body = self.generate_html_body(lead)
            text_body = self.generate_text_body(lead)

            # Prepare send parameters
            params = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [lead.email],
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

            return SendResult(
                lead_id=lead.lead_id,
                success=True,
                email_id=email_id
            )

        except Exception as e:
            # Update lead status to FAILED
            self.sheets.update_lead_status(
                lead.lead_id,
                "FAILED",
                eligibility_reason=str(e)
            )

            return SendResult(
                lead_id=lead.lead_id,
                success=False,
                error=str(e)
            )

    def send_batch(self, limit: int = None) -> SendBatchResult:
        """
        Send emails to eligible leads up to the daily limit.

        Args:
            limit: Maximum emails to send (defaults to remaining daily quota)

        Returns:
            SendBatchResult with outcomes
        """
        print("\n" + "=" * 60)
        print("EMAIL SENDER")
        print("=" * 60)

        # Check if sending is paused
        state = self.sheets.get_runner_state()
        if state.sending_paused:
            print(f"\nSending is PAUSED: {state.pause_reason}")
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                results=[],
                stopped_reason=f"Sending paused: {state.pause_reason}"
            )

        # Check safety thresholds
        is_safe, pause_reason = self.check_safety_thresholds()
        if not is_safe:
            self.pause_sending(pause_reason)
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                results=[],
                stopped_reason=pause_reason
            )

        # Calculate how many to send
        remaining_quota = self.get_remaining_daily_quota()
        daily_limit = self.calculate_daily_limit()

        print(f"  Daily limit: {daily_limit}")
        print(f"  Remaining quota: {remaining_quota}")

        if remaining_quota <= 0:
            print("\n  Daily limit reached. No more emails will be sent today.")
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                results=[],
                stopped_reason="Daily limit reached"
            )

        # Use limit if provided, otherwise use remaining quota
        send_limit = min(limit, remaining_quota) if limit else remaining_quota
        print(f"  Will send up to: {send_limit}")

        # Get eligible leads
        print(f"\n  Fetching eligible leads...")
        leads = self.sheets.get_eligible_leads(limit=send_limit)
        print(f"  Found {len(leads)} eligible leads")

        if not leads:
            return SendBatchResult(
                total_attempted=0,
                total_sent=0,
                total_failed=0,
                results=[],
                stopped_reason="No eligible leads"
            )

        # Send emails with claim-before-send for idempotency
        results = []
        sent_count = 0
        failed_count = 0
        skipped_count = 0

        print(f"\n  Sending emails (with claim step for idempotency)...")
        print("-" * 60)

        try:
            for i, lead in enumerate(leads, 1):
                print(f"  [{i}/{len(leads)}] {lead.business_name} <{lead.email}>...", end=" ")

                # Step 1: Claim the lead (compare-and-set from NEW/APPROVED -> QUEUED)
                claimed = self.sheets.claim_lead_for_sending(lead.lead_id, lead.status)
                if not claimed:
                    skipped_count += 1
                    print("SKIPPED (already claimed)")
                    continue

                # Step 2: Send the email
                result = self.send_email(lead)
                results.append(result)

                if result.success:
                    sent_count += 1
                    print(f"SENT (ID: {result.email_id})")
                    # Status already set to SENT by send_email()
                else:
                    failed_count += 1
                    print(f"FAILED: {result.error}")
                    # Revert to original status so lead isn't lost
                    self.sheets.update_lead_status(
                        lead.lead_id,
                        lead.status,  # Revert to original (NEW or APPROVED)
                        eligibility_reason=f"Send failed: {result.error}"
                    )

                # Rate limiting
                time.sleep(self.config.delay_between_sends_seconds)

                # Re-check safety thresholds periodically (every 10 emails)
                if i % 10 == 0:
                    is_safe, pause_reason = self.check_safety_thresholds()
                    if not is_safe:
                        self.pause_sending(pause_reason)
                        return SendBatchResult(
                            total_attempted=i,
                            total_sent=sent_count,
                            total_failed=failed_count,
                            results=results,
                            stopped_reason=pause_reason
                        )

        except Exception as e:
            # Unexpected error in sender loop - alert and re-raise
            print(f"\n  UNEXPECTED ERROR: {e}")
            alert_sender_error(e, sheets_manager=self.sheets)
            raise

        # Update send counter
        if sent_count > 0:
            self.increment_send_counter(sent_count)

        # Summary
        print("-" * 60)
        print(f"\n  SUMMARY:")
        print(f"    Attempted: {len(leads)}")
        print(f"    Claimed & Sent: {sent_count}")
        print(f"    Failed: {failed_count}")
        print(f"    Skipped (already claimed): {skipped_count}")
        print("=" * 60)

        return SendBatchResult(
            total_attempted=len(leads) - skipped_count,
            total_sent=sent_count,
            total_failed=failed_count,
            results=results
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
