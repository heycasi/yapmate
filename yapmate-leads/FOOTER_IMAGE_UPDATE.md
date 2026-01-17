# Footer Image Update - January 17, 2026

**Status:** ✅ COMPLETE

---

## Changes Made

### 1. Set Footer Image URL ✅

**File:** `.env`

**Update:**
```bash
EMAIL_FOOTER_IMAGE_URL=https://yapmate.co.uk/invoice-showcase.png
```

This uses the existing footer image already in the Next.js public folder.

---

### 2. Wrap Footer Image in Link ✅

**File:** `src/templates.py` → `generate_email_html()`

**Before:**
```html
<td style="padding: 0;">
    <img src="{image_url}"
         alt="YapMate – voice to invoice for UK trades"
         style="width: 100%; height: auto; display: block; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
</td>
```

**After:**
```html
<td style="padding: 0;">
    <a href="https://yapmate.co.uk" style="display: block; text-decoration: none;">
        <img src="{image_url}"
             alt="YapMate – voice to invoice for UK trades"
             style="width: 100%; max-width: 600px; height: auto; display: block; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
    </a>
</td>
```

**Changes:**
- ✅ Wrapped image in clickable link to https://yapmate.co.uk
- ✅ Added `max-width: 600px` to image (matches parent table constraint)
- ✅ Link styled with `display: block` and `text-decoration: none` for clean appearance
- ✅ Maintained existing border-radius for rounded bottom corners
- ✅ Kept alt text: "YapMate – voice to invoice for UK trades"

---

## Footer Image Properties

| Property | Value |
|----------|-------|
| **Source URL** | https://yapmate.co.uk/invoice-showcase.png |
| **Link Target** | https://yapmate.co.uk |
| **Alt Text** | YapMate – voice to invoice for UK trades |
| **Width** | 100% |
| **Max Width** | 600px |
| **Display** | block |
| **Border Radius** | 0 0 8px 8px (bottom corners) |
| **Clickable** | ✅ Yes |

---

## Email Structure

```
┌─────────────────────────────────────┐
│ Email Content (max-width: 600px)   │
│                                     │
│ Hi {BusinessName},                  │
│ {Hook}                              │
│ Body text...                        │
│                                     │
│ [Download YapMate] ← Button         │
│                                     │
│ Reply if you've got any questions.  │
│ Cheers, Connor                      │
│                                     │
├─────────────────────────────────────┤ ← Footer starts here
│ ┌─────────────────────────────────┐ │
│ │  [CLICKABLE IMAGE]               │ │
│ │  invoice-showcase.png            │ │
│ │  Links to: yapmate.co.uk         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## What Was NOT Changed

- ❌ No additional images added
- ❌ Layout unchanged
- ❌ Email body content unchanged
- ❌ CTA button unchanged
- ❌ Subject line logic unchanged

---

## Testing

To verify the footer image appears correctly:

```bash
# Generate test emails (dry-run)
cd /Users/conzo/dev/yapmate/yapmate-leads
python3 -m src.main --trade Plumber --city Glasgow --max 3 --dry-run
```

Or send to approved leads:

```bash
python3 scripts/send_approved.py
```

**Expected Result:**
- Footer image loads from https://yapmate.co.uk/invoice-showcase.png
- Image is clickable and links to https://yapmate.co.uk
- Image displays at full width (max 600px) with rounded bottom corners
- Alt text displays if image fails to load

---

## Files Updated

```
✅ .env                          - Added EMAIL_FOOTER_IMAGE_URL
✅ src/templates.py              - Wrapped footer image in link
```

**Updated in both locations:**
- /Users/conzo/yapmate-leads/
- /Users/conzo/dev/yapmate/yapmate-leads/

---

**Implementation Date:** January 17, 2026
**Implemented By:** Claude Code
**Status:** Ready for use
