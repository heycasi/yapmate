import os
import gspread
from google.oauth2.service_account import Credentials

class SheetsManager:
    def __init__(self, **kwargs):
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]

        creds_path = os.path.join(os.getcwd(), "credentials.json")
        if not os.path.exists(creds_path):
            raise FileNotFoundError(f"Could not find credentials.json at {creds_path}")

        credentials = Credentials.from_service_account_file(creds_path, scopes=scopes)
        self.client = gspread.authorize(credentials)

        sheet_id = os.getenv("GOOGLE_SHEET_ID") or kwargs.get("sheet_id")
        if not sheet_id:
            raise ValueError("GOOGLE_SHEET_ID is missing from .env file")

        print(f"📊 Connecting to Google Sheet ID: {sheet_id}...")
        self.sheet = self.client.open_by_key(sheet_id).sheet1

    def get_existing_dedup_keys(self):
        """
        Build dedup keys from existing rows.
        Format: email|trade|city
        """
        try:
            rows = self.sheet.get_all_records()
            keys = set()

            for row in rows:
                email = str(row.get("email", "")).strip().lower()
                trade = str(row.get("trade", "")).strip().lower()
                city = str(row.get("city", "")).strip().lower()

                if email:
                    keys.add(f"{email}|{trade}|{city}")

            return keys
        except Exception as e:
            print(f"⚠️ Error building dedup keys: {e}")
            return set()

    def append_leads(self, leads):
        """
        Append lead objects or dicts to the Google Sheet using header order.
        Returns number of rows added.
        """
        if not leads:
            return 0

        try:
            headers = self.sheet.row_values(1)
            rows = []
            skipped_no_email = 0

            for lead in leads:
                # Flatten EnrichedLead objects properly
                data = self._flatten_lead(lead)

                # Debug: print first lead's keys to verify mapping
                if not rows:
                    print(f"   [debug] Lead keys: {list(data.keys())}")
                    print(f"   [debug] Email value: '{data.get('email', '')}'")

                # Guard: skip leads with missing email
                email_val = str(data.get("email") or "").strip()
                if not email_val:
                    skipped_no_email += 1
                    continue

                row = []
                for h in headers:
                    val = data.get(h, "")
                    row.append("" if val is None else str(val))

                rows.append(row)

            if skipped_no_email > 0:
                print(f"   ⚠️ Skipped {skipped_no_email} leads due to missing email")

            if rows:
                self.sheet.append_rows(rows, value_input_option="USER_ENTERED")
            return len(rows)

        except Exception as e:
            print(f"⚠️ Error appending leads: {e}")
            return 0

    def _flatten_lead(self, lead):
        """
        Convert EnrichedLead or dict to flat dict matching sheet headers.
        """
        if isinstance(lead, dict):
            return lead

        # Handle EnrichedLead objects (which have nested Lead)
        data = {}

        # Get top-level EnrichedLead attributes
        if hasattr(lead, 'ai_hook'):
            data['ai_hook'] = lead.ai_hook
        if hasattr(lead, 'timestamp'):
            data['timestamp'] = lead.timestamp.strftime('%Y-%m-%d %H:%M:%S') if lead.timestamp else ""
        if hasattr(lead, 'status'):
            data['status'] = lead.status

        # Flatten nested Lead object
        if hasattr(lead, 'lead') and lead.lead:
            inner = lead.lead
            data['business_name'] = getattr(inner, 'business_name', '')
            data['email'] = getattr(inner, 'email', '') or ''
            data['phone'] = getattr(inner, 'phone', '') or ''
            data['website'] = getattr(inner, 'website', '') or ''
            data['trade'] = getattr(inner, 'trade', '')
            data['city'] = getattr(inner, 'city', '')
            data['lead_source'] = getattr(inner, 'lead_source', '')

        return data
    def get_approved_leads(self):
        """Get all rows where status is APPROVED"""
        try:
            rows = self.sheet.get_all_records()
            return [
                r for r in rows
                if str(r.get("status", "")).upper().strip() == "APPROVED"
            ]
        except Exception as e:
            print(f"⚠️ Error reading rows: {e}")
            return []

    def update_status(self, row_idx, new_status):
        """Update the status column for a specific row"""
        headers = self.sheet.row_values(1)
        if "status" not in headers:
            print("⚠️ 'status' column not found")
            return

        col_idx = headers.index("status") + 1
        self.sheet.update_cell(row_idx + 2, col_idx, new_status)
