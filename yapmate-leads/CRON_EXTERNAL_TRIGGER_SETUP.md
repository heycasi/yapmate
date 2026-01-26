# External Cron Trigger Setup for GitHub Actions

GitHub scheduled workflows are not triggering. This document provides external cron configuration using cron-job.org.

## Prerequisites

1. **GitHub Personal Access Token** with `repo` and `workflow` scope
   - Go to: https://github.com/settings/tokens/new
   - Select: `repo` (Full control) and `workflow`
   - Generate and copy the token
   - Store as GitHub secret: `CRON_TRIGGER_TOKEN`

## cron-job.org Configuration

### Lead Sequencer (4x daily)

**UK Times:** 09:00, 13:00, 18:00, 21:00 (every day)
**UTC Times (Winter/GMT):** Same as UK

Create 4 cron jobs at https://cron-job.org:

#### Job 1: Sequencer 09:00 UTC
- **URL:** `https://api.github.com/repos/heycasi/yapmate/actions/workflows/sequencer.yml/dispatches`
- **Schedule:** `0 9 * * *`
- **Method:** POST
- **Headers:**
  ```
  Accept: application/vnd.github.v3+json
  Authorization: Bearer YOUR_GITHUB_TOKEN
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {"ref":"main","inputs":{"skip_time_guard":"true"}}
  ```

#### Job 2: Sequencer 13:00 UTC
- **Schedule:** `0 13 * * *`
- (Same URL, headers, body as Job 1)

#### Job 3: Sequencer 18:00 UTC
- **Schedule:** `0 18 * * *`
- (Same URL, headers, body as Job 1)

#### Job 4: Sequencer 21:00 UTC
- **Schedule:** `0 21 * * *`
- (Same URL, headers, body as Job 1)

---

### Email Sender (5x daily, weekdays)

**UK Times:** 09:00, 11:00, 13:00, 15:00, 17:00 (Mon-Fri)
**UTC Times (Winter/GMT):** Same as UK

#### Job 5: Email Sender 09:00 UTC (weekdays)
- **URL:** `https://api.github.com/repos/heycasi/yapmate/actions/workflows/email_sender.yml/dispatches`
- **Schedule:** `0 9 * * 1-5`
- **Method:** POST
- **Headers:**
  ```
  Accept: application/vnd.github.v3+json
  Authorization: Bearer YOUR_GITHUB_TOKEN
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {"ref":"main","inputs":{"force_run":"true","dry_run":"false"}}
  ```

#### Job 6: Email Sender 11:00 UTC (weekdays)
- **Schedule:** `0 11 * * 1-5`
- (Same URL, headers, body as Job 5)

#### Job 7: Email Sender 13:00 UTC (weekdays)
- **Schedule:** `0 13 * * 1-5`
- (Same URL, headers, body as Job 5)

#### Job 8: Email Sender 15:00 UTC (weekdays)
- **Schedule:** `0 15 * * 1-5`
- (Same URL, headers, body as Job 5)

#### Job 9: Email Sender 17:00 UTC (weekdays)
- **Schedule:** `0 17 * * 1-5`
- (Same URL, headers, body as Job 5)

---

## Quick Test (curl)

Test the trigger manually:

```bash
# Test Lead Sequencer trigger
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","inputs":{"skip_time_guard":"true"}}' \
  https://api.github.com/repos/heycasi/yapmate/actions/workflows/sequencer.yml/dispatches

# Test Email Sender trigger
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","inputs":{"force_run":"true","dry_run":"false"}}' \
  https://api.github.com/repos/heycasi/yapmate/actions/workflows/email_sender.yml/dispatches
```

## Alternative: GitHub CLI

If you have `gh` CLI configured:

```bash
# Trigger Lead Sequencer
gh workflow run sequencer.yml --ref main -f skip_time_guard=true --repo heycasi/yapmate

# Trigger Email Sender
gh workflow run email_sender.yml --ref main -f force_run=true -f dry_run=false --repo heycasi/yapmate
```

---

## Why External Cron?

GitHub Actions scheduled workflows:
- Can take 24-48 hours to start triggering on new workflows
- May be delayed by up to 1 hour during high-load periods
- Don't guarantee exact timing

External cron services provide:
- Immediate triggering
- Reliable timing
- No warm-up period needed
