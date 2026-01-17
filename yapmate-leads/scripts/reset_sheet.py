import os
import gspread
from google.oauth2.service_account import Credentials

# 1. Connect
scopes = ["https://www.googleapis.com/auth/spreadsheets"]
creds_path = os.path.join(os.getcwd(), "credentials.json")
creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
client = gspread.authorize(creds)

sheet_id = os.getenv("GOOGLE_SHEET_ID")
if not sheet_id:
    # Try to find it in .env manually
    with open(".env") as f:
        for line in f:
            if line.startswith("GOOGLE_SHEET_ID="):
                sheet_id = line.strip().split("=")[1]
                break

print(f"🔌 Connecting to Sheet ID: {sheet_id}...")
sheet = client.open_by_key(sheet_id).sheet1

# 2. Force the correct headers
print("🧹 Resetting headers to: business_name | email | status")
headers = ["business_name", "email", "status"]
sheet.update('A1:C1', [headers])

# 3. Add a fresh test row
print("✍️  Adding a test row...")
test_row = ["Reset Test Corp", "connor@yapmate.co.uk", "APPROVED"]
sheet.update('A2:C2', [test_row])

print("\n✅ Sheet Fixed! You can now run the sender.")
