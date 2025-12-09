#!/bin/bash

#############################################
# YapMate - Step 5: Deploy to Production
# This script deploys YapMate to Vercel production
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Check if Vercel is linked
if [ ! -d ".vercel" ]; then
    echo "❌ Error: Vercel project not linked!"
    echo "   Run ./deploy/3-setup-vercel.sh first"
    exit 1
fi

# Check if git repo has uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes:"
    echo ""
    git status --short
    echo ""
    read -p "Do you want to commit them now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        echo ""
        echo "Enter commit message (or press ENTER for default):"
        read -p "Message: " commit_msg
        if [ -z "$commit_msg" ]; then
            commit_msg="Update YapMate application"
        fi
        git commit -m "$commit_msg"
        echo ""
        echo "✅ Changes committed"
    else
        echo ""
        read -p "Continue deployment with uncommitted changes? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Deployment cancelled"
            exit 1
        fi
    fi
fi

# Push to GitHub if there are unpushed commits
if git status | grep -q "Your branch is ahead"; then
    echo ""
    echo "📤 Pushing latest changes to GitHub..."
    git push
    echo "   ✓ Pushed to GitHub"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  Building and Deploying to Production..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Deploy to production
vercel --prod

DEPLOY_EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Get deployment URL
    DEPLOY_URL=$(vercel inspect --token $(vercel whoami 2>&1 | tail -1) 2>/dev/null | grep -o 'https://[^"]*' | head -1)

    if [ ! -z "$DEPLOY_URL" ]; then
        echo "🌐 Your YapMate application is live at:"
        echo "   $DEPLOY_URL"
    else
        echo "🌐 Check your deployment URL in the output above"
    fi

    echo ""
    echo "📋 Post-Deployment Checklist:"
    echo "   1. ✓ Application deployed"
    echo "   2. ⏳ Configure Supabase URLs (next step)"
    echo "   3. ⏳ Test deployment"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Run: ./deploy/6-configure-supabase.sh"
    echo "   2. Run: ./deploy/7-verify-deployment.sh"
    echo ""

else
    echo "❌ DEPLOYMENT FAILED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Common issues:"
    echo "   1. Build errors - check the output above"
    echo "   2. Missing environment variables"
    echo "   3. TypeScript errors"
    echo "   4. Missing dependencies"
    echo ""
    echo "🔍 Debug steps:"
    echo "   1. Check build logs above"
    echo "   2. Run locally: npm run build"
    echo "   3. Verify env vars: vercel env ls"
    echo "   4. Check Vercel dashboard logs"
    echo ""
    exit 1
fi
