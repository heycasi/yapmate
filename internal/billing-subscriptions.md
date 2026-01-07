# YapMate Billing & Subscriptions: Internal Reference

**Last Updated:** January 2026
**Audience:** Engineering team
**Maintained by:** Platform team

---

## Architecture Overview

YapMate uses **RevenueCat** as an abstraction layer over **Apple In-App Purchases (StoreKit 2)**. RevenueCat handles:
- Purchase validation
- Receipt management
- Webhook delivery
- Subscription state management
- Cross-platform abstractions (we only use iOS)

We store subscription state in **Supabase** for quick access and feature gating without hitting RevenueCat on every request.

---

## Product IDs & Entitlements

### Product IDs (Apple App Store Connect)

| Product ID | Plan | Price | Trial | Type |
|------------|------|-------|-------|------|
| `com.yapmate.pro.monthly` | Pro | £15/month | 7 days | Auto-renewable subscription |
| `com.yapmate.trade.monthly` | Trade | £25/month | 7 days | Auto-renewable subscription |

### Entitlements (RevenueCat)

| Entitlement ID | Plan | Features |
|----------------|------|----------|
| `pro` | Pro | Unlimited invoices, VAT, Reverse Charge, Customer list |
| `trade` | Trade | All Pro features + CIS deductions + Bank details |

**Access logic:**
- Free plan = no entitlements
- Pro plan = `pro` entitlement
- Trade plan = `trade` entitlement (implies `pro` access)

---

## Subscription States

### RevenueCat States

| State | Description | User Access | Billing |
|-------|-------------|-------------|---------|
| `trialing` | 7-day free trial active | Full plan access | No charge yet |
| `active` | Paid subscription active | Full plan access | Auto-renews monthly |
| `cancelled` | User cancelled, period not ended yet | Full plan access until `period_end_date` | No future charges |
| `expired` | Subscription period ended | No access (drops to Free) | No charges |
| `billing_issue` | Payment failed, in grace period | Full plan access (grace period) | Apple retrying payment |
| `refunded` | Apple refunded the charge | No access | No future charges |

### Supabase States (subscriptions table)

We mirror RevenueCat states in the `subscriptions` table for fast access:

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'revenuecat', 'apple' (legacy), 'stripe' (legacy)
  subscription_id TEXT NOT NULL, -- RevenueCat subscription ID
  product_id TEXT NOT NULL, -- 'com.yapmate.pro.monthly' or 'com.yapmate.trade.monthly'
  status TEXT NOT NULL, -- 'trialing', 'active', 'cancelled', 'expired', etc.
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### User Plan (user_preferences table)

The `user_preferences.plan` field is the **source of truth** for feature gating:

```sql
ALTER TABLE user_preferences ADD COLUMN plan TEXT DEFAULT 'free';
-- Values: 'free', 'pro', 'trade'
```

**Sync logic:**
- `sync-revenuecat` edge function receives webhooks from RevenueCat
- Updates `subscriptions` table with latest state
- Updates `user_preferences.plan` based on active entitlements
- If user has `trade` entitlement → `plan = 'trade'`
- If user has `pro` entitlement (but not `trade`) → `plan = 'pro'`
- If user has no entitlements → `plan = 'free'`

---

## Flow Diagrams

### Purchase Flow

```
User taps "Start Trial" in app
  ↓
lib/iap.ts → RevenueCat SDK → Apple StoreKit
  ↓
Apple validates purchase, starts trial
  ↓
RevenueCat sends webhook to sync-revenuecat edge function
  ↓
Edge function updates Supabase:
  - subscriptions.status = 'trialing'
  - user_preferences.plan = 'pro' or 'trade'
  ↓
App checks plan via lib/plan-access.ts → getUserPlan()
  ↓
User sees Pro/Trade features enabled
```

### Cancellation Flow

```
User cancels in iPhone Settings
  ↓
Apple marks subscription as "will not renew"
  ↓
RevenueCat sends CANCELLATION webhook
  ↓
sync-revenuecat edge function updates Supabase:
  - subscriptions.status = 'cancelled'
  - subscriptions.cancel_at_period_end = true
  - user_preferences.plan stays 'pro' or 'trade' until period ends
  ↓
On period_end_date:
  RevenueCat sends EXPIRATION webhook
  ↓
  sync-revenuecat updates Supabase:
    - subscriptions.status = 'expired'
    - user_preferences.plan = 'free'
  ↓
User drops to Free plan
```

### Restore Purchases Flow

```
User taps "Restore Purchases" in Settings
  ↓
lib/iap.ts → RevenueCat.restorePurchases()
  ↓
RevenueCat fetches latest receipt from Apple
  ↓
If active subscription found:
  RevenueCat sends webhook to sync-revenuecat
  ↓
  Edge function updates Supabase (same as purchase flow)
  ↓
  App shows success message
Else:
  App shows "No subscription found"
```

---

## Key Files

### Frontend (Next.js + Capacitor)

| File | Purpose |
|------|---------|
| `lib/iap.ts` | RevenueCat SDK wrapper. Handles `purchasePackage()`, `restorePurchases()`, `getCustomerInfo()` |
| `lib/iap-sync.ts` | Client-side sync function. Calls `sync-revenuecat` edge function to force sync |
| `lib/plan-access.ts` | `getUserPlan()`, `checkFeatureAccess()`. Reads from Supabase `user_preferences.plan` |
| `lib/use-subscription.ts` | React hook for subscription state. Returns `{ plan, isLoading, error }` |
| `components/IAPProvider.tsx` | React context provider. Wraps app, provides IAP state to all components |
| `app/pricing/page.tsx` | Pricing page. Shows plans, trial buttons, calls `iap.ts` to purchase |
| `app/settings/page.tsx` | Settings page. Shows subscription status, "Restore Purchases" button |

### Backend (Supabase Edge Functions)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `sync-revenuecat` | RevenueCat webhook OR client call | Updates Supabase with latest subscription state from RevenueCat |
| `verify-iap` | (Legacy) | Returns 410 Gone. Replaced by `sync-revenuecat` |

### Database (Supabase)

| Table | Purpose |
|-------|---------|
| `user_preferences` | User settings. `plan` field is source of truth for feature gating |
| `subscriptions` | Subscription records. Mirrors RevenueCat state for fast access |

---

## Webhook Events (RevenueCat)

RevenueCat sends webhooks to:
```
https://nidijdprgoauwkmuioer.supabase.co/functions/v1/sync-revenuecat
```

**Events we handle:**

| Event | Description | Action |
|-------|-------------|--------|
| `INITIAL_PURCHASE` | User completes first purchase | Create `subscriptions` record, set `plan = 'pro'` or `'trade'` |
| `RENEWAL` | Subscription auto-renewed | Update `current_period_start` and `current_period_end` |
| `CANCELLATION` | User cancelled (but still has access) | Set `cancel_at_period_end = true`, `status = 'cancelled'` |
| `EXPIRATION` | Subscription period ended | Set `status = 'expired'`, `plan = 'free'` |
| `BILLING_ISSUE` | Payment failed, grace period started | Set `status = 'billing_issue'` |
| `PRODUCT_CHANGE` | User upgraded (Pro → Trade) | Update `product_id`, `plan = 'trade'` |

**Event payload example:**

```json
{
  "event": {
    "type": "INITIAL_PURCHASE",
    "app_user_id": "user-uuid-here",
    "product_id": "com.yapmate.pro.monthly",
    "period_type": "trial",
    "purchased_at_ms": 1704067200000,
    "expiration_at_ms": 1704672000000,
    "entitlements": ["pro"]
  }
}
```

---

## Feature Gating Logic

### On Frontend

```typescript
// lib/plan-access.ts
export async function checkFeatureAccess(feature: string): Promise<boolean> {
  const plan = await getUserPlan();

  const featureMap = {
    'unlimited_invoices': ['pro', 'trade'],
    'vat_support': ['pro', 'trade'],
    'reverse_charge': ['pro', 'trade'],
    'customer_list': ['pro', 'trade'],
    'cis_deductions': ['trade'],
    'bank_details': ['trade'],
  };

  return featureMap[feature]?.includes(plan) || false;
}
```

### On Backend (RLS Policies)

We do NOT gate API access by plan. All users can create invoices, but the frontend enforces limits.

**Why?**
- Simpler RLS policies
- Prevents sync issues ("user created invoice but plan sync failed")
- Frontend is trusted (Capacitor wraps Next.js static export)

**Exception:** We DO enforce invoice count limits for Free plan in the frontend before allowing creation.

---

## Edge Cases & Gotchas

### 1. User deletes app, reinstalls, signs in

**Expected behavior:**
- User taps "Restore Purchases"
- RevenueCat fetches latest receipt from Apple
- Webhook fires, Supabase updated
- User sees correct plan

**Gotcha:** If user never taps "Restore Purchases," they'll see Free plan until they do.

**Fix:** Auto-call `restorePurchases()` on first app launch after sign-in (lib/iap.ts handles this).

---

### 2. User upgrades Pro → Trade mid-cycle

**Expected behavior:**
- Apple charges pro-rated amount immediately
- RevenueCat sends `PRODUCT_CHANGE` webhook
- User's plan updates to `trade` instantly

**Gotcha:** User sees two charges in Apple receipt (pro-rated upgrade + next full billing cycle).

**Fix:** Support team explains pro-rated billing (see support/playbook.md #5).

---

### 3. User downgrades Trade → Pro

**Expected behavior:**
- User cancels Trade in iPhone Settings
- User waits until Trade period ends
- User subscribes to Pro

**Gotcha:** There's no "downgrade" button in Apple subscriptions. User must cancel and re-subscribe.

**Fix:** Support team explains workaround (see support/playbook.md #8).

---

### 4. Webhook delivery fails (network error, edge function timeout)

**Expected behavior:**
- RevenueCat retries webhook up to 3 times
- If all retries fail, RevenueCat logs error in dashboard

**Gotcha:** User's plan in Supabase is out of sync with Apple subscription.

**Fix:**
- User taps "Restore Purchases" to force sync
- Engineering monitors RevenueCat dashboard for failed webhooks
- Edge function has 60-second timeout (configured in Supabase)

---

### 5. User requests refund from Apple

**Expected behavior:**
- Apple approves refund
- RevenueCat sends `REFUND` webhook (note: not `EXPIRATION`)
- Edge function sets `status = 'refunded'`, `plan = 'free'`

**Gotcha:** User loses access immediately, even if they're mid-period.

**Fix:** This is Apple's policy. We can't override it.

---

### 6. User has multiple Apple IDs

**Expected behavior:**
- Subscriptions are tied to Apple ID, not YapMate account
- User signs in to YapMate with email A, but subscribed with Apple ID B
- User sees Free plan in app

**Gotcha:** User claims they're subscribed but app shows Free.

**Fix:** Support team asks user to confirm Apple ID matches (see support/playbook.md #6).

---

### 7. Billing grace period (payment failed, Apple retrying)

**Expected behavior:**
- Apple retries payment for 60 days (grace period)
- RevenueCat sends `BILLING_ISSUE` webhook
- User keeps access during grace period
- If payment succeeds, RevenueCat sends `RENEWAL` webhook
- If payment fails for 60 days, RevenueCat sends `EXPIRATION` webhook

**Gotcha:** User may not know their payment failed. They still have access.

**Fix:**
- Show warning in app if `status = 'billing_issue'`
- Encourage user to update payment method in iPhone Settings

---

## Debugging Checklist

### User reports "I'm subscribed but app shows Free plan"

1. Check Supabase `user_preferences.plan` for their user ID
2. Check Supabase `subscriptions` table for active subscription record
3. Check RevenueCat dashboard for their user ID (RevenueCat uses `user_id` as app_user_id)
4. Compare RevenueCat state vs Supabase state
5. If out of sync: manually call `sync-revenuecat` edge function with their user ID
6. If still out of sync: check RevenueCat webhook logs for failed deliveries

### User reports "Restore Purchases doesn't work"

1. Confirm user is signed in with correct Apple ID (iPhone Settings → Apple ID)
2. Check if subscription exists in Apple App Store Connect (if you have access)
3. Check RevenueCat dashboard for user's subscription
4. Ask user to try:
   - Restart app
   - Sign out of Apple ID, sign back in
   - Reinstall app (last resort)
5. If still broken: manually sync user via `sync-revenuecat` edge function

### Webhook not firing

1. Check RevenueCat dashboard → Integrations → Webhooks
2. Verify webhook URL is correct: `https://nidijdprgoauwkmuioer.supabase.co/functions/v1/sync-revenuecat`
3. Check recent webhook deliveries for errors
4. Check Supabase edge function logs for errors or timeouts
5. Test webhook manually via RevenueCat dashboard "Send Test Event"

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` | Frontend (.env.local) | RevenueCat SDK initialization |
| `REVENUECAT_WEBHOOK_SECRET` | Supabase Edge Function | Verify webhook authenticity |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function | Admin access to Supabase (bypasses RLS) |

---

## Monitoring & Alerts

### Metrics to track

- **Subscription conversion rate:** % of users who start trial → % who convert to paid
- **Trial cancellation rate:** % of users who cancel during 7-day trial
- **Churn rate:** % of users who cancel after first billing cycle
- **Webhook failure rate:** % of RevenueCat webhooks that fail delivery
- **Restore Purchases success rate:** % of restore attempts that succeed

### Alerts to set up

- RevenueCat webhook failure rate > 5%
- Supabase edge function error rate > 1%
- User reports "Restore Purchases doesn't work" more than 3 times per week

---

## Testing

### Test Accounts (Sandbox)

Use Apple's Sandbox environment for testing subscriptions:

1. Create a sandbox tester account in App Store Connect
2. Sign in to sandbox account on your test iPhone
3. Build app in DEBUG mode (uses RevenueCat test environment)
4. Complete purchase flow (no real money charged)
5. Apple accelerates subscription lifecycle: 1 month = 5 minutes (trial = 3 minutes)

### Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Start Pro trial | `plan = 'pro'`, `status = 'trialing'`, full Pro access |
| Wait 3 minutes (trial ends) | Apple auto-charges, `status = 'active'` |
| Cancel subscription | `status = 'cancelled'`, access until period ends |
| Wait for period end | `status = 'expired'`, `plan = 'free'` |
| Upgrade Pro → Trade | `plan = 'trade'`, pro-rated charge, immediate Trade access |
| Restore Purchases | Subscription state syncs from RevenueCat to Supabase |

---

## Support Escalation

| Issue | Action |
|-------|--------|
| User claims duplicate charge | Ask for Apple receipt screenshot, check Supabase logs, escalate to Apple Support if confirmed |
| Webhook sync broken | Check RevenueCat dashboard, check Supabase edge function logs, manually sync user |
| RevenueCat API down | Check RevenueCat status page (status.revenuecat.com), inform users via app banner |
| Apple IAP down | Check Apple system status (developer.apple.com/system-status), inform users |

---

## References

- **RevenueCat Docs:** https://docs.revenuecat.com
- **Apple StoreKit Docs:** https://developer.apple.com/documentation/storekit
- **Apple Subscription Guide:** https://developer.apple.com/app-store/subscriptions/
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions

---

**Version 1.0** • Updated January 2026
**Maintained by:** Platform Team
