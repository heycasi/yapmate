# YapMate Billing Setup Guide

This guide covers the setup and configuration of YapMate's dual-platform billing system (Stripe for web, Apple IAP for iOS).

---

## Overview

YapMate uses a **hybrid billing architecture**:

- **Web/Desktop**: Stripe subscriptions (£15/mo Pro, £30/mo Trade)
- **iOS**: Apple In-App Purchases via StoreKit 2
- **Backend**: Server-side receipt verification + unified subscriptions table

All subscriptions sync to a single `subscriptions` table in Supabase, ensuring consistent plan enforcement across platforms.

---

## Phase 1: Stripe Setup (Web Subscriptions)

### 1.1 Create Stripe Products

Run the product setup script to create products and prices in Stripe:

```bash
npm install stripe
node scripts/setup-stripe-products.js
```

This creates:
- **YapMate Pro**: £15/month (product + recurring price)
- **YapMate Trade**: £30/month (product + recurring price)

The script outputs environment variables - **copy these to `.env.local`**:

```env
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_TRADE_PRICE_ID=price_xxxxx
STRIPE_PRO_PRODUCT_ID=prod_xxxxx
STRIPE_TRADE_PRODUCT_ID=prod_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx  # Already in .env.local
```

### 1.2 Set Up Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe-webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 1.3 Create Stripe Webhook Handler (TODO)

You'll need to create `app/api/stripe-webhook/route.ts` to:
- Verify webhook signature
- Update `subscriptions` table on subscription events
- Sync `user_preferences.plan` to match active subscription

---

## Phase 2: Apple IAP Setup (iOS Subscriptions)

### 2.1 Configure App Store Connect

1. **Create In-App Purchase Products**:
   - Go to App Store Connect → Your App → Subscriptions
   - Create subscription group: "YapMate Plans"
   - Add two auto-renewable subscriptions:
     - **Product ID**: `com.yapmate.pro.monthly`
     - **Price**: £14.99/month
     - **Product ID**: `com.yapmate.trade.monthly`
     - **Price**: £29.99/month

2. **Generate Shared Secret**:
   - App Store Connect → Your App → Subscriptions → App-Specific Shared Secret
   - Copy the shared secret

3. **Add to Environment Variables**:

```env
APPLE_IAP_SHARED_SECRET=xxxxx
```

### 2.2 Install Capacitor IAP Plugin

```bash
npm install @capacitor-community/in-app-purchases
npx cap sync ios
```

### 2.3 Configure iOS Capabilities

In Xcode:
1. Open `ios/App/App.xcodeproj`
2. Select target → Signing & Capabilities
3. Add "In-App Purchase" capability

---

## Phase 3: Verification & Sync

### 3.1 Apple Receipt Verification Flow

When a user purchases on iOS:

1. **Client** (`lib/iap.ts`):
   - Calls `InAppPurchases.purchaseProduct()`
   - Gets receipt data from StoreKit
   - Sends receipt to backend

2. **Backend** (`supabase/functions/verify-iap/index.ts`):
   - Validates receipt with Apple's `/verifyReceipt` API
   - Tries production first, falls back to sandbox
   - Extracts `original_transaction_id`, `product_id`, `expires_date_ms`
   - Upserts `subscriptions` table
   - Updates `user_preferences.plan`

3. **Client**:
   - Receives verified plan status
   - Reloads UI to reflect new entitlements

### 3.2 Restore Purchases

Users can restore purchases on new devices:

1. Settings page → "Restore Purchases" button (iOS only)
2. Calls `restorePurchases()` from `lib/iap.ts`
3. Fetches latest receipt from StoreKit
4. Verifies with backend
5. Syncs subscription to account

---

## Phase 4: Database Schema

### Subscriptions Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  stripe_subscription_id TEXT,        -- For web subscriptions
  apple_transaction_id TEXT,          -- For iOS subscriptions
  plan TEXT NOT NULL,                 -- 'free', 'pro', 'trade'
  status TEXT NOT NULL,               -- 'active', 'cancelled', 'expired', 'trial'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Usage Events Table

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,          -- 'invoice_created', etc.
  invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Phase 5: Plan Enforcement

### How It Works

1. **Centralized Access Control** (`lib/plan-access.ts`):
   - `getUserPlan(userId)` - Get current plan from `user_preferences`
   - `canUseVAT(userId)` - Check VAT feature access (Pro+ only)
   - `canUseCIS(userId)` - Check CIS feature access (Trade only)
   - `canCreateInvoice(userId)` - Check invoice limit (Free: 3, Pro/Trade: unlimited)

2. **UI Enforcement**:
   - Settings page disables VAT/CIS toggles if not available
   - Record page blocks invoice creation at limit
   - Pricing page shows current plan + upgrade options

3. **Save-Level Enforcement**:
   - Invoice/Settings save handlers force VAT/CIS=false if no access
   - Prevents client-side bypass

4. **Creation-Level Enforcement**:
   - Record page forces VAT/CIS=false on new invoices
   - PDF generation respects plan limits

---

## Phase 6: Testing

### 6.1 Test Stripe (Web)

1. Use Stripe test mode
2. Test card: `4242 4242 4242 4242`, any future date, any CVC
3. Create subscription → verify webhook fires → check `subscriptions` table

### 6.2 Test Apple IAP (iOS Sandbox)

1. **Create Sandbox Tester**:
   - App Store Connect → Users and Access → Sandbox Testers
   - Create test account

2. **Test on Device/Simulator**:
   - Sign out of real App Store account
   - Build and run app (`npx cap run ios`)
   - Click "Upgrade" on pricing page
   - Sign in with sandbox tester
   - Complete purchase
   - Verify plan updates in app

3. **Verify Backend**:
   - Check Supabase logs for `verify-iap` function
   - Check `subscriptions` table for new entry
   - Check `user_preferences.plan` updated

### 6.3 Test Restore Purchases

1. Delete and reinstall app
2. Log in with same account
3. Go to Settings → "Restore Purchases"
4. Verify plan restored

---

## Phase 7: Production Checklist

- [ ] Stripe live mode enabled
- [ ] Stripe webhook endpoint configured with live secret
- [ ] Apple IAP products approved and "Ready to Submit"
- [ ] `APPLE_IAP_SHARED_SECRET` uses production value
- [ ] Test purchases with real money on TestFlight
- [ ] Verify receipt validation works in production
- [ ] RLS policies tested and secure
- [ ] Usage logging working correctly
- [ ] Plan enforcement tested at all levels

---

## Architecture Diagram

```
┌─────────────────────┐
│   iOS App (Native)  │
│   ┌─────────────┐   │
│   │  StoreKit 2 │   │
│   └──────┬──────┘   │
└──────────┼──────────┘
           │ Receipt
           ▼
┌──────────────────────┐
│  verify-iap Function │
│  ┌────────────────┐  │
│  │ Apple API Call │  │
│  │ /verifyReceipt │  │
│  └────────────────┘  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐       ┌──────────────────┐
│  Subscriptions Table │◄──────┤ Stripe Webhooks  │
│  ┌────────────────┐  │       │ (customer.sub.*) │
│  │ Unified Source │  │       └──────────────────┘
│  │   of Truth     │  │
│  └────────────────┘  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ User Preferences     │
│ (plan synced)        │
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Plan Enforcement    │
│  • UI Gating         │
│  • Feature Access    │
│  • Invoice Limits    │
└──────────────────────┘
```

---

## Troubleshooting

### "Receipt verification failed"
- Check `APPLE_IAP_SHARED_SECRET` is correct
- Verify using sandbox account in test mode
- Check Supabase function logs for Apple API errors

### "No purchases found" on restore
- Ensure using same Apple ID as original purchase
- Verify subscription hasn't expired
- Check subscription is auto-renewable (not consumable)

### Plan not updating after purchase
- Check `subscriptions` table directly
- Verify `user_preferences.plan` updated
- Check edge function logs for errors
- Ensure RLS policies allow service role to upsert

### Stripe webhook not firing
- Verify endpoint URL is correct and publicly accessible
- Check webhook signing secret matches `.env.local`
- Test webhook with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

---

## Support

For billing-related issues:
1. Check Supabase function logs
2. Check Stripe Dashboard logs (for web subscriptions)
3. Check App Store Connect → Sales and Trends (for iOS)
4. Review `subscriptions` and `usage_events` tables
