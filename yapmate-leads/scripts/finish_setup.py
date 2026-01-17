import os
import json
import shutil
import glob
import re

# 1. FIND AND MOVE THE KEY
user_home = os.path.expanduser("~")
downloads_path = os.path.join(user_home, "Downloads")
search_pattern = os.path.join(downloads_path, "yapmate-*.json")
found_files = glob.glob(search_pattern)

print("\n🔍 Looking for key in Downloads...")

if found_files:
    latest_file = max(found_files, key=os.path.getctime) # Get the newest one
    shutil.move(latest_file, "credentials.json")
    print(f"✅ Found and moved: {os.path.basename(latest_file)}")
else:
    if os.path.exists("credentials.json"):
        print("✅ credentials.json already exists in this folder.")
    else:
        print("❌ Could not find a 'yapmate-*.json' file in Downloads!")
        print("   Please find it manually and drag it into this folder named 'credentials.json'")
        exit()

# 2. GET ROBOT EMAIL
try:
    with open("credentials.json", "r") as f:
        data = json.load(f)
        robot_email = data.get("client_email")
        
    print("\n" + "="*60)
    print("👉  STEP 1: COPY THIS EMAIL:")
    print(f"\n    \033[92m{robot_email}\033[0m\n") # Green text
    print("="*60)
    print("1. Go to your Google Sheet.")
    print("2. Click SHARE (top right).")
    print("3. Paste this email and send as EDITOR.")
    input("\n⌨️  Press ENTER once you have shared the sheet...")
except Exception as e:
    print(f"❌ Error reading credentials.json: {e}")
    exit()

# 3. CONFIGURE SHEET ID
print("\n👉  STEP 2: LINK THE SHEET")
sheet_url = input("Paste your Google Sheet URL here: ").strip()

# Extract ID between /d/ and /edit
match = re.search(r'/d/([a-zA-Z0-9-_]+)', sheet_url)

if match:
    sheet_id = match.group(1)
    print(f"✅ Detected Sheet ID: {sheet_id}")
    
    # Save to .env
    env_content = ""
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            lines = f.readlines()
            # Remove old ID if exists
            env_content = "".join([l for l in lines if "GOOGLE_SHEET_ID" not in l])
    
    with open(".env", "w") as f:
        f.write(env_content)
        if not env_content.endswith("\n") and env_content:
            f.write("\n")
        f.write(f"GOOGLE_SHEET_ID={sheet_id}\n")
    
    print("✅ Saved to .env configuration.")
    print("\n🎉 SETUP COMPLETE! You can now run the sender.")
else:
    print("❌ Could not find a valid ID in that URL. Please try again.")
