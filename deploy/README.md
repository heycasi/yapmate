# YapMate Deployment Scripts

## 🚀 Quick Start

Deploy YapMate to production in 7 simple steps:

```bash
cd /Users/conzo/dev/yapmate

# Step 1: Initialize Git repository
./deploy/1-setup-repo.sh

# Step 2: Create GitHub repo manually at https://github.com/new
# Repository name: yapmate
# Then run:
./deploy/2-connect-github.sh

# Step 3: Setup Vercel project
./deploy/3-setup-vercel.sh

# Step 4: Configure environment variables
./deploy/4-configure-env.sh

# Step 5: Deploy to production
./deploy/5-deploy.sh

# Step 6: Configure Supabase
./deploy/6-configure-supabase.sh

# Step 7: Verify deployment
./deploy/7-verify-deployment.sh
```

## 📚 Documentation

- **[MASTER_EXECUTION_PLAN.md](./MASTER_EXECUTION_PLAN.md)** - Complete step-by-step guide
- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - All environment variables explained

## 🎯 What Each Script Does

1. **1-setup-repo.sh** - Initialize Git repository and create initial commit
2. **2-connect-github.sh** - Connect to GitHub and push code
3. **3-setup-vercel.sh** - Install Vercel CLI and link project
4. **4-configure-env.sh** - Push environment variables to Vercel
5. **5-deploy.sh** - Build and deploy to production
6. **6-configure-supabase.sh** - Configure Supabase URLs
7. **7-verify-deployment.sh** - Test and verify deployment

## ⚠️ Important

- YapMate and HeyCasi are SEPARATE projects
- Each script checks prerequisites
- Follow scripts in order
- Read output carefully

## 📊 Total Time

Approximately 35-55 minutes from start to finish.

## 🆘 Help

If any script fails:
1. Read the error message carefully
2. Check prerequisites
3. Consult MASTER_EXECUTION_PLAN.md
4. Run scripts with verbose output

## 🎉 Success

When all 7 scripts complete, your app will be live at your production URL!
