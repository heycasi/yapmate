# YapMate Waitlist - Vercel Deployment Checklist

## ✅ Prerequisites
- [x] Supabase database configured with `waitlist_signups` table
- [x] Migrations successfully run
- [x] Logo image exists: `/public/yapmatetransparetnew112.png`
- [ ] Vercel account ready
- [ ] Domain ready (optional, can use vercel.app subdomain first)

---

## 📋 Step-by-Step Deployment

### 1. Push to Git Repository

Ensure your yapmate code is in a Git repository (GitHub, GitLab, or Bitbucket):

```bash
cd /Users/conzo/dev/yapmate

# If not initialized yet:
git init
git add .
git commit -m "Initial commit - waitlist ready"

# Push to GitHub (create repo first on github.com):
git remote add origin https://github.com/YOUR_USERNAME/yapmate.git
git push -u origin main
```

---

### 2. Create Vercel Project

1. Go to https://vercel.com/new
2. Click "Import Project"
3. Select your yapmate repository
4. Configure project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

---

### 3. Configure Environment Variables

**CRITICAL: Add these environment variables in Vercel before deploying:**

#### Required for Waitlist Only:

| Variable Name | Value | Where to Find |
|--------------|-------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nidijdprgoauwkmuioer.supabase.co` | Already in your `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (your key) | Already in your `.env.local` |

#### How to Add in Vercel:
1. In Vercel project settings
2. Go to **Settings** → **Environment Variables**
3. Add each variable:
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: Paste from your `.env.local`
   - Select: **Production**, **Preview**, **Development**
   - Click "Save"
4. Repeat for `SUPABASE_SERVICE_ROLE_KEY`

---

### 4. Optional: Add Other Environment Variables

These are NOT needed for just the waitlist, but will be needed when you deploy other features:

- `OPENAI_API_KEY` - For invoice AI extraction
- `STRIPE_SECRET_KEY` - For payment processing
- `RESEND_API_KEY` - For email sending
- `DATABASE_URL` - For direct database operations
- `SUPABASE_DB_PASSWORD` - For migrations

**Recommendation**: Add these later when you need those features.

---

### 5. Deploy

1. Click **Deploy** in Vercel
2. Wait for build to complete (usually 2-3 minutes)
3. You'll get a URL like: `https://yapmate.vercel.app`

---

### 6. Test Your Waitlist

1. Visit your Vercel URL: `https://yapmate.vercel.app/waitlist`
2. Enter an email and submit
3. Check success message
4. Verify in Supabase:
   - Go to https://supabase.com/dashboard/project/nidijdprgoauwkmuioer/editor
   - Open `waitlist_signups` table
   - Confirm your test email is there

---

### 7. Set Custom Domain (Optional)

If you want to use your own domain (e.g., `yapmate.co.uk`):

1. In Vercel project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain: `yapmate.co.uk`
4. Follow DNS configuration instructions:
   - Add CNAME record or A record as shown
   - Wait for DNS propagation (can take 1-48 hours)

**Popular UK domain registrars:**
- Namecheap
- GoDaddy
- 123-reg
- Cloudflare

---

## 🚨 Common Issues & Solutions

### Issue: "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Solution**: Make sure you added environment variables in Vercel AND checked all environments (Production, Preview, Development)

### Issue: "Failed to join waitlist" error
**Solution**:
1. Check Supabase RLS policies allow insertion
2. Verify service role key is correct
3. Check Supabase logs for errors

### Issue: Build fails with "Module not found"
**Solution**: Make sure all dependencies are in `package.json`:
```bash
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Issue: Logo image not showing
**Solution**: Verify `/public/yapmatetransparetnew112.png` is committed to Git

---

## 🎯 Post-Deployment

### Set Root Path

**Current setup:**
- Homepage (`/`): Simple landing with link to waitlist
- Waitlist page (`/waitlist`): Full waitlist landing page

**If you want `/waitlist` to be your main page:**

Option 1: Redirect root to waitlist (in `app/page.tsx`):
```typescript
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/waitlist')
}
```

Option 2: Make waitlist the homepage:
- Rename `app/waitlist/page.tsx` → `app/page.tsx`
- Delete old `app/page.tsx`

---

## 📊 Monitor Your Waitlist

### View Signups:
1. Go to Supabase Dashboard
2. Navigate to **Table Editor**
3. Select `waitlist_signups` table
4. See all emails with timestamps

### Export to CSV:
1. In Supabase Table Editor
2. Click on `waitlist_signups`
3. Click **⋮** menu → **Download as CSV**

---

## 🔒 Security Checklist

- [x] Using `SUPABASE_SERVICE_ROLE_KEY` only in API routes (not exposed to client)
- [x] Email validation on both client and server
- [x] Unique constraint on email (prevents duplicates)
- [x] HTTPS enforced by Vercel automatically
- [ ] Consider adding rate limiting for production (optional)
- [ ] Consider adding reCAPTCHA to prevent spam (optional)

---

## 📝 Quick Reference

**Your Supabase Project**: https://supabase.com/dashboard/project/nidijdprgoauwkmuioer

**Environment Variables Needed**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://nidijdprgoauwkmuioer.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (from your .env.local)
```

**Deployment Commands** (if needed):
```bash
# Redeploy from CLI
npm install -g vercel
vercel --prod

# View logs
vercel logs
```

---

## ✅ Final Checklist Before Going Live

- [ ] Test waitlist signup works
- [ ] Verify emails are saving to Supabase
- [ ] Check mobile responsiveness
- [ ] Test duplicate email handling
- [ ] Verify logo loads correctly
- [ ] Test on different browsers
- [ ] Share link with a friend to test
- [ ] Set up custom domain (optional)
- [ ] Add analytics (Google Analytics, Vercel Analytics, etc.) - optional

---

## 🎉 You're Ready!

Once deployed, share your waitlist page:
- `https://yapmate.vercel.app/waitlist` (or your custom domain)
- Share on social media
- Add to LinkedIn/Twitter bio
- Share with potential users

**Next Steps After Launch:**
1. Monitor signups in Supabase
2. Prepare launch email for waitlist members
3. Continue building core product features
4. Plan follow-up email campaign
