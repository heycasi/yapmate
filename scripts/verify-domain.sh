#!/bin/bash

#######################################
# YapMate - Domain Verification Script
# Checks DNS, deployment, and routing
#######################################

set -e

DOMAIN="yapmate.co.uk"
WWW_DOMAIN="www.yapmate.co.uk"
VERCEL_IP="76.76.21.21"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 YapMate Domain Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
if ! command_exists dig; then
    echo "⚠️  'dig' command not found. Install with: brew install bind"
    echo ""
fi

if ! command_exists curl; then
    echo "❌ 'curl' command not found. Please install curl."
    exit 1
fi

echo "📋 Checking DNS Records..."
echo ""

# Check A record
echo "1️⃣  A Record for $DOMAIN"
if command_exists dig; then
    A_RECORD=$(dig +short $DOMAIN A | head -1)
    if [ "$A_RECORD" == "$VERCEL_IP" ]; then
        echo "   ✅ CORRECT: $A_RECORD"
    elif [ -z "$A_RECORD" ]; then
        echo "   ❌ NOT SET: No A record found"
        echo "   💡 Add A record: @ → $VERCEL_IP"
    else
        echo "   ⚠️  WRONG: $A_RECORD (should be $VERCEL_IP)"
        echo "   💡 Update A record to: $VERCEL_IP"
    fi
else
    echo "   ⏭️  Skipped (dig not available)"
fi
echo ""

# Check CNAME record
echo "2️⃣  CNAME Record for $WWW_DOMAIN"
if command_exists dig; then
    CNAME_RECORD=$(dig +short $WWW_DOMAIN CNAME | head -1)
    if [[ "$CNAME_RECORD" == "cname.vercel-dns.com"* ]]; then
        echo "   ✅ CORRECT: $CNAME_RECORD"
    elif [ -z "$CNAME_RECORD" ]; then
        echo "   ❌ NOT SET: No CNAME record found"
        echo "   💡 Add CNAME: www → cname.vercel-dns.com."
    else
        echo "   ⚠️  WRONG: $CNAME_RECORD"
        echo "   💡 Update CNAME to: cname.vercel-dns.com."
    fi
else
    echo "   ⏭️  Skipped (dig not available)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Testing HTTP Responses..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test root domain
echo "3️⃣  Testing https://$DOMAIN"
ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "https://$DOMAIN" 2>/dev/null || echo "000")
if [ "$ROOT_STATUS" == "200" ]; then
    echo "   ✅ SUCCESS: HTTP $ROOT_STATUS"
elif [ "$ROOT_STATUS" == "000" ]; then
    echo "   ❌ FAILED: Cannot connect"
    echo "   💡 DNS may not be propagated yet"
else
    echo "   ⚠️  HTTP $ROOT_STATUS"
    if [ "$ROOT_STATUS" == "404" ]; then
        echo "   💡 Domain resolves but page not found"
    elif [ "$ROOT_STATUS" == "301" ] || [ "$ROOT_STATUS" == "302" ]; then
        echo "   💡 Redirecting (this may be expected)"
    fi
fi
echo ""

# Test www domain
echo "4️⃣  Testing https://$WWW_DOMAIN"
WWW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "https://$WWW_DOMAIN" 2>/dev/null || echo "000")
if [ "$WWW_STATUS" == "200" ]; then
    echo "   ✅ SUCCESS: HTTP $WWW_STATUS"
elif [ "$WWW_STATUS" == "000" ]; then
    echo "   ❌ FAILED: Cannot connect"
    echo "   💡 DNS may not be propagated yet"
else
    echo "   ⚠️  HTTP $WWW_STATUS"
fi
echo ""

# Test waitlist route
echo "5️⃣  Testing https://$DOMAIN/waitlist"
WAITLIST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "https://$DOMAIN/waitlist" 2>/dev/null || echo "000")
if [ "$WAITLIST_STATUS" == "200" ]; then
    echo "   ✅ SUCCESS: HTTP $WAITLIST_STATUS"
elif [ "$WAITLIST_STATUS" == "000" ]; then
    echo "   ❌ FAILED: Cannot connect"
    echo "   💡 Root domain must work first"
else
    echo "   ⚠️  HTTP $WAITLIST_STATUS"
    if [ "$WAITLIST_STATUS" == "404" ]; then
        echo "   💡 Route not found - check deployment"
    fi
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count successes
SUCCESS_COUNT=0
TOTAL_CHECKS=3

if [ "$ROOT_STATUS" == "200" ]; then
    ((SUCCESS_COUNT++))
fi
if [ "$WWW_STATUS" == "200" ]; then
    ((SUCCESS_COUNT++))
fi
if [ "$WAITLIST_STATUS" == "200" ]; then
    ((SUCCESS_COUNT++))
fi

echo "Passed: $SUCCESS_COUNT / $TOTAL_CHECKS tests"
echo ""

if [ "$SUCCESS_COUNT" == "$TOTAL_CHECKS" ]; then
    echo "🎉 All checks passed! Your domain is working correctly."
    echo ""
    echo "✅ https://$DOMAIN"
    echo "✅ https://$WWW_DOMAIN"
    echo "✅ https://$DOMAIN/waitlist"
elif [ "$SUCCESS_COUNT" == "0" ]; then
    echo "❌ All tests failed. Likely causes:"
    echo ""
    echo "1. DNS records not set correctly on GoDaddy"
    echo "2. DNS hasn't propagated yet (wait 10-60 minutes)"
    echo "3. Domain not added to Vercel project"
    echo ""
    echo "📖 See DOMAIN_FIX_GUIDE.md for detailed instructions"
else
    echo "⚠️  Some tests failed. Your setup is partially working."
    echo ""
    echo "💡 If DNS is newly updated, wait 10-60 minutes and run again:"
    echo "   ./scripts/verify-domain.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
