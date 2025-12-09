#!/bin/bash

#############################################
# YapMate - Step 7: Verify Deployment
# This script tests the production deployment
#############################################

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 YAPMATE - Deployment Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/conzo/dev/yapmate

# Get production URL
if [ -f "deploy/production-urls.txt" ]; then
    PRODUCTION_URL=$(grep "Production URL:" deploy/production-urls.txt | cut -d' ' -f3)
else
    read -p "Enter your production URL: " PRODUCTION_URL
fi

if [ -z "$PRODUCTION_URL" ]; then
    echo "❌ Production URL required"
    exit 1
fi

echo "🌐 Testing deployment at: $PRODUCTION_URL"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2

    echo -n "   Testing: $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo "✅ PASS"
        ((TESTS_PASSED++))
        return 0
    else
        echo "❌ FAIL"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Running Automated Tests..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Basic Connectivity Tests"
echo ""

# Test 1: Homepage loads
run_test "Homepage loads (HTTP 200)" "curl -s -o /dev/null -w '%{http_code}' $PRODUCTION_URL | grep -q 200"

# Test 2: Waitlist page loads
run_test "Waitlist page loads" "curl -s -o /dev/null -w '%{http_code}' $PRODUCTION_URL/waitlist | grep -q 200"

# Test 3: API endpoint responds
run_test "API routes accessible" "curl -s -o /dev/null -w '%{http_code}' $PRODUCTION_URL/api/waitlist | grep -q '[2-4][0-9][0-9]'"

echo ""
echo "2️⃣  Resource Loading Tests"
echo ""

# Test 4: Check if Next.js is serving correctly
run_test "Next.js app initialized" "curl -s $PRODUCTION_URL | grep -q 'Next'"

# Test 5: Check for build errors
if curl -s $PRODUCTION_URL | grep -qi "application error"; then
    echo "   Testing: No application errors... ❌ FAIL (errors found)"
    ((TESTS_FAILED++))
else
    echo "   Testing: No application errors... ✅ PASS"
    ((TESTS_PASSED++))
fi

echo ""
echo "3️⃣  Environment Configuration Tests"
echo ""

# Test 6: Check if Supabase is configured
if curl -s $PRODUCTION_URL | grep -q "supabase"; then
    echo "   Testing: Supabase connection configured... ✅ PASS"
    ((TESTS_PASSED++))
else
    echo "   Testing: Supabase connection configured... ⚠️  WARNING (may be server-side only)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Passed: $TESTS_PASSED"
echo "   Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✅ All automated tests passed!"
else
    echo "⚠️  Some tests failed - manual verification recommended"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Manual Testing Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Please manually test the following in your browser:"
echo ""

echo "🌐 Pages:"
echo "   [ ] Homepage: $PRODUCTION_URL"
echo "   [ ] Waitlist: $PRODUCTION_URL/waitlist"
echo "   [ ] Login: $PRODUCTION_URL/login"
echo "   [ ] Dashboard: $PRODUCTION_URL/dashboard (after login)"
echo ""

echo "✉️  Waitlist Form:"
echo "   [ ] Submit email → Success message appears"
echo "   [ ] Check Supabase for new entry"
echo "   [ ] Try duplicate email → Handles gracefully"
echo ""

echo "🔐 Authentication (if implemented):"
echo "   [ ] Sign up flow works"
echo "   [ ] Login flow works"
echo "   [ ] Email verification works"
echo "   [ ] Redirect URLs work correctly"
echo ""

echo "🎤 Voice Features (if using OpenAI):"
echo "   [ ] Can access /record page"
echo "   [ ] Voice recording works"
echo "   [ ] Transcription processes"
echo "   [ ] Invoice extraction works"
echo ""

echo "💳 Payment Features (if using Stripe):"
echo "   [ ] Payment links generate"
echo "   [ ] Stripe checkout works"
echo "   [ ] Webhooks receive events"
echo ""

echo "📱 Responsive Design:"
echo "   [ ] Mobile view works"
echo "   [ ] Tablet view works"
echo "   [ ] Desktop view works"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Debugging Resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Vercel Logs:"
echo "   • Dashboard: https://vercel.com (select your project)"
echo "   • CLI: vercel logs --follow"
echo ""

if [ -f ".env.local" ]; then
    source .env.local
    SUPABASE_PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')

    if [ ! -z "$SUPABASE_PROJECT_REF" ]; then
        echo "Supabase Logs:"
        echo "   • Dashboard: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/logs"
        echo ""
    fi
fi

echo "Common Issues & Solutions:"
echo ""

echo "❌ 500 Internal Server Error:"
echo "   → Check Vercel logs for errors"
echo "   → Verify environment variables are set"
echo "   → Check API route syntax errors"
echo ""

echo "❌ Database Connection Failed:"
echo "   → Verify SUPABASE_SERVICE_ROLE_KEY in Vercel"
echo "   → Check Supabase project status"
echo "   → Verify RLS policies allow operations"
echo ""

echo "❌ OpenAI API Errors:"
echo "   → Verify OPENAI_API_KEY is correct"
echo "   → Check API usage limits"
echo "   → Test with smaller audio files first"
echo ""

echo "❌ Stripe Errors:"
echo "   → Verify STRIPE_SECRET_KEY (use live keys for production)"
echo "   → Check webhook endpoints are configured"
echo "   → Verify Stripe account is activated"
echo ""

echo "❌ Environment Variables Not Loading:"
echo "   → Redeploy after adding env vars: vercel --prod"
echo "   → Check variable names match exactly (case-sensitive)"
echo "   → Verify NEXT_PUBLIC_ prefix for client-side vars"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📝 Post-Deployment Actions:"
echo ""
echo "   1. Set up monitoring (optional):"
echo "      • Vercel Analytics"
echo "      • Sentry for error tracking"
echo "      • LogRocket for session replay"
echo ""
echo "   2. Set up custom domain (optional):"
echo "      • Vercel Dashboard → Domains"
echo "      • Add CNAME record in DNS"
echo ""
echo "   3. Configure CI/CD (optional):"
echo "      • Automatic deployments from GitHub"
echo "      • Preview deployments for PRs"
echo ""
echo "   4. Share with users!"
echo "      • Test with beta users"
echo "      • Collect feedback"
echo "      • Iterate and improve"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
