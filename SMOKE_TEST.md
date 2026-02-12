# Beta Access Smoke Test

Quick validation steps for the beta invites feature.

## 1. Deploy Migration

**Via Supabase CLI:**
```bash
cd /Users/conzo/dev/yapmate
supabase db push
```

**Via Dashboard:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/migrations/012_beta_invites.sql`
3. Run

## 2. Set Environment Variables

Add to `.env.local`:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get the service role key from: Supabase Dashboard → Settings → API → `service_role` (secret)

## 3. Grant Beta Access

```bash
# Default: 7 days of Pro
npx tsx scripts/grant-beta.ts user@example.com

# 14 days of Pro
npx tsx scripts/grant-beta.ts user@example.com 14

# 7 days of Trade
npx tsx scripts/grant-beta.ts user@example.com 7 trade
```

## 4. List Beta Invites

```bash
# All invites
npx tsx scripts/list-beta.ts

# Active only
npx tsx scripts/list-beta.ts --active-only
```

## 5. Manual Validation

### Test beta user sees Pro features:
1. Grant beta to a test email
2. Log in with that email
3. Go to Settings → verify shows "Pro (beta) until [date]"
4. Go to Pricing → verify shows "Beta Access Active" banner
5. Go to Record → verify VAT toggle is available

### Test beta user does NOT see trial language:
1. Pricing page should NOT show "7-day free trial" text
2. Settings should NOT show "Free Trial" badge
3. Purchase buttons should say "Subscribe on iOS" not "Start Free Trial"

### Test expiry:
1. Grant beta with 1 day: `npx tsx scripts/grant-beta.ts test@example.com 1`
2. Manually update expires_at to past in Supabase
3. Refresh app → user should see Free plan

### Test RevenueCat takes priority:
1. Grant beta to a user who has active RevenueCat subscription
2. Verify they see subscription status (not beta status)
