# Trade Tier - Quick Re-Enablement Guide

**Status:** Currently DISABLED for v1.0
**Location:** All Trade code preserved in this directory

---

## ⚡ Quick Re-Enable (5 minutes)

### 1. Set Environment Variable
```bash
# In .env.local
NEXT_PUBLIC_ENABLE_TRADE_TIER=true
```

### 2. Configure RevenueCat
- Dashboard → Products → Add `com.yapmate.trade.monthly`
- Dashboard → Entitlements → Add `trade`
- Dashboard → Offerings → Add to `default` offering

### 3. Configure App Store Connect
- Create IAP: `com.yapmate.trade.monthly`
- Price: £25/month, 7-day trial
- Submit for review
- Attach to app version

### 4. Rebuild & Test
```bash
npm run build
npx cap sync ios
# Test on device
```

---

## 📋 What Happens When Re-Enabled

**UI Changes:**
- ✅ Pricing page shows 3 cards (Free, Pro, Trade)
- ✅ Grid becomes 3 columns on desktop
- ✅ Header says "Pro & Trade plans"
- ✅ CIS toggle appears in Settings
- ✅ Terms lists Trade plan

**Backend Changes:**
- ✅ `canUseCIS()` returns true for Trade users
- ✅ `getActivePlan()` returns 'trade' for Trade entitlements
- ✅ Database sync treats Trade as 'trade' (not Pro)

**User Impact:**
- Existing users with Trade entitlements get Trade features back
- CIS deduction becomes available
- No data migration needed

---

## 📁 Configuration Reference

All Trade configuration preserved in:
- `trade-tier-config.ts` - Product IDs, pricing, features
- `README.md` - Full re-enablement guide

---

## ⚠️ Important Notes

- Environment variable change requires rebuild
- RevenueCat configuration required (not just env var)
- App Store Connect approval required for IAP
- Test thoroughly before production deployment

**Last Updated:** January 14, 2026
