"""Main CLI for YapMate lead generation pipeline."""

import argparse
import os
from dotenv import load_dotenv
from src.apify_client import ApifyLeadScraper
from src.enricher import LeadEnricher
from src.sheets_manager import SheetsManager
from src.deduplicator import LeadDeduplicator
from src.email_finder import EmailFinder
from src.notifications import notify_new_leads


def main():
    # Load environment variables
    load_dotenv()

    # Parse CLI arguments
    parser = argparse.ArgumentParser(description="YapMate Lead Generation Pipeline")
    parser.add_argument("--trade", required=True, help="Trade type (e.g., Plumber, Electrician)")
    parser.add_argument("--city", required=True, help="UK city (e.g., Glasgow, Liverpool)")
    parser.add_argument("--max", type=int, default=50, help="Max leads to scrape (default: 50)")
    parser.add_argument("--dry-run", action="store_true", help="Test without saving to Sheets")
    args = parser.parse_args()

    print(f"\n🚀 YapMate Lead Generator")
    print(f"   Trade: {args.trade}")
    print(f"   City: {args.city}")
    print(f"   Max Leads: {args.max}")
    print(f"   Dry Run: {args.dry_run}\n")

    # Initialize components
    scraper = ApifyLeadScraper(
        api_token=os.getenv("APIFY_API_TOKEN"),
        actor_id=os.getenv("APIFY_ACTOR_ID")
    )

    enricher = LeadEnricher(
        api_key=os.getenv("OPENAI_API_KEY"),
        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.8"))
    )

    # Only initialize SheetsManager if not in dry-run mode
    if not args.dry_run:
        sheets = SheetsManager(
            credentials_file=os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE"),
            sheet_id=os.getenv("GOOGLE_SHEETS_MASTER_SHEET_ID"),
            worksheet_name=os.getenv("GOOGLE_SHEETS_WORKSHEET_NAME")
        )

    # Step 1: Scrape leads
    raw_leads = scraper.scrape_leads(
        trade=args.trade,
        city=args.city,
        max_results=args.max
    )

    if not raw_leads:
        print("❌ No leads found. Try different search criteria.")
        return

    # Step 2: Find missing emails from websites
    print(f"\n📧 Finding missing emails from websites...")
    email_finder = EmailFinder(timeout=10)

    leads_with_emails = 0
    leads_without_emails = 0
    emails_found_on_websites = 0

    for lead in raw_leads:
        if lead.email:
            # Already has email from Google Maps
            leads_with_emails += 1
        elif lead.website:
            # No email but has website - try to find it
            print(f"   🔍 {lead.business_name[:40]:<40} -> Checking website...", end=" ")
            found_email = email_finder.find_email_on_website(lead.website)
            if found_email:
                lead.email = found_email
                leads_with_emails += 1
                emails_found_on_websites += 1
                print(f"✓ {found_email}")
            else:
                leads_without_emails += 1
                print(f"✗ No email found")
        else:
            # No email and no website - can't find contact info
            leads_without_emails += 1

    # Filter out leads with no email
    valid_leads = [lead for lead in raw_leads if lead.email]

    print(f"\n📊 Email Discovery Summary:")
    print(f"   Direct from Google Maps: {leads_with_emails - emails_found_on_websites}")
    print(f"   Found on websites: {emails_found_on_websites}")
    print(f"   Total with email: {leads_with_emails}")
    print(f"   No email found: {leads_without_emails}")
    print(f"   Valid leads (with email): {len(valid_leads)}\n")

    if not valid_leads:
        print("❌ No leads with email addresses found.")
        return

    # Step 3: Deduplicate (skip in dry-run mode)
    if not args.dry_run:
        existing_keys = sheets.get_existing_dedup_keys()
        deduplicator = LeadDeduplicator(existing_keys)
        unique_leads = deduplicator.filter_duplicates(valid_leads)

        if not unique_leads:
            print("ℹ️  All leads were duplicates. No new leads to process.")
            return
    else:
        unique_leads = valid_leads
        print(f"✅ {len(unique_leads)} leads ready for enrichment (dry-run: no dedup)")

    # Step 4: Enrich with AI
    enriched_leads = enricher.enrich_leads(unique_leads)

    if not enriched_leads:
        print("❌ Failed to enrich any leads")
        return

    # Step 5: Save to Google Sheets (unless dry-run)
    if args.dry_run:
        print("\n🔍 DRY RUN - Not saving to Google Sheets")
        print("\nSample enriched leads:")
        for i, lead in enumerate(enriched_leads[:3], 1):
            print(f"\n{i}. {lead.lead.business_name} ({lead.lead.city})")
            print(f"   Email: {lead.lead.email}")
            print(f"   Hook: {lead.ai_hook}")
    else:
        rows_added = sheets.append_leads(enriched_leads)
        print(f"\n✅ Pipeline complete! Added {rows_added} new leads to Google Sheets")

        # Send notification (non-blocking)
        notify_new_leads(trade=args.trade, city=args.city, leads_added=rows_added)


if __name__ == "__main__":
    main()
