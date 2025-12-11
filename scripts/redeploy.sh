#!/bin/bash

#######################################
# YapMate - Production Deployment Script
# Handles git commits and Vercel deployment
#######################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YapMate - Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes:"
    echo ""
    git status --short
    echo ""
    read -p "Commit these changes? (y/n) " -n 1 -r
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
    fi
fi

# Push to GitHub if needed
if git status | grep -q "Your branch is ahead"; then
    echo ""
    echo "📤 Pushing to GitHub..."
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
    echo "🌐 Your YapMate application is live at:"
    echo ""
    echo "   https://yapmate.co.uk"
    echo "   https://www.yapmate.co.uk"
    echo "   https://yapmate.co.uk/waitlist"
    echo ""
    echo "📝 Next steps:"
    echo ""
    echo "   1. Wait 2-3 minutes for deployment to complete"
    echo "   2. Test your site in browser"
    echo "   3. Run verification: ./scripts/verify-domain.sh"
    echo ""
else
    echo "❌ DEPLOYMENT FAILED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Troubleshooting:"
    echo ""
    echo "   1. Check build errors above"
    echo "   2. Test locally: npm run build"
    echo "   3. Check Vercel logs: vercel logs"
    echo "   4. Verify environment variables"
    echo ""
    exit 1
fi
