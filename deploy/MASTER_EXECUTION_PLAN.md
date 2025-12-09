# 🚀 YapMate Production Deployment - Master Execution Plan

## ⚠️ CRITICAL: Project Separation

YapMate and HeyCasi are **COMPLETELY SEPARATE** projects:
- Different Git repositories
- Different Vercel projects
- Different environment variables
- (Optionally) Different Supabase projects

**DO NOT** mix configurations between projects.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] GitHub account with access to create repositories
- [ ] Vercel account (free tier is fine)
- [ ] Supabase project configured (from previous setup)
- [ ] Terminal/command line access
- [ ] `.env.local` file with all required variables

---

## 🎯 Step-by-Step Execution Plan

Follow these steps **IN ORDER**. Each script checks prerequisites and guides you through the process.

### Step 1: Initialize Git Repository

```bash
cd /Users/conzo/dev/yapmate
chmod +x deploy/*.sh
./deploy/1-setup-repo.sh
```

**What this does:**
- Initializes Git repository
- Verifies `.gitignore` is correct
- Creates initial commit
- Prepares project for GitHub

**Duration:** 1 minute

**Next:** Create GitHub repository manually

---

### Step 2: Create GitHub Repository

**Manual Step** - Go to https://github.com/new

**Settings:**
- Repository name: `yapmate`
- Privacy: **Private** (recommended - contains business logic)
- DO NOT initialize with README, .gitignore, or license
- Click "Create repository"

**Then continue to Step 3**

---

### Step 3: Connect to GitHub

```bash
./deploy/2-connect-github.sh
```

**What this does:**
- Prompts for your GitHub username
- Adds GitHub as remote
- Pushes code to GitHub
- Verifies connection

**You'll need:**
- GitHub username
- GitHub credentials (or personal access token)

**Duration:** 2-3 minutes

---

### Step 4: Setup Vercel Project

```bash
./deploy/3-setup-vercel.sh
```

**What this does:**
- Installs Vercel CLI globally (if needed)
- Logs you into Vercel (browser auth)
- Links YapMate to a new Vercel project
- Creates `.vercel/` configuration

**Interactive prompts:**
- Login browser window will open
- Select scope (personal or team)
- Choose **NO** to "Link to existing project"
- Project name: `yapmate` (or your choice)
- Directory: `./` (default)

**Duration:** 3-5 minutes

**IMPORTANT**: Make sure this creates a NEW project, separate from HeyCasi

---

### Step 5: Configure Environment Variables

```bash
./deploy/4-configure-env.sh
```

**What this does:**
- Reads variables from `.env.local`
- Pushes them to Vercel project
- Configures for Production/Preview/Development environments

**Choose:**
- Option 4: "All environments" (recommended)

**Variables pushed:**
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ OPENAI_API_KEY
- ✅ STRIPE_SECRET_KEY
- ✅ RESEND_API_KEY

**Duration:** 1-2 minutes

---

### Step 6: Deploy to Production

```bash
./deploy/5-deploy.sh
```

**What this does:**
- Checks for uncommitted changes
- Optionally commits and pushes them
- Builds and deploys to Vercel production
- Returns deployment URL

**You'll get:**
- Production URL: `https://yapmate.vercel.app` (or similar)

**Duration:** 3-5 minutes (build time)

**If build fails:**
- Check Vercel logs
- Verify environment variables
- Run `npm run build` locally to test

---

### Step 7: Configure Supabase

```bash
./deploy/6-configure-supabase.sh
```

**What this does:**
- Guides you through Supabase configuration
- Provides direct links to settings pages
- Saves configuration for reference

**You'll manually configure:**
1. **Site URL**: Your production URL
2. **Redirect URLs**:
   - `https://yapmate.vercel.app/auth/callback`
   - `https://yapmate.vercel.app/api/auth/callback`
   - `http://localhost:3000/auth/callback` (dev)
   - `http://localhost:3000/api/auth/callback` (dev)
3. **Email templates** (optional)

**Duration:** 5 minutes

**Important:** Keep HeyCasi Supabase settings separate!

---

### Step 8: Verify Deployment

```bash
./deploy/7-verify-deployment.sh
```

**What this does:**
- Runs automated connectivity tests
- Tests homepage, API routes, waitlist
- Provides manual testing checklist
- Shows debugging resources

**Tests:**
- ✅ Homepage loads (HTTP 200)
- ✅ Waitlist page accessible
- ✅ API routes respond
- ✅ No build errors
- ✅ Resources load correctly

**Duration:** 2 minutes (automated) + manual testing

---

## ⏱️ Total Time Estimate

- **Automated steps**: 15-20 minutes
- **Manual configuration**: 10-15 minutes
- **Testing**: 10-20 minutes
- **TOTAL**: **35-55 minutes**

---

## 🔥 Quick Start (TL;DR)

If you're experienced and just want the commands:

```bash
cd /Users/conzo/dev/yapmate

# Make scripts executable
chmod +x deploy/*.sh

# Run all steps in sequence
./deploy/1-setup-repo.sh
# → Create GitHub repo at https://github.com/new (name: yapmate)
./deploy/2-connect-github.sh
./deploy/3-setup-vercel.sh
./deploy/4-configure-env.sh
./deploy/5-deploy.sh
./deploy/6-configure-supabase.sh
./deploy/7-verify-deployment.sh
```

---

## 📊 Deployment Architecture

```
Local Development
    ↓ (git push)
GitHub Repository (yapmate)
    ↓ (webhook)
Vercel Build & Deploy
    ↓ (uses)
Environment Variables (Vercel)
    ↓ (connects to)
Supabase Database (nidijdprgoauwkmuioer)
    ↓ (configured for)
Production URL (yapmate.vercel.app)
```

---

## 🚨 Common Issues & Solutions

### Issue: "Fatal: not a git repository"
**Solution**: Run `./deploy/1-setup-repo.sh` first

### Issue: "Remote origin already exists"
**Solution**: Script will remove and re-add it

### Issue: "Authentication failed" (GitHub)
**Solution**: Use Personal Access Token instead of password
- Create at: https://github.com/settings/tokens
- Permissions: `repo` (all)

### Issue: "Vercel command not found"
**Solution**: Script installs it automatically. If fails:
```bash
npm install -g vercel@latest
```

### Issue: "Build failed" on Vercel
**Solutions:**
1. Run `npm run build` locally to identify errors
2. Check Vercel logs in dashboard
3. Verify all environment variables are set
4. Check for TypeScript errors

### Issue: "Environment variable not defined"
**Solution**:
1. Verify in Vercel dashboard
2. Ensure variable names match exactly (case-sensitive)
3. Redeploy after adding: `vercel --prod`

### Issue: "Supabase connection failed"
**Solutions:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
2. Check Supabase project is active
3. Verify URL is correct
4. Check RLS policies

---

## ✅ Post-Deployment Checklist

After deployment, verify:

### Functionality:
- [ ] Homepage loads at production URL
- [ ] Waitlist form accepts emails
- [ ] Emails save to Supabase
- [ ] Duplicate emails handled gracefully
- [ ] Mobile responsive design works
- [ ] All pages load (login, dashboard, etc.)

### Configuration:
- [ ] Supabase Site URL updated
- [ ] Redirect URLs configured
- [ ] Environment variables all set
- [ ] No build errors in Vercel
- [ ] Logs show no critical errors

### Security:
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] `.env.local` not committed to Git
- [ ] Service role key not exposed to client
- [ ] Headers configured (X-Frame-Options, etc.)

### Separation:
- [ ] YapMate uses different Vercel project from HeyCasi
- [ ] Environment variables don't overlap
- [ ] Git repositories are separate
- [ ] Supabase projects are separate (if applicable)

---

## 🔄 Making Changes After Deployment

### Code changes:

```bash
# 1. Make your changes
# 2. Commit
git add .
git commit -m "Your change description"

# 3. Push to GitHub
git push

# 4. Deploy to Vercel
vercel --prod

# OR let auto-deploy handle it (if enabled)
```

### Environment variable changes:

```bash
# 1. Update in Vercel dashboard
# 2. Redeploy
vercel --prod
```

### Supabase schema changes:

```bash
# 1. Create new migration file
# supabase/migrations/003_your_migration.sql

# 2. Run migration
npm run migrate

# 3. OR run in Supabase SQL Editor
```

---

## 📞 Support Resources

### Documentation:
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs

### Project Files:
- Environment vars: `deploy/ENVIRONMENT_VARIABLES.md`
- Troubleshooting: Scripts include detailed error messages
- Configuration: `vercel.json`, `.gitignore`

### Dashboards:
- Vercel: https://vercel.com (check logs, deployments)
- GitHub: https://github.com/YOUR_USERNAME/yapmate
- Supabase: https://supabase.com/dashboard

---

## 🎉 Success Criteria

You'll know deployment succeeded when:

1. ✅ All 7 scripts ran without errors
2. ✅ Production URL loads your app
3. ✅ Waitlist form works and saves to database
4. ✅ No errors in Vercel logs
5. ✅ Supabase authentication works (if implemented)
6. ✅ All features you need work correctly

---

## 🚀 Next Steps After Deployment

1. **Set up custom domain** (optional):
   - Vercel Dashboard → Domains
   - Add your domain
   - Configure DNS

2. **Enable auto-deployments**:
   - Vercel will auto-deploy on GitHub pushes
   - Already configured via GitHub integration

3. **Set up monitoring**:
   - Vercel Analytics (built-in)
   - Sentry for error tracking
   - LogRocket for session replay

4. **Invite beta users**:
   - Share production URL
   - Collect feedback
   - Iterate on features

---

## 🔒 Final Security Check

Before going fully public, ensure:

- [ ] All secrets are in environment variables (not code)
- [ ] `.env.local` is gitignored
- [ ] Supabase RLS policies are correct
- [ ] API routes validate input
- [ ] Rate limiting considered (for production scale)
- [ ] CORS configured if needed
- [ ] Stripe webhooks use signature verification

---

## ✨ You're Done!

Your YapMate application is now live in production, completely separate from HeyCasi, with:

- ✅ Automated Git setup
- ✅ GitHub repository
- ✅ Vercel hosting
- ✅ Environment variables configured
- ✅ Supabase integrated
- ✅ Production URL live
- ✅ Verified and tested

**Congratulations! 🎉**
