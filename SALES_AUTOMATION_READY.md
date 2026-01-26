# Sales Automation - Ready to Set Up

**Date:** 2026-01-14  
**Status:** ✅ Scripts created, needs manual setup

---

## Files Created

### Shell Scripts
- `scripts/run_morning_sales.sh` - Morning send wrapper (10:00 UK time)
- `scripts/run_evening_sales.sh` - Evening send wrapper (19:00 UK time)

### Documentation
- `CRON_SETUP_SALES_AUTOMATION.md` - Complete cron setup guide

---

## Quick Setup (3 Steps)

### Step 1: Make Scripts Executable

```bash
chmod +x /Users/conzo/dev/yapmate/scripts/run_morning_sales.sh
chmod +x /Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
```

### Step 2: Test Scripts Manually

**Test Morning:**
```bash
/Users/conzo/dev/yapmate/scripts/run_morning_sales.sh
```

**Test Evening:**
```bash
/Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
```

**Expected:**
- Script runs successfully
- Log created in `logs/morning_sales_YYYYMMDD.log` or `logs/evening_sales_YYYYMMDD.log`
- Python script executes with correct `--window` flag

### Step 3: Set Up Cron

```bash
crontab -e
```

**Add these lines:**
```cron
# YapMate Sales Automation - Morning Send (10:00 UK time, weekdays)
0 10 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_morning_sales.sh

# YapMate Sales Automation - Evening Send (19:00 UK time, weekdays)
0 19 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
```

**Save and exit** (vi: `Esc`, `:wq` | nano: `Ctrl+O`, `Ctrl+X`)

**Verify:**
```bash
crontab -l
```

Should show both jobs.

---

## What Scripts Do

**Both scripts:**
1. Start from `/Users/conzo/dev/yapmate` (absolute path)
2. Change into `/Users/conzo/dev/yapmate/yapmate-leads`
3. Use venv Python: `yapmate-leads/venv/bin/python`
4. Run: `scripts/send_scheduled.py --window {morning|evening}`
5. Log to: `logs/{morning|evening}_sales_YYYYMMDD.log`

**Automation only** - no changes to business logic:
- Uses existing `send_scheduled.py`
- Uses existing `MORNING_LIMIT` / `EVENING_LIMIT` env vars
- Respects approval status (only sends APPROVED leads)

---

## How to Disable

**Comment out in crontab:**
```bash
crontab -e
# Add # at start of each line:
# 0 10 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_morning_sales.sh
# 0 19 * * 1-5 /Users/conzo/dev/yapmate/scripts/run_evening_sales.sh
```

---

## Verification

After setup, check:

**Manual test:**
- [ ] `run_morning_sales.sh` executes
- [ ] `run_evening_sales.sh` executes
- [ ] Logs created in `logs/` directory
- [ ] Logs show window (morning/evening)

**Cron test:**
- [ ] `crontab -l` shows both jobs
- [ ] Jobs run at scheduled times
- [ ] Logs created with timestamps

**Expected behavior:**
- No APPROVED leads → No emails sent (expected, logged)
- APPROVED leads → Emails sent (if any exist)
- SENT leads → Not resent (idempotent)

---

## Full Documentation

See: `CRON_SETUP_SALES_AUTOMATION.md` for complete guide.

---

**Ready to set up!** Run Step 1-3 above. 🚀
