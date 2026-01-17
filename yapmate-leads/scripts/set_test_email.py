import os
import sys
import gspread
from google.oauth2.service_account import Credentials

# 1. Setup
scopes = ["https://www.googleapis.com/auth/spreadsheets"]
creds_path = os.path.join(os.getcwd(), "credentials.json")
creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
client = gspread.authorize(creds)

# 2. Get Sheet
sheet_id = None
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.startswith("GOOGLE_SHEET_ID="):
                sheet_id = line.strip().split("=")[1]
                break

if not sheet_id:
    print("❌ Error: GOOGLE_SHEET_ID not found in .env")
    exit(1)

sheet = client.open_by_key(sheet_id).sheet1
print(f"📊 Accessing Sheet: {sheet.title}")

# 3. Update Row 2 (The Test Row)
# Column 4 is Email, Column 11 is Status (based on your new headers)
print("📝 Updating Row 2 to: connordahl@hotmail.com")

# We update the specific cells just to be safe
# D2 is Email, K2 is Status
sheet.update_acell('D2', 'connordahl@hotmail.com')
sheet.update_acell('K2', 'APPROVED')

print("✅ DONE! The lead is now set to 'connordahl@hotmail.com' and marked 'APPROVED'.")
