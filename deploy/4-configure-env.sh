#!/bin/bash

#############################################
# YapMate - Step 4: Configure Environment Variables
# This script pushes environment variables to Vercel
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Environment Variables Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found!"
    echo "   This file is required to push environment variables"
    exit 1
fi

# Check if Vercel is linked
if [ ! -d ".vercel" ]; then
    echo "❌ Error: Vercel project not linked!"
    echo "   Run ./deploy/3-setup-vercel.sh first"
    exit 1
fi

echo "📋 Environment Variables Required for YapMate:"
echo ""
echo "   🔴 CRITICAL (App won't work without these):"
echo "      • NEXT_PUBLIC_SUPABASE_URL"
echo "      • NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "      • SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "   🟡 FEATURES (Specific functionality):"
echo "      • OPENAI_API_KEY (voice transcription)"
echo "      • STRIPE_SECRET_KEY (payment processing)"
echo "      • RESEND_API_KEY (email sending)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Current Environment Variables in .env.local:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract variable names (not values for security)
grep -v '^#' .env.local | grep -v '^$' | cut -d'=' -f1 | while read varname; do
    if [ ! -z "$varname" ]; then
        echo "   ✓ $varname"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask which environment to configure
echo "🎯 Which environment do you want to configure?"
echo "   1) Production only"
echo "   2) Preview only"
echo "   3) Development only"
echo "   4) All environments (Production + Preview + Development)"
echo ""

read -p "Enter choice (1-4): " env_choice

case $env_choice in
    1)
        ENV_FLAGS="--environment production"
        ENV_NAME="Production"
        ;;
    2)
        ENV_FLAGS="--environment preview"
        ENV_NAME="Preview"
        ;;
    3)
        ENV_FLAGS="--environment development"
        ENV_NAME="Development"
        ;;
    4)
        ENV_FLAGS="--environment production --environment preview --environment development"
        ENV_NAME="All"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Will configure: $ENV_NAME environment(s)"
echo ""

# Function to add env var
add_env_var() {
    local var_name=$1
    local var_value=$2

    if [ -z "$var_value" ]; then
        echo "   ⏭️  Skipping $var_name (not found in .env.local)"
        return
    fi

    echo "   📤 Adding $var_name..."

    # Use printf to handle special characters properly
    printf "%s" "$var_value" | vercel env add "$var_name" $ENV_FLAGS --force > /dev/null 2>&1 || {
        echo "      ⚠️  Failed to add $var_name (might already exist)"
    }
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 Pushing Environment Variables to Vercel..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load and push each variable
source .env.local

echo "🔴 Critical Variables:"
add_env_var "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"
add_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
add_env_var "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"

echo ""
echo "🟡 Feature Variables:"
add_env_var "OPENAI_API_KEY" "$OPENAI_API_KEY"
add_env_var "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
add_env_var "RESEND_API_KEY" "$RESEND_API_KEY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Environment variables configured!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔍 Verifying environment variables..."
echo ""
vercel env ls
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: YapMate and HeyCasi are SEPARATE"
echo "   - These env vars are ONLY for YapMate"
echo "   - HeyCasi env vars are NOT affected"
echo "   - Both projects use separate Vercel configurations"
echo ""
echo "📝 Next step:"
echo "   Run: ./deploy/5-deploy.sh"
echo ""
