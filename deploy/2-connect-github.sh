#!/bin/bash

#############################################
# YapMate - Step 2: Connect to GitHub
# This script connects the local repo to GitHub
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Connect to GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "❌ No Git repository found!"
    echo "   Run ./deploy/1-setup-repo.sh first"
    exit 1
fi

echo "📝 Please provide your GitHub username:"
read -p "   Username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ GitHub username is required"
    exit 1
fi

echo ""
echo "🔗 GitHub repository URL will be:"
echo "   https://github.com/$GITHUB_USERNAME/yapmate"
echo ""

read -p "Is this correct? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🌐 Make sure you've created the repository on GitHub first!"
echo "   Go to: https://github.com/new"
echo "   Repository name: yapmate"
echo "   Privacy: Private (recommended)"
echo "   DO NOT add README, .gitignore, or license"
echo ""

read -p "Have you created the GitHub repository? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please create the repository first, then run this script again"
    exit 1
fi

echo ""
echo "✅ Adding GitHub remote..."

# Remove existing origin if it exists
if git remote | grep -q "^origin$"; then
    echo "   Removing existing origin..."
    git remote remove origin
fi

# Add new remote
git remote add origin "https://github.com/$GITHUB_USERNAME/yapmate.git"
echo "   ✓ Remote added"
echo ""

# Verify remote
echo "✅ Verifying remote..."
git remote -v
echo ""

# Set main as default branch
echo "✅ Setting main branch..."
git branch -M main
echo ""

# Push to GitHub
echo "✅ Pushing to GitHub..."
echo "   You may be prompted for your GitHub credentials"
echo ""

if git push -u origin main; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Successfully pushed to GitHub!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🌐 View your repository:"
    echo "   https://github.com/$GITHUB_USERNAME/yapmate"
    echo ""
    echo "📝 Next step:"
    echo "   Run: ./deploy/3-setup-vercel.sh"
    echo ""
else
    echo ""
    echo "❌ Push failed!"
    echo ""
    echo "💡 Common issues:"
    echo "   1. Repository doesn't exist on GitHub"
    echo "   2. Authentication failed - you may need to:"
    echo "      - Use a Personal Access Token instead of password"
    echo "      - Set up SSH keys"
    echo "   3. Repository name mismatch"
    echo ""
    echo "   Create token at: https://github.com/settings/tokens"
    echo "   Permissions needed: repo (all)"
    exit 1
fi
