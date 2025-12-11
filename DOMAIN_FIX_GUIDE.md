# 🌐 YapMate Domain Fix - Complete Guide

## 🔹 1. DNS CONFIGURATION FOR GODADDY

### Required DNS Records

Add these **EXACT** records in your GoDaddy DNS settings:

| Type | Name | Value | TTL | Priority |
|------|------|-------|-----|----------|
| **A** | **@** | **76.76.21.21** | 600 | - |
| **CNAME** | **www** | **cname.vercel-dns.com.** | 600 | - |

**Important Notes:**
- The A record IP `76.76.21.21` is Vercel's IP address
- The CNAME must end with a dot (`.`)
- Delete ANY existing A or CNAME records for @ or www
- TTL can be 600 seconds (10 minutes) or 3600 (1 hour)

---

### Step-by-Step GoDaddy Instructions

#### Access DNS Settings

1. Go to: https://dcc.godaddy.com/domains
2. Find **yapmate.co.uk** in your domain list
3. Click the three dots ⋯ next to it
4. Select **"Manage DNS"**

#### Delete Existing Records (if any)

**⚠️ CRITICAL: Remove these first to avoid conflicts**

1. Look for any existing A records pointing to @ (root)
2. Look for any CNAME records for www
3. Delete them by clicking the trash icon ⋯ → Delete
4. **DO NOT** delete:
   - MX records (email)
   - TXT records (verification)
   - NS records (nameservers)

#### Add New A Record

1. Click **"Add"** button
2. Select **Type:** A
3. **Name:** @ (or leave blank - some interfaces show it as @)
4. **Value:** 76.76.21.21
5. **TTL:** 600 seconds (or use default)
6. Click **"Save"**

#### Add New CNAME Record

1. Click **"Add"** button again
2. Select **Type:** CNAME
3. **Name:** www
4. **Value:** cname.vercel-dns.com. (note the dot at the end!)
5. **TTL:** 600 seconds (or use default)
6. Click **"Save"**

#### Verify in GoDaddy

After saving, your DNS records should look like:

```
Type    Name    Value                      TTL
A       @       76.76.21.21                600
CNAME   www     cname.vercel-dns.com.      600
```

---

## 🔹 2. VERCEL DEPLOYMENT ROUTING

### Current Status ✅

Your routing is correctly set up:
- ✅ `/app/page.tsx` exists (root route)
- ✅ `/app/waitlist/page.tsx` exists (waitlist route)
- ✅ Vercel project: `yapmate`
- ✅ Production branch: `main`
- ✅ Domain added to Vercel: `yapmate.co.uk`

### Why GoDaddy Shows "Page Not Found"

**The issue:** DNS records are pointing to GoDaddy's servers, not Vercel.

**The fix:** Update DNS records (Step 1 above) so traffic goes to Vercel.

**Timeline:**
- DNS changes take 10-60 minutes to propagate
- Worldwide propagation can take up to 48 hours

---

### Verify Routes Exist in Build

Run this locally to confirm routes:

```bash
cd /Users/conzo/dev/yapmate
npm run build
```

Expected output should include:
```
Route (app)                              Size     First Load JS
┌ ○ /                                    ...      ...
└ ○ /waitlist                            ...      ...
```

If routes are missing, the build will show errors.

---

## 🔹 3. VERCEL AUTOMATION COMMANDS

### Quick Command Reference

Copy and paste these commands as needed:

#### Check Current Deployment

```bash
cd /Users/conzo/dev/yapmate
vercel ls
```

#### Redeploy to Production

```bash
cd /Users/conzo/dev/yapmate
vercel --prod
```

#### Check Domain Status

```bash
cd /Users/conzo/dev/yapmate
vercel domains inspect yapmate.co.uk
```

#### View Production Logs

```bash
cd /Users/conzo/dev/yapmate
vercel logs --follow
```

#### Force Clear Cache & Redeploy

```bash
cd /Users/conzo/dev/yapmate
git commit --allow-empty -m "Force rebuild"
git push
vercel --prod --force
```

---

### Master Deployment Script

Save this as `scripts/redeploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 YapMate - Production Deployment"
echo ""

cd /Users/conzo/dev/yapmate

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes"
    git status --short
    echo ""
    read -p "Commit these changes? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "Commit message: " msg
        git commit -m "$msg"
        git push
    fi
fi

# Deploy
echo ""
echo "📦 Building and deploying to production..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your site:"
echo "   https://yapmate.co.uk"
echo "   https://www.yapmate.co.uk"
echo "   https://yapmate.co.uk/waitlist"
echo ""
```

Make it executable:

```bash
chmod +x /Users/conzo/dev/yapmate/scripts/redeploy.sh
```

Run it:

```bash
./scripts/redeploy.sh
```

---

## 🔹 4. DNS PROPAGATION VERIFICATION

### Check if DNS Has Updated

Run these commands after updating GoDaddy DNS:

```bash
# Check A record (should show 76.76.21.21)
dig yapmate.co.uk A +short

# Check CNAME record (should show cname.vercel-dns.com)
dig www.yapmate.co.uk CNAME +short

# Check what IP www resolves to
dig www.yapmate.co.uk A +short
```

**Expected results:**
```
76.76.21.21                    # yapmate.co.uk A record
cname.vercel-dns.com.          # www CNAME
76.76.21.21                    # www final resolution
```

### Online DNS Checkers

Use these tools to verify DNS globally:

1. **DNS Propagation Checker**
   https://www.whatsmydns.net/#A/yapmate.co.uk

2. **DNS Lookup Tool**
   https://mxtoolbox.com/SuperTool.aspx?action=a%3ayapmate.co.uk

3. **Vercel's Built-in Checker**
   https://vercel.com/heycasi/yapmate/settings/domains

---

## 🔹 5. TROUBLESHOOTING

### Issue: "Page Not Found" still shows after DNS update

**Causes:**
1. DNS hasn't propagated yet (wait 10-60 minutes)
2. Browser cache (clear cache or use incognito)
3. ISP DNS cache (use Google DNS: 8.8.8.8)

**Solutions:**

```bash
# Clear your local DNS cache
# macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Test with Google DNS
dig @8.8.8.8 yapmate.co.uk
```

### Issue: /waitlist shows 404

**Check:**

```bash
cd /Users/conzo/dev/yapmate
# Verify file exists
ls -la app/waitlist/page.tsx

# Rebuild
npm run build

# Check build output for /waitlist route
```

**If missing:** Create the file (though it should exist)

### Issue: www works but root doesn't (or vice versa)

**Fix:** Ensure BOTH DNS records are added:
- A record for @
- CNAME for www

### Issue: Vercel shows "Invalid Configuration"

**Fix:**

```bash
# Re-add domain
cd /Users/conzo/dev/yapmate
vercel domains add yapmate.co.uk

# Then update DNS records again
```

---

## 🔹 6. POST-DNS UPDATE CHECKLIST

After updating DNS on GoDaddy, follow this checklist:

### Immediate (0-5 minutes)

- [ ] DNS records saved in GoDaddy
- [ ] Verify records appear in GoDaddy DNS management
- [ ] Run `dig yapmate.co.uk A +short` locally

### Short-term (10-30 minutes)

- [ ] Check https://www.whatsmydns.net for propagation
- [ ] Test in incognito/private browser window
- [ ] Redeploy on Vercel: `vercel --prod`

### Medium-term (1-2 hours)

- [ ] https://yapmate.co.uk loads (not GoDaddy page)
- [ ] https://www.yapmate.co.uk loads
- [ ] https://yapmate.co.uk/waitlist loads
- [ ] SSL certificate shows as valid (green lock)
- [ ] Test on mobile network (different DNS)

### Verification Commands

```bash
# All should return 200
curl -I https://yapmate.co.uk | head -1
curl -I https://www.yapmate.co.uk | head -1
curl -I https://yapmate.co.uk/waitlist | head -1
```

---

## 🔹 7. DOMAIN REDIRECT CONFIGURATION

### Ensure www → apex or apex → www redirects

Vercel automatically handles this, but verify in:

https://vercel.com/heycasi/yapmate/settings/domains

**Recommended setup:**
- **Primary:** yapmate.co.uk (no www)
- **Redirect:** www.yapmate.co.uk → yapmate.co.uk

This is configured automatically by Vercel when both records exist.

---

## 📞 QUICK REFERENCE

### GoDaddy DNS Settings

**Direct link:**
https://dcc.godaddy.com/domains?filter=yapmate.co.uk

**DNS Records to add:**
```
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com.
```

### Vercel Project Settings

**Direct link:**
https://vercel.com/heycasi/yapmate/settings/domains

### Key Commands

```bash
# Redeploy
vercel --prod

# Check DNS
dig yapmate.co.uk

# View logs
vercel logs --follow

# Check domains
vercel domains ls
```

---

## ⏱️ TIMELINE EXPECTATIONS

| Step | Duration |
|------|----------|
| Update DNS on GoDaddy | 2 minutes |
| DNS propagation starts | Immediate |
| Local DNS cache update | 10-30 minutes |
| Global DNS propagation | 1-4 hours |
| Full worldwide propagation | Up to 48 hours |

**Most users will see changes within 10-30 minutes.**

---

## ✅ SUCCESS CRITERIA

You'll know it's working when:

1. ✅ https://yapmate.co.uk loads your app (not GoDaddy)
2. ✅ https://www.yapmate.co.uk redirects to yapmate.co.uk
3. ✅ https://yapmate.co.uk/waitlist shows your waitlist page
4. ✅ SSL certificate is valid (green padlock)
5. ✅ No console errors in browser DevTools

---

**Need help?** Run the verification scripts in the next section!
