# YapMate Email System Updates - January 17, 2026

**Status:** ✅ COMPLETE

---

## Changes Implemented

### 1. Subject Line Rotation ✅

**Before:**
```
"Stop doing invoices at 9pm, {FirstName}"
```

**After:**
Random selection from 4 options (no personalization):
- "Stop doing invoices at 9pm"
- "Invoices done before you leave site"
- "Talk the job. Invoice done."
- "Still typing invoices at night?"

**File:** `src/templates.py` → `generate_email_subject()`

---

### 2. Remove Driving Language ✅

**Removed References:**
- ❌ "driving home"
- ❌ "while you're driving"
- ❌ "leave the driveway"
- ❌ Phone use while driving

**Replaced With:**
- ✅ "before you leave site"
- ✅ "once the job's done"
- ✅ "at the end of the day"

**Files Updated:**
- `config/prompts.py` - Updated all 15 hook examples
- `src/templates.py` - Updated email body copy

---

### 3. Accent Hook Safety ✅

**Changes:**
- Limited to 20% of sends (instructed in AI prompt)
- Removed the word "bark" entirely
- Added safer phrasing:
  - "when you just say the job out loud"
  - "when you talk it through naturally"
  - "handles your accent perfectly when you talk it through"

**Hook Example:**
- ❌ Before: "Finally, an app that actually understands a Glasgow accent when you bark an invoice at it."
- ✅ After: "Finally, an app that understands you when you just say the job out loud—no typing, no hassle."

**File:** `config/prompts.py`

---

### 4. Email Body Copy ✅

**New Email Body:**

```
Hi {BusinessName},

{AI_HOOK}

We built YapMate for trades who want invoices done without the admin.

Just talk through the job (labour, {MATERIALS}) and YapMate builds a clean PDF invoice instantly.

Handles labour, materials, VAT, CIS and Reverse Charge properly.

No typing. No forms.

[Download YapMate]

Reply if you've got any questions.

Cheers,
Connor

[Footer Image]
```

**Changes:**
- ✅ Shorter, more direct copy
- ✅ Removed "tired of late-night admin" (softer tone)
- ✅ Added "VAT, CIS and Reverse Charge" (feature clarity)
- ✅ Removed "No subscriptions until you're ready" (eliminated friction point)
- ✅ Added "Reply if you've got any questions" (conversation opener)
- ✅ Removed driving references

**File:** `src/templates.py` → `generate_email_html()`

---

### 5. CTA Update ✅

**Before:**
- Button text: "Try YapMate Free"
- Link: `https://yapmate.co.uk?utm_source=email&utm_campaign=leads`

**After:**
- Button text: "Download YapMate"
- Link: `https://yapmate.co.uk`

**Rationale:** Simpler link, clearer action (download vs. try)

**File:** `src/templates.py` → `generate_email_html()`

---

### 6. Email Branding ✅

**Footer Image:**
- Source: `EMAIL_FOOTER_IMAGE_URL` (from `.env`)
- Alt text: "YapMate – voice to invoice for UK trades"
- Single image below CTA (no additional images)

**File:** `src/templates.py` → `generate_email_html()`

---

## Updated Hook Examples (15 Total)

### Non-Accent Hooks (80% of sends):

1. "Grafted all day? Last thing you need is typing up invoices at 9pm."
2. "Stop losing cash because you forgot to add the materials—just say it once the job's done."
3. "Invoice done before you even leave site. No forms, just talk."
4. "Office software is for desks. YapMate is built for the van."
5. "Typing invoices with big thumbs on a small screen is a nightmare. Just speak it instead."
6. "Don't let admin pile up for the weekend. Speak your jobs into YapMate and get paid faster."
7. "VAT and CIS sorted automatically—just tell the app what you did and it does the math."
8. "30 seconds to explain the job, 0 seconds typing. That's how invoicing should be."
9. "Your hands are for tools, not for fighting with fiddly dropdown menus."
10. "Invoicing shouldn't be harder than the actual job. Talk, send, paid."
11. "Built for trades, not accountants. No bloat, just voice-to-invoice."
12. "Send professional PDF invoices instantly without touching a keyboard."
13. "Capture the job details before you leave site—yap it into the app and forget about it."
14. "Stop doing unpaid admin on the sofa at night. Get invoices done at the end of the day."
15. "Finally, an app that understands you when you just say the job out loud—no typing, no hassle."

### Accent Hook (20% of sends - for Glasgow/Liverpool/Newcastle):

"Handles your accent perfectly when you talk it through naturally—built for UK trades."

---

## Complete Email Example

### Subject:
```
Invoices done before you leave site
```

### Body:
```
Hi ABC Plumbing Ltd,

Invoice done before you even leave site. No forms, just talk.

We built YapMate for trades who want invoices done without the admin.

Just talk through the job (labour, boiler parts) and YapMate builds a clean PDF invoice instantly.

Handles labour, materials, VAT, CIS and Reverse Charge properly.

No typing. No forms.

[Download YapMate]

Reply if you've got any questions.

Cheers,
Connor

[Image: YapMate invoice showcase]
```

---

## Testing the Updates

### Test Email Generation:

```bash
# Dry-run test (no actual sends)
python3 -m src.main --trade Plumber --city Glasgow --max 5 --dry-run
```

This will show:
- ✅ Updated hooks (no driving language, less accent)
- ✅ New email body copy
- ✅ Trade-specific materials

### Test Email Sending:

```bash
# Send to approved leads
python3 scripts/send_approved.py
```

This will use:
- ✅ Random subject line selection
- ✅ Updated email body
- ✅ New CTA text and link
- ✅ Updated footer image alt text

---

## Files Modified

```
✅ config/prompts.py          - AI hook instructions updated
✅ src/templates.py           - Email body and subject updated
```

**No other files changed** - lead workflow unchanged.

---

## What Was NOT Changed (As Requested)

- ❌ No additional features added
- ❌ Lead workflow unchanged (scraping, enrichment, approval process)
- ❌ No follow-up sequences added
- ❌ No tracking beyond existing UTM (removed UTM from CTA link)
- ❌ Google Sheets integration unchanged
- ❌ Resend API integration unchanged
- ❌ No additional images added

---

## Before/After Summary

| Element | Before | After |
|---------|--------|-------|
| **Subject** | "Stop doing invoices at 9pm, John" | Random: "Talk the job. Invoice done." |
| **Driving refs** | "while you're driving home" | "before you leave site" |
| **Accent hooks** | Frequent, used "bark" | Rare (20%), safer phrasing |
| **Body length** | 5 paragraphs | 5 paragraphs (shorter, clearer) |
| **CTA text** | "Try YapMate Free" | "Download YapMate" |
| **CTA link** | With UTM params | Clean link |
| **Footer alt** | "YapMate - Voice to Invoice" | "YapMate – voice to invoice for UK trades" |

---

## Next Steps

1. ✅ Changes are live in codebase
2. ⏳ Test with dry-run: `python3 -m src.main --trade Plumber --city Glasgow --max 5 --dry-run`
3. ⏳ Review generated hooks and email preview
4. ⏳ Send test batch to approved leads
5. ⏳ Monitor responses and adjust if needed

---

**Implementation Date:** January 17, 2026
**Implemented By:** Claude Code
**Status:** Ready for testing
