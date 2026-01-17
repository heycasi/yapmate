import os
import sys
import gspread
from google.oauth2.service_account import Credentials

# Add project root to path so we can import config
sys.path.append(os.getcwd())
try:
    from config.headers import SHEET_HEADERS
except ImportError:
    # Fallback if import fails
    SHEET_HEADERS = [
        "timestamp", "business_name", "contact_name", "email",
        "phone", "website", "trade", "city", "ai_hook",
        "lead_source", "status"
    ]

# Setup Connection
scopes = ["https://www.googleapis.com/auth/spreadsheets"]
creds_path = os.path.join(os.getcwd(), "credentials.json")

print("🔌 Connecting to Google Sheets...")
try:
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
except Exception as e:
    print(f"❌ Error connecting: {e}")
    exit(1)

# Get Sheet ID
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

try:
    sheet = client.open_by_key(sheet_id).sheet1
    print(f"📊 Accessing Sheet: {sheet.title}")
    
    # OVERWRITE HEADERS
    print("🧹 Overwriting headers to match Single Source of Truth...")
    sheet.update(range_name='A1:K1', values=[SHEET_HEADERS])
    
    # Add Test Row (Mapping data to the new structure)
    print("✍️  Adding a test row (Row 2)...")
    # This matches the order of SHEET_HEADERS exactly
    test_row = [
        "2024-01-01 12:00:00", # timestamp
        "Fixer Test Corp",     # business_name
        "Connor",              # contact_name
        "connor@yapmate.co.uk",# email
        "07123456789",         # phone
        "yapmate.co.uk",       # website
        "Plumber",             # trade
        "Glasgow",             # city
        "Great plumbing!",     # ai_hook
        "Manual Test",         # lead_source
        "APPROVED"             # status
    ]
    sheet.update(range_name='A2:K2', values=[test_row])
    
    print("\n✅ SUCCESS! Sheet headers are fixed.")
    print("   The columns are now aligned with your code.")

except Exception as e:
    print(f"❌ Error updating sheet: {e}")
