# YapMate Digital Sales Agent

Automated lead generation system for YapMate. Scrapes UK tradespeople from Google Maps, enriches with AI-generated personalized hooks, and outputs to Google Sheets.

## Quick Start

```bash
# Install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run dry-run test (no Google Sheets needed)
python -m src.main --trade Plumber --city Glasgow --max 5 --dry-run
```

## Features

- **Scrapes Google Maps** via Apify API (only leads with emails)
- **Deduplicates** using `business_name|city` composite key
- **AI enrichment** using OpenAI GPT-4o for personalized hooks
- **"Mate-to-mate" tone** - casual, peer-to-peer, no corporate jargon
- **Contextual hooks** based on location (accent cities) or website presence
- **Google Sheets** integration for lead storage and management

## Setup

### 1. Environment Configuration

Your `.env` file is already configured with Apify and OpenAI API keys.

**Remaining setup:**
1. Add Google Service Account credentials (see Google Sheets Setup below)
2. Create a Google Sheet and add its ID to `.env`

### 2. Google Sheets Setup

#### Create Google Service Account

1. Go to https://console.cloud.google.com/
2. Create a new project (e.g., "YapMate Leads")
3. Enable Google Sheets API and Google Drive API
4. Create Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name: `yapmate-leads-service`
   - Click "Create and Continue"
   - Role: Editor (or custom with Sheets/Drive access)
   - Click "Done"
5. Click on the service account → Keys → Add Key → Create New Key → JSON
6. Download the JSON file and save as `credentials.json` in project root

#### Create Google Sheet

1. Go to https://sheets.google.com
2. Create a new sheet named "YapMate Leads"
3. Add headers in row 1:
   ```
   timestamp | business_name | contact_name | email | phone | website | trade | city | ai_hook | lead_source | status
   ```
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```
5. Share the sheet with the service account email (found in `credentials.json` under `client_email`)
   - Click "Share" → Paste service account email → Editor access

6. Update `.env`:
   ```bash
   GOOGLE_SHEETS_MASTER_SHEET_ID=your_sheet_id_here
   ```

### 3. Verify Setup

```bash
# Test Apify + OpenAI (no Sheets needed)
python -m src.main --trade Plumber --city Glasgow --max 5 --dry-run
```

Expected output:
- Scrapes 5 plumbers from Google Maps
- Enriches with AI hooks
- Displays sample leads (no write to Sheets)

## Usage

### Basic Commands

```bash
# Scrape 50 plumbers in Glasgow
python -m src.main --trade Plumber --city Glasgow

# Scrape 100 electricians in Liverpool
python -m src.main --trade Electrician --city Liverpool --max 100

# Test without saving (dry-run)
python -m src.main --trade Builder --city Newcastle --dry-run
```

### CLI Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--trade` | Yes | - | Trade type (Plumber, Electrician, Builder) |
| `--city` | Yes | - | UK city (Glasgow, Liverpool, Manchester) |
| `--max` | No | 50 | Max leads to scrape |
| `--dry-run` | No | False | Test mode (no Sheets write) |

### Example Output

```
🚀 YapMate Lead Generator
   Trade: Plumber
   City: Glasgow
   Max Leads: 50
   Dry Run: False

🔍 Scraping Google Maps for Plumbers in Glasgow...
✅ Found 42 Plumbers with email addresses in Glasgow

📋 Found 120 existing leads in sheet
🔍 Filtered out 15 duplicate leads
✅ 27 unique leads ready for enrichment

🤖 Enriching 27 leads with AI hooks...
  [1/27] ✓ ABC Plumbing Ltd
  [2/27] ✓ Glasgow Gas Services
  ...
  [27/27] ✓ Heating Heroes
✅ Successfully enriched 27/27 leads

📊 Appending 27 leads to Google Sheet...
✅ Successfully added 27 leads to sheet

✅ Pipeline complete! Added 27 new leads to Google Sheets
```

## AI Hook Examples

**Accent Cities (Glasgow, Liverpool, Newcastle):**
```
"Ever try telling Siri your invoice details with a Glaswegian accent? YapMate actually gets it."
```

**No Website:**
```
"No website, no problem. Just speak your invoice and you're done."
```

**Default:**
```
"30 seconds to invoice after a 12-hour shift. No typing, no faff."
```

## Deduplication

Uses `business_name|city` composite key:
- Same business in different cities = 2 separate leads
- Same business in same city = duplicate (filtered out)
- Case-insensitive matching

**Example:**
- `ABC Plumbing|Glasgow` ≠ `ABC Plumbing|Liverpool` → Both allowed
- `ABC Plumbing|Glasgow` = `abc plumbing|glasgow` → Duplicate

## Cost Estimation

**Per Lead:** ~$0.0004
- Apify: ~$0.00001
- OpenAI GPT-4o: ~$0.0004

**Monthly Scenarios:**
- 10 leads/day = ~$0.12/month
- 50 leads/day = ~$0.62/month
- 200 leads/day = ~$2.50/month
- 1,000 leads/day = ~$12.50/month

## Troubleshooting

### "Invalid API key"
Check `.env` file has correct `OPENAI_API_KEY` and `APIFY_API_TOKEN`

### "Permission denied" (Google Sheets)
Ensure you shared the Google Sheet with the service account email from `credentials.json`

### "No results found"
Try different city or trade. Apify only returns leads with email addresses.

### "Rate limit exceeded" (OpenAI)
Reduce batch size with `--max 10` or wait and retry

## Project Structure

```
yapmate-leads/
├── .env                    # API keys (already configured)
├── .env.example           # Template
├── .gitignore             # Excludes secrets
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── config/
│   └── prompts.py        # OpenAI system prompt
├── src/
│   ├── main.py           # CLI entry point
│   ├── models.py         # Data models (Lead, EnrichedLead)
│   ├── apify_client.py   # Google Maps scraper
│   ├── enricher.py       # AI hook generation
│   ├── sheets_manager.py # Google Sheets integration
│   └── deduplicator.py   # Duplicate filtering
└── tests/                # Unit tests (TBD)
```

## Next Steps

1. **Setup Google Sheets** (see Setup section above)
2. **Run dry-run test** to verify Apify + OpenAI work
3. **Run real test** with `--max 5` to verify Sheets integration
4. **Scale up** once verified (remove `--max` limit)
5. **Automate** with cron jobs (see plan file for examples)

## Support

For issues or questions, see the full implementation plan at:
`/Users/conzo/.claude/plans/quirky-percolating-catmull.md`
