# URGENT: Fix Email Confirmation Issue

## Problem
Users signing up can't receive confirmation emails because Supabase is using the default email provider (rate-limited, often blocked).

## Solution: Configure Custom SMTP (Resend)

Unfortunately, **I cannot change Supabase Auth settings programmatically** - they require dashboard access. Here's the exact process:

### Step 1: Open Supabase Dashboard
Already opened in your browser:
https://supabase.com/dashboard/project/nidijdprgoauwkmuioer/settings/auth

### Step 2: Configure SMTP Settings

1. **Scroll down to "SMTP Settings"** or look for "Email Provider"

2. **Click "Enable Custom SMTP"**

3. **Enter these exact values:**
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 587
   SMTP Username: resend
   SMTP Password: re_ey2ZayzJ_J9ZxEiq5GVAruFk3yhLXvEEN
   ```

4. **Sender Settings:**
   - From Email: `noreply@yapmate.com` (or your verified domain in Resend)
   - From Name: `YapMate`

5. **Click "Save"**

### Step 3: Test It

1. In Supabase dashboard → Authentication → Users
2. Click "Invite User"
3. Enter a test email
4. Check if email arrives

---

## FASTER FIX: Disable Email Confirmation (Temporary)

**If you need users NOW and will fix SMTP later:**

1. Supabase Dashboard → Authentication → Settings
2. Find **"Email Confirmation"** toggle
3. **Turn it OFF**
4. Save

⚠️ **Users can now sign up without email verification**
- Less secure, but unblocks signups immediately
- Re-enable once SMTP is configured

---

## Why This Happens

Supabase's default email provider:
- Sends max 3-4 emails/hour (rate limited)
- Often flagged as spam
- Not meant for production

Your Resend API key (re_ey2ZayzJ...) is configured in `.env.local` but Supabase Auth doesn't know about it yet.

---

## What Domain to Use?

Check your Resend dashboard:
https://resend.com/domains

Use a verified domain for "From Email" (e.g., noreply@yourdomain.com)

If no domain verified, add one in Resend first.

---

**Time to fix:** 2-3 minutes
**Impact:** Unblocks all user signups immediately
