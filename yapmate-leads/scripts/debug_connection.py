import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# COLORS
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

print("\n" + "="*80)
print(" 🔍  GOOGLE SHEETS CONNECTION DIAGNOSTIC")
print("="*80)

# 1. CHECK CREDENTIALS
print("\n👉 STEP 1: CHECKING CREDENTIALS FILE...")
if not os.path.exists("credentials.json"):
    print(f"{RED}❌ ERROR: credentials.json not found in this folder!{RESET}")
    exit()

try:
    with open("credentials.json", "r") as f:
        creds_data = json.load(f)
        client_email = creds_data.get("client_email")
        project_id = creds_data.get("project_id")
    print(f"✅ File found. Project: {project_id}")
    print(f"\n   {YELLOW}CURRENT ROBOT EMAIL (Copy this!):{RESET}")
    print(f"   {GREEN}{client_email}{RESET}")
except Exception as e:
    print(f"{RED}❌ ERROR reading JSON: {e}{RESET}")
    exit()

# 2. CHECK SHEET ID
print("\n👉 STEP 2: CHECKING CONFIGURATION...")
sheet_id = None
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("GOOGLE_SHEET_ID="):
                sheet_id = line.strip().split("=")[1]
                break

if not sheet_id:
    print(f"{RED}❌ ERROR: GOOGLE_SHEET_ID not found in .env file!{RESET}")
    exit()

print(f"✅ Target Sheet ID: {sheet_id}")
print(f"   URL: https://docs.google.com/spreadsheets/d/{sheet_id}/edit")

# 3. TEST CONNECTION
print("\n👉 STEP 3: TESTING CONNECTION...")
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

try:
    creds = service_account.Credentials.from_service_account_file('credentials.json', scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    
    # Try to open the sheet
    sheet = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    print(f"\n{GREEN}✅ SUCCESS! CONNECTED!{RESET}")
    print(f"   Connected to Sheet Name: '{sheet.get('properties', {}).get('title')}'")
    print("\n🎉 You are ready to send emails.")

except HttpError as err:
    print(f"\n{RED}❌ CONNECTION FAILED (Error {err.resp.status}){RESET}")
    
    if err.resp.status == 404:
        print(f"\n{YELLOW}⚠️  DIAGNOSIS: PERMISSION DENIED (The most common error){RESET}")
        print("   The robot found the door, but the lock is changed.")
        print(f"   You MUST share the sheet with: {GREEN}{client_email}{RESET}")
    elif err.resp.status == 403:
        print(f"\n{YELLOW}⚠️  DIAGNOSIS: API DISABLED{RESET}")
        print("   You need to enable the Google Sheets API in Cloud Console.")
    else:
        print(f"   Error details: {err}")

except Exception as e:
    print(f"\n{RED}❌ UNEXPECTED ERROR: {e}{RESET}")
