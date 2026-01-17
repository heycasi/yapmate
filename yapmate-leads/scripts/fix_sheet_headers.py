import os
import gspread
from google.oauth2.service_account import Credentials

# 1. Setup connection
scopes = ["https://www.googleapis.com/auth/spreadsheets"]
creds_path = os.path.join(os.getcwd(), "credentials.json")

print("🔌 Connecting to Google Sheets...")
creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
client = gspread.authorize(creds)

# 2. Get the Sheet ID from .env
sheet_id = None
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.startswith("GOOGLE_SHEET_ID="):
                sheet_id = line.strip().split("=")[1]
                break

if not sheet_id:
    print("❌ Error: Could not find GOOGLE_SHEET_ID in .env")
    exit()

# 3. Fix the Headers
try:
    sheet = client.open_by_key(sheet_id).sheet1
    
    print(f"📊 Accessing Sheet: {sheet.title}")
    print("🧹 Overwriting headers to match new code...")
    
    # THE CORRECT HEADERS (Must match send_approved.py)
    new_headers = ["business_name", "email", "trade", "city", "status"]
    
    # Update Row 1
    sheet.update("A1:E1", [new_headers])
    
    # Add a test row so the sender has something to find
    print("✍️  Adding a test row...")
    test_row = ["Test Plumbing Co", "connor@yapmate.co.uk", "Plumber", "Glasgow", "APPROVED"]
    sheet.update("A2:E2", [test_row])
    
    print("\n✅ SUCCESS! Headers are fixed.")
    print(f"   Columns are now: { ' | '.join(new_headers) }")

except Exception as e:
    print(f"❌ Error: {e}")
