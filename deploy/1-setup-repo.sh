#!/bin/bash

#############################################
# YapMate - Step 1: Initialize Git Repository
# This script sets up the Git repository
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Git Repository Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project directory
cd /Users/conzo/dev/yapmate

echo "📂 Working directory: $(pwd)"
echo ""

# Check if already a git repo
if [ -d ".git" ]; then
    echo "⚠️  Git repository already exists"
    echo "   Current remotes:"
    git remote -v
    echo ""
    read -p "   Do you want to continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi
else
    echo "✅ Initializing Git repository..."
    git init
    echo ""
fi

# Create .gitignore if it doesn't exist or verify it
echo "✅ Verifying .gitignore..."
if [ ! -f ".gitignore" ]; then
    echo "⚠️  No .gitignore found, creating one..."
    cat > .gitignore << 'EOF'
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# deployment scripts (sensitive)
deploy/.env.production
EOF
fi
echo "   .gitignore verified ✓"
echo ""

# Add all files
echo "✅ Staging files for commit..."
git add .
echo ""

# Show what will be committed
echo "📋 Files to be committed:"
git status --short
echo ""

# Create initial commit
echo "✅ Creating initial commit..."
if git rev-parse HEAD >/dev/null 2>&1; then
    echo "   Repository already has commits"
else
    git commit -m "Initial commit: YapMate voice invoice app

- Next.js 14 app with App Router
- Supabase authentication and database
- OpenAI Whisper integration for voice transcription
- Stripe payment processing
- Waitlist functionality
- Invoice generation and PDF export"
    echo "   ✓ Initial commit created"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Git repository setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo "   1. Create a new GitHub repository at: https://github.com/new"
echo "      Repository name: yapmate"
echo "      Keep it PRIVATE (contains business logic)"
echo "      DO NOT initialize with README, .gitignore, or license"
echo ""
echo "   2. Once created, run: ./deploy/2-connect-github.sh"
echo ""
