#!/bin/bash

#############################################
# YapMate - Step 3: Setup Vercel Project
# This script installs Vercel CLI and creates the project
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Vercel Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI globally..."
    npm install -g vercel@latest
    echo "   ✓ Vercel CLI installed"
    echo ""
else
    echo "✅ Vercel CLI already installed"
    vercel --version
    echo ""
fi

# Check if already linked
if [ -d ".vercel" ]; then
    echo "⚠️  Vercel project already linked"
    echo "   Current configuration:"
    cat .vercel/project.json 2>/dev/null || echo "   (configuration file not found)"
    echo ""
    read -p "   Do you want to re-link? This will overwrite existing config. (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Keeping existing Vercel configuration"
        echo ""
        echo "📝 Next step:"
        echo "   Run: ./deploy/4-configure-env.sh"
        exit 0
    fi
    rm -rf .vercel
fi

echo "🔐 You'll need to authenticate with Vercel"
echo "   A browser window will open for login"
echo ""

read -p "Press ENTER to continue..."
echo ""

# Login to Vercel
echo "✅ Logging into Vercel..."
vercel login
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Project Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: YapMate is SEPARATE from HeyCasi"
echo "   - Use a different project name"
echo "   - Use the same or different team/account"
echo "   - Environment variables will be separate"
echo ""
echo "Recommended answers:"
echo "   Set up and deploy? → Y"
echo "   Which scope? → (your choice - personal or team)"
echo "   Link to existing project? → N"
echo "   Project name? → yapmate"
echo "   In which directory? → ./"
echo "   Want to override settings? → N"
echo ""

read -p "Ready to link project? Press ENTER to continue..."
echo ""

# Link to Vercel (this will prompt interactively)
echo "✅ Linking to Vercel..."
vercel link --yes

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Vercel project linked!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show project info
if [ -f ".vercel/project.json" ]; then
    echo "📋 Project Information:"
    cat .vercel/project.json | jq '.' 2>/dev/null || cat .vercel/project.json
    echo ""
fi

echo "📝 Next step:"
echo "   Run: ./deploy/4-configure-env.sh"
echo ""
