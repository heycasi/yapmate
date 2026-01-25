# GitHub Actions CI Setup

Full automation for the YapMate Leads City-Trade Sequencing Engine.

## Overview

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| **Lead Sequencer** | 09:00, 13:00, 18:00, 21:00 UK time | Scrapes leads from Google Maps via Apify |
| **Email Sender** | Every 15 minutes | Sends emails to eligible leads via Resend |

Both workflows:
- Run on GitHub-hosted Ubuntu runners (your MacBook can stay asleep)
- Send alert emails via Resend if the job fails
- Use GitHub Secrets for all credentials (nothing hardcoded)

---

## Required GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions → New repository secret**

### Core Secrets (REQUIRED)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `GOOGLE_SHEETS_CREDENTIALS_JSON` | Full JSON content of Google service account | See "Google Credentials" section below |
| `GOOGLE_SHEET_ID` | ID from your Google Sheet URL | The part after `/d/` in the Sheet URL |
| `RESEND_API_KEY` | Resend API key for sending emails | Resend Dashboard → API Keys |

### Scraping Secrets (REQUIRED for Sequencer)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `APIFY_API_KEY` | Apify API key for Google Maps scraper | Apify Console → Settings → API |
| `OPENAI_API_KEY` | OpenAI API key for AI enrichment | OpenAI Dashboard → API Keys |
| `SERPAPI_API_KEY` | SerpAPI key (optional, if used) | SerpAPI Dashboard |

### Email Sending Secrets (Optional)

| Secret Name | Description | Default |
|-------------|-------------|---------|
| `EMAIL_FROM` | From email address | Uses config default |
| `EMAIL_FROM_NAME` | From display name | Uses config default |
| `EMAIL_REPLY_TO` | Reply-to address | Uses config default |

### Alert Secrets (Optional but Recommended)

| Secret Name | Description | Default |
|-------------|-------------|---------|
| `ALERT_TO_EMAIL` | Where to send failure alerts | `support@yapmate.co.uk` |
| `ALERT_FROM_EMAIL` | From address for alerts | `YapMate Leads CI <support@yapmate.co.uk>` |

---

## Resend Verified Sender Requirement

Resend requires the "from" email address to be verified. For alerts:

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add and verify your domain (e.g., `yapmate.co.uk`)
3. Use any email at that domain for `ALERT_FROM_EMAIL`

**Example values:**
- `ALERT_FROM_EMAIL`: `YapMate Leads CI <alerts@yapmate.co.uk>` or `support@yapmate.co.uk`
- `ALERT_TO_EMAIL`: `support@yapmate.co.uk`

If you don't set these secrets, alerts will try to send from/to `support@yapmate.co.uk`.

---

## Google Credentials Setup

### Step 1: Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable APIs:
   - Google Sheets API
   - Google Drive API
4. Go to **IAM & Admin → Service Accounts**
5. Click **Create Service Account**
6. Name it (e.g., `yapmate-leads-ci`)
7. Click **Create and Continue** (skip optional steps)
8. Click **Done**

### Step 2: Generate JSON Key

1. Click on the service account you created
2. Go to **Keys** tab
3. Click **Add Key → Create new key**
4. Select **JSON** format
5. Download the file

### Step 3: Add as GitHub Secret

1. Open the downloaded JSON file
2. Copy the **entire contents** (including `{` and `}`)
3. In GitHub: Settings → Secrets → Actions → New secret
4. Name: `GOOGLE_SHEETS_CREDENTIALS_JSON`
5. Value: Paste the entire JSON

### Step 4: Share Google Sheet

1. Open the JSON file
2. Find the `client_email` field (looks like `name@project.iam.gserviceaccount.com`)
3. Open your Google Sheet
4. Click **Share**
5. Add the service account email with **Editor** access

---

## DST-Robust Scheduling

The Lead Sequencer handles UK daylight saving time automatically.

### How It Works

UK time shifts between:
- **GMT** (winter): UTC+0
- **BST** (summer): UTC+1

Target UK hours: **9, 13, 18, 21**

| UK Hour | GMT (Winter) UTC | BST (Summer) UTC |
|---------|------------------|------------------|
| 09:00   | 09:00            | 08:00            |
| 13:00   | 13:00            | 12:00            |
| 18:00   | 18:00            | 17:00            |
| 21:00   | 21:00            | 20:00            |

The workflow runs at **all** these UTC times: `0 8,9,12,13,17,18,20,21 * * *`

A Python time guard then checks the actual UK hour:
- If UK hour matches (9, 13, 18, or 21) → run the sequencer
- If UK hour doesn't match → skip gracefully (expected ~50% of runs)

### Example Log (Skip)

```
============================================
TIME GUARD CHECK
============================================
Current UK hour: 8
Allowed hours:   [9, 13, 18, 21]
SKIP: UK hour 8 not in allowed window
This is expected behavior for DST-robust scheduling.
============================================
```

### Example Log (Run)

```
============================================
TIME GUARD CHECK
============================================
Current UK hour: 9
Allowed hours:   [9, 13, 18, 21]
PASS: UK hour 9 is in allowed window
============================================
```

---

## Testing Workflows Manually

### Via GitHub UI

1. Go to **Actions** tab in your repository
2. Select the workflow (Lead Sequencer or Email Sender)
3. Click **Run workflow** (top right)
4. For Lead Sequencer: optionally check **Skip UK time check** to force run
5. For Email Sender: optionally set a **send limit**
6. Click **Run workflow**

### Via GitHub CLI

```bash
# Install GitHub CLI first: https://cli.github.com/

# Run sequencer (respects time guard)
gh workflow run sequencer.yml

# Run sequencer (force run, skip time check)
gh workflow run sequencer.yml -f skip_time_guard=true

# Run email sender
gh workflow run email_sender.yml

# Run email sender with limit
gh workflow run email_sender.yml -f send_limit=5

# Watch a workflow run
gh run watch
```

---

## Testing Locally

Local development is unchanged. Scripts auto-detect CI vs local mode.

```bash
# Check system status
python scripts/run_sequencer.py --status

# Run one sequencer task (manual mode)
python scripts/run_sequencer.py --manual

# Send emails only
python scripts/run_sequencer.py --send-only

# Test CI helpers
python -m src.ci_helpers --uk-hour
python -m src.ci_helpers --check-time
python -m src.ci_helpers --test-alert  # Requires RESEND_API_KEY in .env
```

---

## Expected Behavior

### Lead Sequencer

- **Runs:** 4 times per day at UK times 09:00, 13:00, 18:00, 21:00
- **Triggers:** 8 times per day in UTC (to handle DST)
- **Skips:** ~50% of triggers (normal DST behavior)
- **Duration:** 5-15 minutes per run
- **On failure:** Sends alert email, logs error details

### Email Sender

- **Runs:** Every 15 minutes (96 times per day)
- **Duration:** 1-5 minutes per run
- **Behavior:** Sends eligible emails respecting daily limits and warm-up ramp
- **On failure:** Sends alert email, logs error details

### Failure Alerts

When a workflow fails, an email is sent with:
- Workflow and job name
- Repository and branch
- Commit SHA
- Direct link to the failed run logs
- Error summary

---

## Monitoring

### View Workflow History

1. Go to **Actions** tab
2. Filter by workflow name
3. See status (success ✓, failure ✗, skipped ○)

### Check Logs

1. Click on a workflow run
2. Click on a job (e.g., `run-sequencer`)
3. Expand step logs

### Common Status Patterns

| Status | Meaning |
|--------|---------|
| ✓ Success | Task completed |
| ✓ Success (with skip) | Time guard skipped run (normal) |
| ✗ Failure | Task failed, check logs, alert sent |
| ○ Skipped | Job didn't run (e.g., alert job when main succeeded) |

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `GOOGLE_SHEETS_CREDENTIALS_JSON is not valid JSON` | Malformed secret | Re-copy entire JSON file contents |
| `Could not find credentials` | Missing secret | Add `GOOGLE_SHEETS_CREDENTIALS_JSON` secret |
| `GOOGLE_SHEET_ID is missing` | Missing secret | Add `GOOGLE_SHEET_ID` secret |
| `Permission denied` on Sheet | Sheet not shared | Share with service account email |
| Run skipped every time | Wrong UTC hours | Check your timezone, verify DST handling |
| No failure alerts | Missing RESEND_API_KEY | Add secret, verify Resend domain |
| Alert sends but not received | Unverified sender | Verify domain in Resend dashboard |

---

## Hardening Features

### Concurrency Control

Workflows use concurrency groups to prevent overlapping runs:

| Workflow | Concurrency Group | cancel-in-progress |
|----------|-------------------|-------------------|
| Lead Sequencer | `sequencer` | `true` (new run cancels old) |
| Email Sender | `email-sender` | `false` (runs queue up) |

This prevents:
- Multiple sequencer runs fighting over the same task
- Multiple email senders potentially double-sending

### Anti Double-Send (Email Idempotency)

The email sender uses a **claim-before-send** pattern:

1. **Claim**: Set lead status `NEW` → `QUEUED` (compare-and-set)
2. **Send**: If claim succeeded, send email
3. **On success**: Set status to `SENT` with timestamp and Resend message ID
4. **On failure**: Revert status to original (`NEW`) so lead isn't lost

If two concurrent runs try to send to the same lead, only one will successfully claim it.

### Timeout Guard

The sequencer has a 20-minute timeout guard for CI runs:
- Automatically enabled when `CI` or `GITHUB_ACTIONS` env var is set
- Gracefully exits with clear log message if exceeded
- Prevents CI jobs from hanging indefinitely

### Verified Sender Requirement

Resend requires verified sender domains. Required secrets:

| Secret | Must Be Verified | Example |
|--------|------------------|---------|
| `EMAIL_FROM` | Yes | `hello@yapmate.co.uk` |
| `ALERT_FROM_EMAIL` | Yes | `support@yapmate.co.uk` |

Default `ALERT_FROM_EMAIL` is `YapMate Leads CI <support@yapmate.co.uk>`.

To verify: Resend Dashboard → Domains → Add your domain → Follow DNS instructions.

---

## CI Smoke Test

### Step 1: Run Status Check Locally

```bash
python scripts/run_sequencer.py --status
```

**Expected output:**
- Shows service account email (e.g., `yapmate-leads@project.iam.gserviceaccount.com`)
- Shows queue stats, runner state, email sender stats
- No errors

### Step 2: Manual Workflow Run (Sequencer)

1. Go to **GitHub → Actions → Lead Sequencer**
2. Click **Run workflow** (top right)
3. Check **Skip UK time check** (forces run regardless of time)
4. Click **Run workflow**

**Expected result:**
- Job completes in ~5-15 minutes
- Check Google Sheet: new leads in `leads` tab, queue updated
- If no tasks pending: run `--init` locally first

### Step 3: Manual Workflow Run (Email Sender)

1. Go to **GitHub → Actions → Email Sender**
2. Click **Run workflow**
3. Optionally set **send_limit = 1** (sends just one email for testing)
4. Click **Run workflow**

**Expected result:**
- Job completes in ~2-5 minutes
- Check Google Sheet: lead status changed from `NEW` → `QUEUED` → `SENT`
- Check Resend dashboard: email sent

### Step 4: Verify Alert Emails

To test alerts without breaking things:

1. Temporarily remove `RESEND_API_KEY` secret (or rename it)
2. Run Email Sender workflow
3. It should fail
4. Check `support@yapmate.co.uk` for alert email
5. Re-add the secret

**Alert email should contain:**
- Workflow name, job name
- Link to failed run
- Error summary

### What Success Looks Like

| Check | Where to Look |
|-------|---------------|
| Sequencer ran | Google Sheet `run_log` tab has new entry |
| Leads scraped | Google Sheet `leads` tab has new rows |
| Emails sent | Google Sheet `leads` tab: status = `SENT`, `sent_at` populated |
| Resend delivery | Resend dashboard shows sent emails |
| Alerts work | Failure email received at support@yapmate.co.uk |

### Where to Look When It Fails

1. **GitHub Actions logs**: Actions → Click failed run → Click job → Expand steps
2. **Alert email**: Check support@yapmate.co.uk inbox/spam
3. **Google Sheet**: Check if tabs exist, if service account has access
4. **Resend dashboard**: Check if API key is valid, domain verified

### Expected Run Schedule

| Workflow | UTC Times | UK Times |
|----------|-----------|----------|
| Lead Sequencer | 08:00, 09:00, 12:00, 13:00, 17:00, 18:00, 20:00, 21:00 | 09:00, 13:00, 18:00, 21:00 |
| Email Sender | Every 15 minutes | Every 15 minutes |

**Note:** Sequencer runs at 8 UTC times but only executes at 4 UK times (DST handling). ~50% of runs will skip - this is normal.

---

## Cost Considerations

GitHub Actions free tier:
- **Public repos:** 2,000 minutes/month
- **Private repos:** 500 minutes/month (free) or 3,000 minutes/month (Pro)

Estimated monthly usage:
- Sequencer: ~8 triggers × 10 min × 30 days = **2,400 min** (but ~50% skip)
- Email sender: ~96 triggers × 3 min × 30 days = **8,640 min**

**Actual usage:** ~5,000-6,000 minutes/month

**Recommendations for private repos:**
1. GitHub Pro ($4/month) gives 3,000 minutes
2. Reduce email sender to every 30 min (~4,500 min/month total)
3. Use self-hosted runner (free minutes)

---

## Files Reference

| File | Purpose |
|------|---------|
| `.github/workflows/sequencer.yml` | Lead scraping workflow |
| `.github/workflows/email_sender.yml` | Email sending workflow |
| `src/ci_helpers.py` | Time guard, failure alerts |
| `src/sequencer_sheets.py` | Sheets manager (reads creds from env) |
| `scripts/run_sequencer.py` | Main entry point |
