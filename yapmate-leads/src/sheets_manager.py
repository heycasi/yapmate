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
        
        sheet_id = os.getenv("GOOGLE_SHEET_ID") or kwargs.get('sheet_id')
        if not sheet_id:
            raise ValueError("GOOGLE_SHEET_ID is missing from .env file")
            
        print(f"📊 Connecting to Google Sheet ID: {sheet_id}...")
        self.sheet = self.client.open_by_key(sheet_id).sheet1
        self.worksheet = self.sheet

    def get_approved_leads(self):
        """Get all rows where status is APPROVED"""
        try:
            all_rows = self.sheet.get_all_records()
            approved = []
            for row in all_rows:
                # Check for 'status' (lowercase)
                if str(row.get("status", "")).upper().strip() == "APPROVED":
                    approved.append(row)
            return approved
        except Exception as e:
            print(f"⚠️ Error reading rows: {e}")
            return []

    def update_status(self, row_idx, new_status):
        """Update the status column for a specific row"""
        # +2 adjustment: +1 for 0-index list, +1 for header row
        cell_row = row_idx + 2
        
        headers = self.sheet.row_values(1)
        try:
            # Look for 'status' (lowercase)
            col_idx = headers.index("status") + 1
            self.sheet.update_cell(cell_row, col_idx, new_status)
        except ValueError:
            print("⚠️ Could not update status: 'status' column not found.")
