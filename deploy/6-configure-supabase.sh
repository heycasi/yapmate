#!/bin/bash

#############################################
# YapMate - Step 6: Configure Supabase for Production
# This script guides you through Supabase configuration
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Supabase Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Load env vars to get Supabase project
source .env.local 2>/dev/null || {
    echo "❌ Error: .env.local not found"
    exit 1
}

# Extract Supabase project ref
SUPABASE_PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ Error: Could not extract Supabase project reference"
    echo "   NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
    exit 1
fi

echo "📋 Supabase Project Information:"
echo "   Project Ref: $SUPABASE_PROJECT_REF"
echo "   Dashboard: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF"
echo ""

# Get deployment URL from .vercel/project.json or ask user
if [ -f ".vercel/project.json" ]; then
    PROJECT_NAME=$(cat .vercel/project.json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    echo "📋 Vercel Project: $PROJECT_NAME"
    echo ""
    echo "🌐 Your production URL is likely:"
    echo "   https://$PROJECT_NAME.vercel.app"
    echo ""
    echo "Or check your custom domain if you have one."
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 REQUIRED: Update Supabase Settings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "You need to manually configure these settings in Supabase:"
echo ""

echo "1️⃣  SITE URL Configuration"
echo "   ─────────────────────────────────────"
echo "   Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/auth/url-configuration"
echo ""
echo "   Update Site URL to:"

read -p "   Enter your production URL (e.g., https://yapmate.vercel.app): " PRODUCTION_URL

if [ -z "$PRODUCTION_URL" ]; then
    echo "   ⚠️  No URL entered. Using placeholder."
    PRODUCTION_URL="https://yapmate.vercel.app"
fi

echo ""
echo "   ✓ Site URL should be: $PRODUCTION_URL"
echo ""

echo "2️⃣  REDIRECT URLs Configuration"
echo "   ─────────────────────────────────────"
echo "   In the same page, add these Redirect URLs:"
echo ""
echo "   • $PRODUCTION_URL/auth/callback"
echo "   • $PRODUCTION_URL/api/auth/callback"
echo "   • http://localhost:3000/auth/callback (for local dev)"
echo "   • http://localhost:3000/api/auth/callback (for local dev)"
echo ""

echo "3️⃣  EMAIL TEMPLATES (Optional)"
echo "   ─────────────────────────────────────"
echo "   Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/auth/templates"
echo ""
echo "   Update email templates to reference:"
echo "   • Production: $PRODUCTION_URL"
echo "   • Keep HeyCasi templates separate (different Supabase project)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Press ENTER once you've updated Supabase settings..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Verifying YapMate/HeyCasi Separation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ Checklist:"
echo "   [ ] YapMate uses Supabase project: $SUPABASE_PROJECT_REF"
echo "   [ ] HeyCasi uses a DIFFERENT Supabase project"
echo "   [ ] Site URLs are different between projects"
echo "   [ ] Redirect URLs don't overlap"
echo "   [ ] Environment variables are in separate Vercel projects"
echo ""

read -p "Confirm all projects are separate? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "⚠️  Please verify project separation before continuing"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Supabase configuration complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Save configuration
mkdir -p deploy
cat > deploy/production-urls.txt << EOF
YapMate Production Configuration
Generated: $(date)

Production URL: $PRODUCTION_URL
Supabase Project: $SUPABASE_PROJECT_REF
Supabase Dashboard: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF

Redirect URLs configured:
- $PRODUCTION_URL/auth/callback
- $PRODUCTION_URL/api/auth/callback
- http://localhost:3000/auth/callback
- http://localhost:3000/api/auth/callback
EOF

echo "📝 Configuration saved to: deploy/production-urls.txt"
echo ""
echo "📝 Next step:"
echo "   Run: ./deploy/7-verify-deployment.sh"
echo ""
