# 🚀 YapMate Waitlist - Quick Vercel Deploy

## Minimum Required Environment Variables

**Only these 2 variables are needed for the waitlist to work:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://nidijdprgoauwkmuioer.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pZGlqZHByZ29hdXdrbXVpb2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTIwNzg3NywiZXhwIjoyMDgwNzgzODc3fQ.CZGKBBQu0ngA2dxT184Fsg3XSMq48ZXXXaQQ1-yvi2I
```

---

## 3-Step Deploy

### 1. Push to GitHub
```bash
# If not done yet:
git init
git add .
git commit -m "Waitlist ready for deployment"
# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/yapmate.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to https://vercel.com/new
2. Import your yapmate repository
3. Framework: Next.js (auto-detected)

### 3. Add Environment Variables
In Vercel project settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL` = (copy from above)
- `SUPABASE_SERVICE_ROLE_KEY` = (copy from above)

Select all environments (Production, Preview, Development)

Click **Deploy** ✅

---

## Test After Deploy

1. Visit: `https://your-project.vercel.app/waitlist`
2. Enter test email
3. Check Supabase: https://supabase.com/dashboard/project/nidijdprgoauwkmuioer/editor
4. Verify email appears in `waitlist_signups` table

---

## Custom Domain (Optional)

Vercel Settings → Domains → Add your domain → Follow DNS instructions

---

## Need Help?

See full guide: `DEPLOYMENT_CHECKLIST.md`
