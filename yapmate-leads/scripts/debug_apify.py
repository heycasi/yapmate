"""Debug script to test Apify Google Maps scraper."""

import os
import json
from dotenv import load_dotenv
from apify_client import ApifyClient

# Load environment variables
load_dotenv()

# Initialize Apify client
api_token = os.getenv("APIFY_API_TOKEN")
actor_id = os.getenv("APIFY_ACTOR_ID")

print("=" * 80)
print("APIFY DEBUG SCRIPT")
print("=" * 80)
print(f"\nAPI Token: {api_token[:20]}... (first 20 chars)")
print(f"Actor ID: {actor_id}")
print("\nSearch Query: Plumbers in Glasgow, UK")
print("Email Filter: FALSE (showing ALL businesses, not just those with emails)")
print("\n" + "=" * 80 + "\n")

client = ApifyClient(api_token)

# Configure actor input - HARDCODED for debugging
run_input = {
    "searchStringsArray": ["Plumbers in Glasgow, UK"],
    "maxCrawledPlacesPerSearch": 50,
    "language": "en",
    "countryCode": "gb",
    "includeHistogram": False,
    "includeOpeningHours": False,
    "includePeopleAlsoSearch": False,
    "maxReviews": 0,
    "maxImages": 0,
    "exportPlaceUrls": False,
    "additionalInfo": False,
    "emailsOnly": False  # CRITICAL: Set to False for debugging
}

print("🔍 Starting Apify actor...")
print(f"   Actor ID: {actor_id}")
print(f"   Max results: 50")
print(f"   Email filter: OFF\n")

# Run actor and wait for results
try:
    run = client.actor(actor_id).call(run_input=run_input)
    print(f"✅ Actor run completed successfully")
    print(f"   Run ID: {run.get('id')}")
    print(f"   Status: {run.get('status')}")
    print(f"   Default Dataset ID: {run.get('defaultDatasetId')}\n")
except Exception as e:
    print(f"❌ Actor run FAILED: {str(e)}\n")
    exit(1)

# Fetch results
print("📊 Fetching results from dataset...\n")

items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
total_items = len(items)

print("=" * 80)
print(f"TOTAL RESULTS FOUND: {total_items}")
print("=" * 80)

if total_items == 0:
    print("\n❌ NO RESULTS FOUND")
    print("   This means the Apify actor is not finding ANY businesses at all.")
    print("   Possible issues:")
    print("   - Apify actor might be broken or changed")
    print("   - Search query format might be wrong")
    print("   - Apify account might be out of credits")
    print("   - Actor ID might be incorrect")
else:
    print(f"\n✅ Found {total_items} businesses\n")

    # Count how many have emails
    with_email = sum(1 for item in items if item.get("email"))
    without_email = total_items - with_email

    print(f"📧 Email Analysis:")
    print(f"   With email: {with_email}")
    print(f"   Without email: {without_email}")
    print(f"   Email coverage: {(with_email/total_items*100):.1f}%\n")

    # Show first 2 results in detail
    print("=" * 80)
    print("FIRST 2 RESULTS (RAW JSON)")
    print("=" * 80)

    for i, item in enumerate(items[:2], 1):
        print(f"\n--- RESULT {i} ---")
        print(json.dumps(item, indent=2, ensure_ascii=False))
        print("")

    # Summary of key fields
    print("=" * 80)
    print("SUMMARY OF ALL RESULTS")
    print("=" * 80)

    for i, item in enumerate(items, 1):
        title = item.get("title", "NO TITLE")
        email = item.get("email", "NO EMAIL")
        phone = item.get("phone", "NO PHONE")
        website = item.get("website", "NO WEBSITE")

        print(f"\n{i}. {title}")
        print(f"   Email: {email}")
        print(f"   Phone: {phone}")
        print(f"   Website: {website[:50] if website and website != 'NO WEBSITE' else website}")

print("\n" + "=" * 80)
print("DEBUG COMPLETE")
print("=" * 80)
