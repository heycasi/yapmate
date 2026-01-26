# Cron Setup for YapMate Sales Automation

**Date:** 2026-01-14  
**Purpose:** Automated weekday email sends (morning 10:00, evening 19:00 UK time)

---

## Files Created

### Shell Scripts (in main repo)
- `scripts/run_morning_sales.sh` - Morning send wrapper
- `scripts/run_evening_sales.sh` - Evening send wrapper

### Documentation
- `CRON_SETUP_SALES_AUTOMATION.md` - This file

---

## How It Works

**Scripts handle:**
- Starting from `/Users/conzo/dev/yapmate`
- Changing into `/Users/conzo/dev/yapmate/yapmate-leads`
- Activating venv automatically (via absolute path)
- Running `send_scheduled.py` with correct `--window` flag
- Logging to `logs/morning_sales_YYYYMMDD.log` or `logs/evening_sales_YYYYMMDD.log`

**Cron handles:**
- Running scripts at correct times (UK time)
- Weekdays only (Mon-Fri)

---

## Setup Cron (macOS)

### Step 1: Open Crontab Editor

```bash
crontab -e
```

This opens your crontab in the default editor (usually `vi` or `nano`).

### Step 2: Add These Lines

**For vi editor:** Press `i` to insert, then paste:
**For nano editor:** Just paste

```cron
# YapMate Sales Automation - Morning Send (10:00 UK time, weekdays)
0 10 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_morning_sales.sh

# YapMate Sales Automation - Evening Send (19:00 UK time, weekdays)
0 19 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
```

**Cron format:** `minute hour day month weekday`
- `0 10 * * 1-5` = 10:00 AM, every day, every month, Mon-Fri
- `0 19 * * 1-5` = 19:00 (7 PM), every day, every month, Mon-Fri

**Note:** macOS cron uses your system timezone. Make sure your Mac is set to UK time (Europe/London) for this to work correctly.

### Step 3: Save and Exit

**For vi:** Press `Esc`, type `:wq`, press Enter  
**For nano:** Press `Ctrl+O` (save), `Enter`, then `Ctrl+X` (exit)

### Step 4: Verify Crontab

```bash
crontab -l
```

Should show your two cron jobs.

---

## Testing Manual Execution

### Test Morning Script

```bash
/Users/conzo/dev/yapmate/scripts/run_morning_sales.sh
```

**Expected:**
- Script runs without errors
- Output goes to `logs/morning_sales_YYYYMMDD.log`
- Python script executes with `--window morning`
- Uses `MORNING_LIMIT` env var (or default 10)

### Test Evening Script

```bash
/Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
```

**Expected:**
- Script runs without errors
- Output goes to `logs/evening_sales_YYYYMMDD.log`
- Python script executes with `--window evening`
- Uses `EVENING_LIMIT` env var (or default 10)

---

## How to Disable Automation

### Option A: Comment Out Cron Jobs

1. Edit crontab: `crontab -e`
2. Add `#` at start of each line:
   ```cron
   # 0 10 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_morning_sales.sh
   # 0 19 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
   ```
3. Save and exit

### Option B: Remove Cron Jobs

```bash
crontab -e
# Delete the two lines
# Save and exit
```

### Option C: Disable Cron Temporarily

```bash
# Stop cron service (macOS)
sudo launchctl unload -w /System/Library/LaunchDaemons/com.apple.cron.plist

# Start cron service again
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.cron.plist
```

---

## Verification Checklist

After setup, verify:

**1. Manual Test:**
- [ ] `run_morning_sales.sh` executes successfully
- [ ] `run_evening_sales.sh` executes successfully
- [ ] Log files created in `logs/` directory
- [ ] Logs show which window ran (morning/evening)
- [ ] No APPROVED leads → no emails sent (expected)
- [ ] APPROVED leads → emails sent (if any exist)

**2. Cron Setup:**
- [ ] `crontab -l` shows both jobs
- [ ] Times are correct (10:00 and 19:00)
- [ ] Weekdays only (`1-5` = Mon-Fri)

**3. After First Automated Run:**
- [ ] Scripts run at scheduled times
- [ ] Logs are created with correct timestamps
- [ ] No errors in logs

---

## Logs

**Location:** `/Users/conzo/dev/yapmate/logs/`

**Files:**
- `morning_sales_YYYYMMDD.log` - Morning send logs (one per day)
- `evening_sales_YYYYMMDD.log` - Evening send logs (one per day)

**View logs:**
```bash
# View today's morning log
tail -f /Users/conzo/dev/yapmate/logs/morning_sales_$(date +%Y%m%d).log

# View today's evening log
tail -f /Users/conzo/dev/yapmate/logs/evening_sales_$(date +%Y%m%d).log

# List all logs
ls -la /Users/conzo/dev/yapmate/logs/
```

---

## Important Notes

### Timezone
**macOS cron uses system timezone.** If your Mac is set to UK time (Europe/London), the cron jobs will run at UK times:
- Morning: 10:00 UK time
- Evening: 19:00 UK time

**If your Mac is in a different timezone:**
- Adjust cron times accordingly
- Or set `TZ` environment variable in crontab

### Limits
- Limits are controlled by `MORNING_LIMIT` and `EVENING_LIMIT` env vars in `yapmate-leads/.env`
- Scripts use these automatically (no hardcoding)
- Defaults to 10 if not set

### Safety
- **Scripts only send emails for APPROVED leads** (handled by `send_approved_leads`)
- **Manual approval required** - automation cannot approve leads
- **Idempotent** - Safe to run multiple times (won't resend)

---

## Troubleshooting

**Script fails:**
- Check `logs/` directory exists: `mkdir -p /Users/conzo/dev/yapmate/logs`
- Check Python exists: `ls -la /Users/conzo/dev/yapmate/yapmate-leads/venv/bin/python`
- Check script is executable: `chmod +x scripts/run_morning_sales.sh`

**Cron not running:**
- Check cron service: `ps aux | grep cron`
- Check system timezone: `date`
- Check crontab exists: `crontab -l`

**Logs not created:**
- Check permissions: `ls -la /Users/conzo/dev/yapmate/logs/`
- Check cron output: `grep CRON /var/log/system.log` (macOS)

---

**Status:** ✅ Scripts created and ready to use!
