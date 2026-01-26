"""Google Sheets manager for City-Trade Sequencing Engine.

This module provides multi-tab support for the sequencing system:
- queue: Task queue with priority ordering
- state: Runner state (focus_trade_id, safety counters)
- leads: Master lead list with full metadata
- dedupe_keys: Fast dedupe lookup table
- run_log: Execution history
- campaigns: Email campaign tracking
- email_blocklist: Bounced/complained addresses
"""

import os
import json
import tempfile
import time
import functools
from typing import List, Dict, Set, Optional, Any, Tuple
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials
from gspread.exceptions import APIError


class SheetsWriteStats:
    """Tracks sheet write statistics for summary logging."""

    def __init__(self):
        self.batches = 0
        self.rows_updated = 0
        self.retries = 0

    def record_batch(self, rows: int, retries: int = 0):
        """Record a batch write."""
        self.batches += 1
        self.rows_updated += rows
        self.retries += retries

    def log_summary(self):
        """Print summary of sheet writes."""
        print(f"  [Sheets] Write summary: {self.batches} batches, {self.rows_updated} rows, {self.retries} retries")

    def reset(self):
        """Reset stats for new run."""
        self.batches = 0
        self.rows_updated = 0
        self.retries = 0


# Global write stats tracker
_write_stats = SheetsWriteStats()


def get_write_stats() -> SheetsWriteStats:
    """Get the global write stats tracker."""
    return _write_stats


def retry_on_rate_limit(max_retries: int = 3, base_delay: float = 2.0):
    """
    Decorator to retry operations on Google Sheets rate limit errors (429).

    Uses exponential backoff: delay = base_delay * 2^attempt
    Tracks retry count in global stats.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds (doubles each retry)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            retry_count = 0
            for attempt in range(max_retries + 1):
                try:
                    result = func(*args, **kwargs)
                    # Track retries in global stats
                    if retry_count > 0:
                        _write_stats.retries += retry_count
                    return result
                except APIError as e:
                    # Check if it's a rate limit error (429)
                    if hasattr(e, 'response') and e.response.status_code == 429:
                        last_exception = e
                        retry_count += 1
                        if attempt < max_retries:
                            delay = base_delay * (2 ** attempt)
                            print(f"  [Sheets] Rate limit hit, retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})...")
                            time.sleep(delay)
                            continue
                        else:
                            print(f"  [Sheets] Rate limit exceeded after {max_retries} retries")
                    raise
                except Exception:
                    raise
            # If we exhausted retries, raise the last exception
            if last_exception:
                raise last_exception
        return wrapper
    return decorator

from src.sequencer_config import SHEETS_TABS
from src.sequencer_models import (
    QueueTask, TaskStatus, SessionType,
    RunnerState, EnhancedLead, DedupeKey,
    RunLogEntry, EmailCampaign, DedupeMatchType
)


class SequencerSheetsManager:
    """Multi-tab Google Sheets manager for the sequencing engine."""

    def __init__(self, credentials_file: str = "credentials.json", sheet_id: str = None):
        """
        Initialize the sheets manager.

        Credentials can be provided via:
        1. GOOGLE_SHEETS_CREDENTIALS_JSON env var (JSON string, for CI)
        2. credentials_file path (for local development)

        Args:
            credentials_file: Path to Google service account credentials
            sheet_id: Google Sheet ID (or from GOOGLE_SHEET_ID env var)
        """
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]

        # Check for credentials JSON in environment (CI mode)
        creds_json_env = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
        self._service_account_email = None

        if creds_json_env:
            # CI mode: parse JSON from environment variable
            print("[Sheets] Using credentials from GOOGLE_SHEETS_CREDENTIALS_JSON env var")
            try:
                creds_info = json.loads(creds_json_env)
                self._service_account_email = creds_info.get("client_email")
                credentials = Credentials.from_service_account_info(creds_info, scopes=scopes)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in GOOGLE_SHEETS_CREDENTIALS_JSON: {e}")
        else:
            # Local mode: read from file
            creds_path = os.path.join(os.getcwd(), credentials_file)
            if not os.path.exists(creds_path):
                raise FileNotFoundError(f"Could not find credentials at {creds_path}")

            # Extract service account email from file
            try:
                with open(creds_path) as f:
                    creds_info = json.load(f)
                    self._service_account_email = creds_info.get("client_email")
            except Exception:
                pass  # Non-critical, continue without email

            credentials = Credentials.from_service_account_file(creds_path, scopes=scopes)

        self.client = gspread.authorize(credentials)

        sheet_id = sheet_id or os.getenv("GOOGLE_SHEET_ID")
        if not sheet_id:
            raise ValueError("GOOGLE_SHEET_ID is missing from .env file")

        print(f"Connecting to Google Sheet ID: {sheet_id}...")
        self.spreadsheet = self.client.open_by_key(sheet_id)

        # Cache worksheet references
        self._worksheets: Dict[str, gspread.Worksheet] = {}

    def get_service_account_email(self) -> Optional[str]:
        """Get the service account email used for authentication."""
        return self._service_account_email

    # =========================================================================
    # TAB MANAGEMENT
    # =========================================================================

    def get_or_create_tab(self, tab_name: str, headers: List[str] = None) -> gspread.Worksheet:
        """
        Get a worksheet by name, creating it if it doesn't exist.

        Args:
            tab_name: Name of the tab
            headers: Column headers (only used when creating)

        Returns:
            Worksheet object
            
        Raises:
            ValueError: If tab is missing and headers are required (for critical tabs)
        """
        if tab_name in self._worksheets:
            return self._worksheets[tab_name]

        try:
            worksheet = self.spreadsheet.worksheet(tab_name)
        except gspread.exceptions.WorksheetNotFound:
            # For critical tabs (like leads), fail with helpful error
            if headers and tab_name == SHEETS_TABS.get("leads", "leads"):
                # List all available tabs
                all_tabs = [ws.title for ws in self.spreadsheet.worksheets()]
                raise ValueError(
                    f"Required tab '{tab_name}' not found. Available tabs: {', '.join(all_tabs)}\n"
                    f"Set LEADS_SHEET_TAB environment variable to the correct tab name."
                )
            print(f"  Creating tab: {tab_name}")
            worksheet = self.spreadsheet.add_worksheet(
                title=tab_name,
                rows=1000,
                cols=len(headers) if headers else 20
            )
            if headers:
                worksheet.update('A1', [headers])

        # Validate headers for critical tabs
        if headers and tab_name == SHEETS_TABS.get("leads", "leads"):
            self._validate_leads_headers(worksheet, headers)

        self._worksheets[tab_name] = worksheet
        return worksheet
    
    def _validate_leads_headers(self, worksheet: gspread.Worksheet, expected_headers: List[str]):
        """Validate that leads tab has required headers."""
        all_rows = worksheet.get_all_values()
        if len(all_rows) == 0:
            return  # Empty sheet, will be created with headers
        
        actual_headers = [h.strip() for h in all_rows[0]]
        missing_headers = []
        for expected in expected_headers:
            if expected not in actual_headers:
                missing_headers.append(expected)
        
        if missing_headers:
            # User-friendly error message
            if len(missing_headers) == 1:
                error_msg = (
                    f"Leads tab '{worksheet.title}' is missing required column: {missing_headers[0]}\n"
                    f"\n"
                    f"To fix this automatically, run:\n"
                    f"  python scripts/fix_sheet_headers.py\n"
                    f"\n"
                    f"Expected columns ({len(expected_headers)}): {', '.join(expected_headers)}\n"
                    f"Actual columns ({len(actual_headers)}): {', '.join(actual_headers)}"
                )
            else:
                error_msg = (
                    f"Leads tab '{worksheet.title}' is missing required columns: {', '.join(missing_headers)}\n"
                    f"\n"
                    f"To fix this automatically, run:\n"
                    f"  python scripts/fix_sheet_headers.py\n"
                    f"\n"
                    f"Expected columns ({len(expected_headers)}): {', '.join(expected_headers)}\n"
                    f"Actual columns ({len(actual_headers)}): {', '.join(actual_headers)}"
                )
            raise ValueError(error_msg)

    def ensure_all_tabs(self):
        """Create all required tabs with headers if they don't exist."""
        print("Ensuring all required tabs exist...")

        # Queue tab
        self.get_or_create_tab(SHEETS_TABS["queue"], QueueTask.headers())

        # State tab
        self.get_or_create_tab(SHEETS_TABS["state"], RunnerState.headers())

        # Leads tab
        self.get_or_create_tab(SHEETS_TABS["leads"], EnhancedLead.headers())

        # Dedupe keys tab
        self.get_or_create_tab(SHEETS_TABS["dedupe_keys"], DedupeKey.headers())

        # Run log tab
        self.get_or_create_tab(SHEETS_TABS["run_log"], RunLogEntry.headers())

        # Campaigns tab
        self.get_or_create_tab(SHEETS_TABS["campaigns"], EmailCampaign.headers())

        # Email blocklist tab
        self.get_or_create_tab(SHEETS_TABS["email_blocklist"], ["email", "reason", "added_at"])

        print("All tabs ready.")

    # =========================================================================
    # QUEUE OPERATIONS
    # =========================================================================

    def get_queue_tab(self) -> gspread.Worksheet:
        """Get the queue worksheet."""
        return self.get_or_create_tab(SHEETS_TABS["queue"], QueueTask.headers())

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def append_queue_tasks(self, tasks: List[QueueTask]) -> int:
        """
        Append tasks to the queue.

        Args:
            tasks: List of QueueTask objects

        Returns:
            Number of tasks added
        """
        if not tasks:
            return 0

        sheet = self.get_queue_tab()
        rows = [task.to_sheets_row() for task in tasks]
        sheet.append_rows(rows, value_input_option="USER_ENTERED")
        return len(rows)

    def get_pending_tasks(self, limit: int = 100) -> List[QueueTask]:
        """
        Get pending tasks sorted by priority.

        Args:
            limit: Maximum number of tasks to return

        Returns:
            List of QueueTask objects
        """
        sheet = self.get_queue_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return []

        tasks = []
        for row in all_rows[1:]:  # Skip header
            try:
                task = QueueTask.from_sheets_row(row)
                if task.status == TaskStatus.PENDING:
                    tasks.append(task)
            except Exception as e:
                print(f"  Warning: Could not parse queue row: {e}")

        # Sort by priority (lower = higher priority)
        tasks.sort(key=lambda t: t.priority)
        return tasks[:limit]

    def get_pending_tasks_for_trade(self, trade: str, limit: int = 10) -> List[QueueTask]:
        """
        Get pending tasks for a specific trade, sorted by priority.

        Args:
            trade: Trade to filter by
            limit: Maximum number of tasks to return

        Returns:
            List of QueueTask objects
        """
        all_pending = self.get_pending_tasks(limit=500)
        filtered = [t for t in all_pending if t.trade == trade]
        return filtered[:limit]

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        leads_found: int = None,
        leads_after_dedupe: int = None,
        error_message: str = None
    ):
        """
        Update a task's status and results.

        Args:
            task_id: Task ID to update
            status: New status
            leads_found: Number of leads found (optional)
            leads_after_dedupe: Number after deduplication (optional)
            error_message: Error message if failed (optional)
        """
        sheet = self.get_queue_tab()
        all_rows = sheet.get_all_values()
        headers = all_rows[0]

        # Find column indices
        col_task_id = headers.index("task_id")
        col_status = headers.index("status")

        # Find and update the row
        for row_idx, row in enumerate(all_rows[1:], start=2):
            if row[col_task_id] == task_id:
                # Update status
                sheet.update_cell(row_idx, col_status + 1, status.value)

                # Update timestamps
                if status == TaskStatus.IN_PROGRESS:
                    col = headers.index("started_at")
                    sheet.update_cell(row_idx, col + 1, datetime.utcnow().isoformat())
                elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                    col = headers.index("completed_at")
                    sheet.update_cell(row_idx, col + 1, datetime.utcnow().isoformat())

                # Update counts
                if leads_found is not None:
                    col = headers.index("leads_found")
                    sheet.update_cell(row_idx, col + 1, leads_found)

                if leads_after_dedupe is not None:
                    col = headers.index("leads_after_dedupe")
                    sheet.update_cell(row_idx, col + 1, leads_after_dedupe)

                if error_message:
                    col = headers.index("error_message")
                    sheet.update_cell(row_idx, col + 1, error_message)

                return

    def clear_queue(self):
        """Clear all tasks from the queue (keeps headers)."""
        sheet = self.get_queue_tab()
        sheet.delete_rows(2, sheet.row_count)

    # =========================================================================
    # STATE OPERATIONS
    # =========================================================================

    def get_state_tab(self) -> gspread.Worksheet:
        """Get the state worksheet."""
        return self.get_or_create_tab(SHEETS_TABS["state"], RunnerState.headers())

    def get_runner_state(self) -> RunnerState:
        """
        Get the current runner state.

        Returns:
            RunnerState object (default values if no state exists)
        """
        sheet = self.get_state_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return RunnerState()

        try:
            return RunnerState.from_sheets_row(all_rows[1])
        except Exception as e:
            print(f"  Warning: Could not parse state: {e}")
            return RunnerState()

    def save_runner_state(self, state: RunnerState):
        """
        Save the runner state (overwrites row 2).

        Args:
            state: RunnerState object to save
        """
        sheet = self.get_state_tab()
        row = state.to_sheets_row()

        # Ensure we have headers
        if len(sheet.get_all_values()) == 0:
            sheet.update('A1', [RunnerState.headers()])

        # Update or append state row
        if len(sheet.get_all_values()) < 2:
            sheet.append_rows([row], value_input_option="USER_ENTERED")
        else:
            # Update row 2 (state is always in row 2)
            cell_range = f"A2:{chr(65 + len(row) - 1)}2"
            sheet.update(cell_range, [row], value_input_option="USER_ENTERED")

    def update_focus_trade(self, trade: str, date_str: str):
        """
        Update the focus trade for today.

        Args:
            trade: Trade name
            date_str: Date in YYYY-MM-DD format
        """
        state = self.get_runner_state()
        state.focus_trade_id = trade
        state.focus_trade_date = date_str
        self.save_runner_state(state)

    def clear_focus_trade(self):
        """Clear the focus trade (for new day)."""
        state = self.get_runner_state()
        state.focus_trade_id = None
        state.focus_trade_date = None
        self.save_runner_state(state)

    # =========================================================================
    # LEADS OPERATIONS
    # =========================================================================

    def get_leads_tab(self) -> gspread.Worksheet:
        """Get the leads worksheet."""
        tab_name = os.getenv("LEADS_SHEET_TAB", SHEETS_TABS["leads"])
        return self.get_or_create_tab(tab_name, EnhancedLead.headers())
    
    def list_all_tabs(self) -> List[Dict[str, Any]]:
        """
        List all worksheet tabs with metadata.
        
        Returns:
            List of dicts with title, row_count, col_count, headers
        """
        tabs_info = []
        for ws in self.spreadsheet.worksheets():
            all_rows = ws.get_all_values()
            tabs_info.append({
                "title": ws.title,
                "row_count": len(all_rows),
                "col_count": len(all_rows[0]) if all_rows else 0,
                "headers": all_rows[0] if all_rows else [],
            })
        return tabs_info

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def append_leads(self, leads: List[EnhancedLead]) -> int:
        """
        Append leads to the leads tab.

        Args:
            leads: List of EnhancedLead objects

        Returns:
            Number of leads added
        """
        if not leads:
            return 0

        sheet = self.get_leads_tab()
        rows = [lead.to_sheets_row() for lead in leads]
        sheet.append_rows(rows, value_input_option="USER_ENTERED")

        # Track in global stats
        _write_stats.record_batch(len(rows))

        return len(rows)

    def get_all_leads(self, limit: int = 10000) -> List[EnhancedLead]:
        """
        Get all leads (for analysis/breakdown).

        Args:
            limit: Maximum number to return

        Returns:
            List of EnhancedLead objects
        """
        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return []

        leads = []
        for row in all_rows[1:]:
            try:
                leads.append(EnhancedLead.from_sheets_row(row))
            except Exception as e:
                print(f"  Warning: Could not parse lead row: {e}")

            if len(leads) >= limit:
                break

        return leads

    def get_leads_by_status(self, status: str, limit: int = 100) -> List[EnhancedLead]:
        """
        Get leads with a specific status.

        Args:
            status: Status to filter by (e.g., "APPROVED", "NEW")
            limit: Maximum number to return

        Returns:
            List of EnhancedLead objects
        """
        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return []

        headers = all_rows[0]
        col_status = headers.index("status")

        leads = []
        for row in all_rows[1:]:
            if len(row) > col_status and row[col_status].upper() == status.upper():
                try:
                    leads.append(EnhancedLead.from_sheets_row(row))
                except Exception as e:
                    print(f"  Warning: Could not parse lead row: {e}")

            if len(leads) >= limit:
                break

        return leads

    def get_eligible_leads(self, limit: int = 100) -> List[EnhancedLead]:
        """
        Get leads that are send-eligible and have status NEW or APPROVED.

        Eligibility criteria (ALL must be true):
        - status == "APPROVED" (or "NEW" if auto-approval not run yet)
        - send_eligible == True (strict boolean check, no string coercion)
        - email exists and is not empty
        - lead has not been sent (status != "SENT")

        Args:
            limit: Maximum number to return

        Returns:
            List of EnhancedLead objects
        """
        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return []

        headers = all_rows[0]
        col_status = headers.index("status")
        col_eligible = headers.index("send_eligible")
        col_email = headers.index("email") if "email" in headers else None

        leads = []
        for row in all_rows[1:]:
            if len(row) <= max(col_status, col_eligible):
                continue

            # Strict status check (no case-insensitive, exact match)
            status = str(row[col_status]).strip().upper()
            
            # Strict boolean check for send_eligible (no string coercion)
            eligible_str = str(row[col_eligible]).strip().lower()
            eligible = eligible_str in ("true", "1", "yes")
            
            # Check email exists
            has_email = False
            if col_email is not None and len(row) > col_email:
                email = str(row[col_email]).strip()
                has_email = bool(email and email != "")

            # Eligibility: status must be NEW or APPROVED, email must exist
            # send_eligible can be True OR computed as eligible if status=APPROVED and email valid
            is_status_eligible = status in ("NEW", "APPROVED")
            computed_eligible = False
            
            # Computed eligibility fallback: if status=APPROVED and email valid, treat as eligible
            # even if send_eligible column is False/empty
            if status == "APPROVED" and has_email:
                # Sanitize email to check validity
                from src.email_sanitizer import sanitize_email
                sanitization = sanitize_email(email)
                if sanitization.valid:
                    computed_eligible = True
            
            # Lead is eligible if: (send_eligible=True OR computed_eligible=True) AND status eligible AND has email
            if (eligible or computed_eligible) and is_status_eligible and has_email:
                try:
                    lead = EnhancedLead.from_sheets_row(row)
                    # Override send_eligible if computed eligibility says it should be True
                    if computed_eligible and not lead.send_eligible:
                        lead.send_eligible = True
                    # Double-check eligibility in the parsed object
                    if lead.send_eligible and lead.status in ("NEW", "APPROVED") and lead.email:
                        leads.append(lead)
                except Exception as e:
                    print(f"  Warning: Could not parse lead row: {e}")

            if len(leads) >= limit:
                break

        return leads

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def update_lead_status(self, lead_id: str, status: str, send_eligible: bool = None, **kwargs):
        """
        Update a lead's status and optional fields.

        Args:
            lead_id: Lead ID to update
            status: New status (will be normalized to uppercase)
            send_eligible: Optional boolean to set send_eligible field
            **kwargs: Additional fields to update (sent_at, bounced_at, etc.)
        """
        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()
        headers = all_rows[0]

        col_lead_id = headers.index("lead_id")
        col_status = headers.index("status")
        col_updated = headers.index("updated_at")
        
        # Normalize status to uppercase
        status_normalized = str(status).strip().upper()

        for row_idx, row in enumerate(all_rows[1:], start=2):
            if row[col_lead_id] == lead_id:
                # Update status (normalized)
                sheet.update_cell(row_idx, col_status + 1, status_normalized)
                sheet.update_cell(row_idx, col_updated + 1, datetime.utcnow().isoformat())
                
                # Update send_eligible if provided
                if send_eligible is not None and "send_eligible" in headers:
                    col_eligible = headers.index("send_eligible")
                    # Store as string "TRUE" or "FALSE" for Google Sheets
                    sheet.update_cell(row_idx, col_eligible + 1, "TRUE" if send_eligible else "FALSE")

                # Update additional fields
                for field, value in kwargs.items():
                    if field in headers:
                        col = headers.index(field)
                        if isinstance(value, datetime):
                            value = value.isoformat()
                        elif isinstance(value, bool):
                            # Convert boolean to string for Google Sheets
                            value = "TRUE" if value else "FALSE"
                        sheet.update_cell(row_idx, col + 1, value)

                return

    def claim_lead_for_sending(self, lead_id: str, expected_status: str = "NEW") -> bool:
        """
        Atomically claim a lead for sending (compare-and-set).

        Only claims if current status matches expected_status.
        Sets status to QUEUED to prevent double-sends in concurrent runs.

        Args:
            lead_id: Lead ID to claim
            expected_status: Expected current status (NEW or APPROVED)

        Returns:
            True if successfully claimed, False if status didn't match
        """
        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()
        headers = all_rows[0]

        col_lead_id = headers.index("lead_id")
        col_status = headers.index("status")
        col_updated = headers.index("updated_at")

        for row_idx, row in enumerate(all_rows[1:], start=2):
            if row[col_lead_id] == lead_id:
                current_status = row[col_status].upper()

                # Compare-and-set: only claim if status matches expected
                if current_status != expected_status.upper():
                    print(f"  [Claim] Lead {lead_id[:8]} status is {current_status}, expected {expected_status} - skipping")
                    return False

                # Claim by setting to QUEUED
                sheet.update_cell(row_idx, col_status + 1, "QUEUED")
                sheet.update_cell(row_idx, col_updated + 1, datetime.utcnow().isoformat())
                return True

        return False

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def batch_update_leads(
        self,
        updates: List[Dict[str, Any]],
    ) -> int:
        """
        Batch update multiple leads efficiently.

        Uses range-based updates to minimize API calls.
        Much more efficient than individual update_cell calls.

        Args:
            updates: List of dicts with 'lead_id' and fields to update.
                     e.g., [{'lead_id': 'abc', 'status': 'APPROVED', 'send_eligible': True}]

        Returns:
            Number of leads updated
        """
        if not updates:
            return 0

        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()
        headers = all_rows[0]

        # Build index of lead_id -> row number
        col_lead_id = headers.index("lead_id")
        lead_id_to_row = {}
        for row_idx, row in enumerate(all_rows[1:], start=2):
            if len(row) > col_lead_id:
                lead_id_to_row[row[col_lead_id]] = row_idx

        # Collect all cell updates
        cell_updates = []
        updated_count = 0

        for update in updates:
            lead_id = update.get("lead_id")
            if not lead_id or lead_id not in lead_id_to_row:
                continue

            row_idx = lead_id_to_row[lead_id]

            for field, value in update.items():
                if field == "lead_id":
                    continue
                if field not in headers:
                    continue

                col_idx = headers.index(field) + 1  # 1-based

                # Convert values for sheets
                if isinstance(value, bool):
                    value = "TRUE" if value else "FALSE"
                elif isinstance(value, datetime):
                    value = value.isoformat()
                elif value is None:
                    value = ""

                cell_updates.append({
                    "range": f"{self._col_letter(col_idx)}{row_idx}",
                    "values": [[value]]
                })

            # Always update updated_at
            if "updated_at" in headers:
                col_idx = headers.index("updated_at") + 1
                cell_updates.append({
                    "range": f"{self._col_letter(col_idx)}{row_idx}",
                    "values": [[datetime.utcnow().isoformat()]]
                })

            updated_count += 1

        # Batch update all cells
        if cell_updates:
            sheet.batch_update(cell_updates, value_input_option="USER_ENTERED")
            _write_stats.record_batch(updated_count)

        return updated_count

    def _col_letter(self, col_num: int) -> str:
        """Convert column number (1-based) to letter (A, B, ... Z, AA, AB, ...)."""
        result = ""
        while col_num > 0:
            col_num, remainder = divmod(col_num - 1, 26)
            result = chr(65 + remainder) + result
        return result

    # =========================================================================
    # DEDUPE KEYS OPERATIONS
    # =========================================================================

    def get_dedupe_keys_tab(self) -> gspread.Worksheet:
        """Get the dedupe_keys worksheet."""
        return self.get_or_create_tab(SHEETS_TABS["dedupe_keys"], DedupeKey.headers())

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def append_dedupe_keys(self, keys: List[DedupeKey]) -> int:
        """
        Append dedupe keys to the lookup table.

        Args:
            keys: List of DedupeKey objects

        Returns:
            Number of keys added
        """
        if not keys:
            return 0

        sheet = self.get_dedupe_keys_tab()
        rows = [key.to_sheets_row() for key in keys]
        sheet.append_rows(rows, value_input_option="USER_ENTERED")
        return len(rows)

    def load_dedupe_keys(self) -> Dict[str, Dict[str, str]]:
        """
        Load all dedupe keys into memory for fast lookup.

        Returns:
            Dict mapping key_type -> {key_value: lead_id}
        """
        sheet = self.get_dedupe_keys_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return {}

        keys_by_type: Dict[str, Dict[str, str]] = {
            "place_id": {},
            "source_url": {},
            "email": {},
            "phone": {},
            "name_city": {},
        }

        for row in all_rows[1:]:
            if len(row) >= 3:
                key_type = row[0]
                key_value = row[1].lower()
                lead_id = row[2]

                if key_type in keys_by_type:
                    keys_by_type[key_type][key_value] = lead_id

        return keys_by_type

    def check_dedupe(
        self,
        place_id: str = None,
        source_url: str = None,
        email: str = None,
        phone: str = None,
        name_city: str = None
    ) -> Tuple[bool, Optional[DedupeMatchType], Optional[str]]:
        """
        Check if a lead is a duplicate.

        Args:
            place_id: Google Maps place ID
            source_url: Original listing URL
            email: Email address
            phone: Phone number
            name_city: business_name|city composite

        Returns:
            Tuple of (is_duplicate, match_type, matched_lead_id)
        """
        keys = self.load_dedupe_keys()

        # Check in priority order
        if place_id and place_id.lower() in keys["place_id"]:
            return (True, DedupeMatchType.PLACE_ID, keys["place_id"][place_id.lower()])

        if source_url and source_url.lower() in keys["source_url"]:
            return (True, DedupeMatchType.SOURCE_URL, keys["source_url"][source_url.lower()])

        if email and email.lower() in keys["email"]:
            return (True, DedupeMatchType.EMAIL, keys["email"][email.lower()])

        if phone:
            # Normalize phone (remove spaces, dashes)
            normalized_phone = phone.replace(" ", "").replace("-", "").lower()
            if normalized_phone in keys["phone"]:
                return (True, DedupeMatchType.PHONE, keys["phone"][normalized_phone])

        # Soft match - returns match but doesn't block
        if name_city and name_city.lower() in keys["name_city"]:
            return (False, DedupeMatchType.NAME_CITY, keys["name_city"][name_city.lower()])

        return (False, None, None)

    # =========================================================================
    # RUN LOG OPERATIONS
    # =========================================================================

    def get_run_log_tab(self) -> gspread.Worksheet:
        """Get the run_log worksheet."""
        return self.get_or_create_tab(SHEETS_TABS["run_log"], RunLogEntry.headers())

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def append_run_log(self, entry: RunLogEntry):
        """Append an entry to the run log."""
        sheet = self.get_run_log_tab()
        sheet.append_rows([entry.to_sheets_row()], value_input_option="USER_ENTERED")

    @retry_on_rate_limit(max_retries=3, base_delay=2.0)
    def update_run_log(self, run_id: str, **kwargs):
        """Update a run log entry."""
        sheet = self.get_run_log_tab()
        all_rows = sheet.get_all_values()
        headers = all_rows[0]

        col_run_id = headers.index("run_id")

        for row_idx, row in enumerate(all_rows[1:], start=2):
            if row[col_run_id] == run_id:
                for field, value in kwargs.items():
                    if field in headers:
                        col = headers.index(field)
                        if isinstance(value, datetime):
                            value = value.isoformat()
                        sheet.update_cell(row_idx, col + 1, value)
                return

    # =========================================================================
    # EMAIL BLOCKLIST OPERATIONS
    # =========================================================================

    def get_blocklist_tab(self) -> gspread.Worksheet:
        """Get the email_blocklist worksheet."""
        return self.get_or_create_tab(
            SHEETS_TABS["email_blocklist"],
            ["email", "reason", "added_at"]
        )

    def get_blocked_emails(self) -> Set[str]:
        """
        Get all blocked email addresses.

        Returns:
            Set of blocked email addresses (lowercase)
        """
        sheet = self.get_blocklist_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return set()

        return {row[0].lower() for row in all_rows[1:] if row}

    def add_to_blocklist(self, email: str, reason: str):
        """
        Add an email to the blocklist.

        Args:
            email: Email address to block
            reason: Reason for blocking (e.g., "bounced", "complained")
        """
        sheet = self.get_blocklist_tab()
        sheet.append_rows(
            [[email.lower(), reason, datetime.utcnow().isoformat()]],
            value_input_option="USER_ENTERED"
        )

    # =========================================================================
    # SAFETY METRICS
    # =========================================================================

    def get_safety_metrics(self, lookback_days: int = 7) -> Dict[str, Any]:
        """
        Calculate safety metrics for the lookback period.

        Args:
            lookback_days: Number of days to look back

        Returns:
            Dict with bounce_count, complaint_count, total_sent, bounce_rate, complaint_rate
        """
        from datetime import timedelta

        sheet = self.get_leads_tab()
        all_rows = sheet.get_all_values()

        if len(all_rows) < 2:
            return {
                "bounce_count": 0,
                "complaint_count": 0,
                "total_sent": 0,
                "bounce_rate": 0.0,
                "complaint_rate": 0.0,
            }

        headers = all_rows[0]
        col_sent_at = headers.index("sent_at")
        col_bounced_at = headers.index("bounced_at")
        col_complained_at = headers.index("complained_at")

        cutoff = datetime.utcnow() - timedelta(days=lookback_days)

        total_sent = 0
        bounce_count = 0
        complaint_count = 0

        for row in all_rows[1:]:
            if len(row) <= max(col_sent_at, col_bounced_at, col_complained_at):
                continue

            sent_at_str = row[col_sent_at]
            if not sent_at_str:
                continue

            try:
                sent_at = datetime.fromisoformat(sent_at_str)
                if sent_at < cutoff:
                    continue

                total_sent += 1

                if row[col_bounced_at]:
                    bounce_count += 1

                if row[col_complained_at]:
                    complaint_count += 1

            except Exception:
                continue

        bounce_rate = (bounce_count / total_sent) if total_sent > 0 else 0.0
        complaint_rate = (complaint_count / total_sent) if total_sent > 0 else 0.0

        return {
            "bounce_count": bounce_count,
            "complaint_count": complaint_count,
            "total_sent": total_sent,
            "bounce_rate": bounce_rate,
            "complaint_rate": complaint_rate,
        }
