# YapMate Build Guide (Vibe Coding Edition)

A beginner-friendly guide to understanding and building YapMate - extracted directly from the codebase.

---

## 1. ONE-LINER + WHAT IT DOES

**One-liner:** Voice-powered invoice app for UK tradespeople.

**What it does:**
- User speaks job details into phone
- OpenAI Whisper transcribes the audio
- GPT-4o extracts structured invoice data (customer, hours, materials, VAT, CIS)
- App generates professional PDF invoice with UK tax calculations
- User sends invoice via Share sheet (email, WhatsApp, etc.)

**Target users:** Plumbers, electricians, joiners, painters - anyone who invoices for labour + materials in the UK.

---

## 2. TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 (App Router) | React framework with static export |
| Styling | Tailwind CSS | Utility-first CSS |
| Mobile Shell | Capacitor 7 | Wraps web app in native iOS container |
| Database | Supabase (PostgreSQL) | Auth, data storage, RLS security |
| Backend | Supabase Edge Functions (Deno) | Server-side AI calls, subscription sync |
| AI | OpenAI API | Whisper (speech-to-text), GPT-4o (extraction) |
| Payments (iOS) | RevenueCat | iOS subscription management |
| Payments (Web) | Stripe | Web payment links (legacy) |
| Email | Resend | Transactional emails |
| PDF | @react-pdf/renderer | Client-side PDF generation |
| Analytics | Vercel Analytics | Usage tracking |

**Key versions from package.json:**
- Next.js: 14.2.5
- React: 18.3.1
- Capacitor: 7.0.0
- RevenueCat: 11.3.2
- Supabase JS: 2.45.4
- OpenAI: 4.67.3

---

## 3. REPO MAP

```
yapmate/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Invoice list, main landing after login
│   ├── record/             # Voice recording flow (core feature)
│   ├── invoice/            # Invoice view/edit/PDF generation
│   ├── pricing/            # Subscription plans + purchase UI
│   ├── settings/           # User preferences, account deletion
│   ├── login/              # Email/password auth
│   ├── signup/             # Account creation
│   ├── finish-setup/       # Post-purchase onboarding (anonymous users)
│   ├── customers/          # Customer list management
│   ├── terms/              # Terms of Use page
│   └── privacy/            # Privacy Policy page
│
├── components/             # Shared React components
│   ├── Navigation.tsx      # Bottom nav bar
│   ├── InvoicePDF.tsx      # PDF template
│   └── IAPProvider.tsx     # RevenueCat context provider
│
├── lib/                    # Core business logic
│   ├── iap.ts              # RevenueCat wrapper (607 lines)
│   ├── iap-sync.ts         # Sync RevenueCat → Supabase
│   ├── tax.ts              # UK VAT/CIS calculations
│   ├── plan-access.ts      # Feature gating by plan
│   ├── supabase.ts         # Database client + types
│   └── use-subscription.ts # React hook for plan status
│
├── supabase/
│   ├── functions/          # Deno Edge Functions
│   │   ├── transcribe/     # OpenAI Whisper API
│   │   ├── extract-invoice/# GPT-4o invoice extraction
│   │   ├── sync-revenuecat/# Subscription sync from iOS
│   │   └── delete-account/ # GDPR account deletion
│   └── migrations/         # SQL schema files
│
├── ios/                    # Capacitor iOS project
│   └── App/
│       ├── App.xcworkspace # Xcode workspace (use this!)
│       └── YapMate.storekit# StoreKit config for testing
│
├── scripts/                # Automation
│   ├── test_iap_sync.js    # Automated IAP sync test
│   └── run-migrations.js   # Database migration runner
│
├── capacitor.config.ts     # Capacitor config (DEV_MODE toggle)
├── package.json            # Dependencies
└── .env.local              # Secrets (not committed)
```

---

## 4. LOCAL SETUP

**Prerequisites:**
- Node.js 18+
- Xcode 15+ (for iOS builds)
- Apple Developer account ($99/year for App Store)
- Supabase project (free tier works)
- RevenueCat account (free tier works)

**Steps:**

```bash
# 1. Clone and install
git clone <repo-url>
cd yapmate
npm install

# 2. Copy environment template
cp .env.example .env.local
# Fill in your keys (see section 5)

# 3. Run database migrations
npm run migrate

# 4. Start development server
npm run dev
# App runs at http://localhost:3000

# 5. For iOS development
npx cap sync ios
npm run ios
# This opens Xcode - build and run on simulator or device
```

**DEV_MODE for iOS:**

In `capacitor.config.ts`, set `DEV_MODE = true` for live reload during development:
```typescript
const DEV_MODE = true  // Uses DEV_URL for live reload
const DEV_URL = 'http://YOUR_LOCAL_IP:3000'
```

Set `DEV_MODE = false` before building for TestFlight/App Store.

---

## 5. ENV VARS + CONFIG

**Required in `.env.local`:**

```bash
# Supabase (from project settings)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# RevenueCat (from dashboard → API Keys)
NEXT_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxxxxx

# Stripe (optional - for web payments)
STRIPE_SECRET_KEY=sk_test_xxxxx

# Resend (for emails)
RESEND_API_KEY=re_xxxxxxxx
```

**Supabase Secrets (for Edge Functions):**

```bash
# Set via CLI - these are NOT in .env.local
supabase secrets set OPENAI_API_KEY=sk-xxxxxxxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Config files:**
- `capacitor.config.ts` - Bundle ID: `com.yapmate.app`, DEV_MODE toggle
- `ios/App/YapMate.storekit` - StoreKit testing configuration

---

## 6. DATA MODEL

**Core tables:**

```
┌─────────────────────────────────────────────────────────────┐
│ auth.users (Supabase managed)                               │
│ - id (UUID, PK)                                             │
│ - email, created_at, etc.                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ 1:N
┌──────────────────────┴──────────────────────────────────────┐
│ customers                                                    │
│ - id (UUID, PK)                                             │
│ - user_id (FK → auth.users)                                 │
│ - name, email, phone, address                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ 1:N
┌──────────────────────┴──────────────────────────────────────┐
│ invoices                                                     │
│ - id (UUID, PK)                                             │
│ - user_id (FK → auth.users)                                 │
│ - customer_id (FK → customers, nullable)                    │
│ - customer_name (denormalized for quick access)             │
│ - job_summary (TEXT)                                        │
│ - labour_hours (NUMERIC)                                    │
│ - labour_rate (NUMERIC, default 45.00)                      │
│ - cis_job (BOOLEAN), cis_rate (NUMERIC, default 20.0)       │
│ - vat_registered (BOOLEAN), vat_rate (NUMERIC, default 20.0)│
│ - status ('draft' | 'sent' | 'paid' | 'cancelled')          │
│ - created_at, updated_at                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ 1:N
┌──────────────────────┴──────────────────────────────────────┐
│ materials                                                    │
│ - id (UUID, PK)                                             │
│ - invoice_id (FK → invoices, CASCADE DELETE)                │
│ - description (TEXT)                                        │
│ - cost (NUMERIC)                                            │
│ - quantity (NUMERIC, default 1)                             │
└─────────────────────────────────────────────────────────────┘
```

**Subscription tables:**

```
┌─────────────────────────────────────────────────────────────┐
│ user_preferences                                            │
│ - user_id (FK → auth.users, UNIQUE)                         │
│ - plan ('free' | 'pro' | 'trade')                           │
│ - default_labour_rate, default_vat_enabled, etc.            │
│ - bank_account_name, bank_sort_code, bank_account_number    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ subscriptions                                               │
│ - user_id (FK → auth.users, UNIQUE)                         │
│ - provider ('revenuecat' | 'stripe')                        │
│ - revenuecat_customer_id (TEXT)                             │
│ - plan ('free' | 'pro' | 'trade')                           │
│ - status ('active' | 'trialing' | 'expired' | 'cancelled')  │
│ - current_period_end (TIMESTAMPTZ)                          │
└─────────────────────────────────────────────────────────────┘
```

**RLS (Row Level Security):**
- All tables have RLS enabled
- Users can only read/write their own data
- Service role bypasses RLS for Edge Functions

---

## 7. INVOICE LOGIC

**File:** `lib/tax.ts`

**UK Tax Rules Implemented:**

1. **VAT Calculation:**
   - VAT is calculated on full subtotal (labour + materials)
   - VAT is added on top (customer pays subtotal + VAT)
   - Default VAT rate: 20%

2. **CIS (Construction Industry Scheme):**
   - CIS is withheld by contractor from labour ONLY
   - CIS does NOT reduce VAT or materials
   - CIS does NOT reduce invoice total
   - Default CIS rate: 20%

**Core calculation function:**

```typescript
function calculateInvoiceTotals(
  labourHours, labourRate, materials[],
  cisJob, cisRate, vatRegistered, vatRate
): {
  labourSubtotal,    // hours × rate
  materialsSubtotal, // Σ(cost × quantity)
  subtotal,          // labour + materials
  vatAmount,         // subtotal × vatRate (if VAT registered)
  invoiceTotal,      // subtotal + VAT (what customer pays)
  cisDeduction,      // labourSubtotal × cisRate (if CIS job)
  netPayment         // invoiceTotal - cisDeduction (what you receive)
}
```

**Example:**
- Labour: 4 hours × £45 = £180
- Materials: £50
- Subtotal: £230
- VAT (20%): £46
- Invoice Total: £276 (customer pays this)
- CIS (20% of labour): £36
- Net Payment: £240 (you receive this)

---

## 8. AI PIPELINE

**Two-stage process:**

```
[Voice Audio] → [Whisper API] → [Raw Transcript] → [GPT-4o] → [Structured Invoice]
```

**Stage 1: Transcription** (`supabase/functions/transcribe/index.ts`)

- Uses OpenAI Whisper API
- Custom prompt for UK dialect support (Scottish, Geordie, etc.)
- Handles slang: "hoor" → hour, "quid" → GBP, "hunner" → 100
- Rate limited: 50 calls/hour per user
- Max file size: 25MB

**Stage 2: Extraction** (`supabase/functions/extract-invoice/index.ts`)

- Uses GPT-4o with JSON mode
- Trade-aware vocabulary hints (plumber vs electrician terms)
- Strict rules: return null if uncertain (never guess)
- Security: blocks prompt injection attempts

**Output schema:**

```typescript
{
  customerName: string | null;
  jobSummary: string;        // REQUIRED
  labourHours: number | null;
  materials: { description: string; cost: number | null }[];
  cisJob: boolean | null;
  vatRegistered: boolean | null;
  notes: string | null;
}
```

**Security features:**
- Auth required (Supabase JWT)
- OpenAI key stored as Supabase secret (not in client)
- Rate limiting per user
- Input validation (max 2000 chars)
- Prompt injection detection

---

## 9. PAYMENT + ENTITLEMENTS

**RevenueCat Setup:**

Products configured in App Store Connect + RevenueCat:
- `com.yapmate.pro.monthly` - £15/month, 7-day trial
- `com.yapmate.trade.monthly` - £25/month, 7-day trial

Entitlements in RevenueCat dashboard:
- `pro` - Granted by Pro Monthly
- `trade` - Granted by Trade Monthly

**Purchase flow (iOS):**

```
1. User taps "Start Free Trial" on /pricing
2. lib/iap.ts → purchaseProduct() → RevenueCat SDK
3. StoreKit payment sheet appears
4. On success: customerInfo returned with active entitlements
5. lib/iap-sync.ts → syncRevenueCatToSupabase()
6. Edge function updates subscriptions + user_preferences tables
7. UI reflects new plan
```

**Anonymous purchase support (Apple requirement):**
- User can purchase WITHOUT logging in
- RevenueCat tracks via anonymous ID
- After account creation, `linkUser()` merges purchases
- `finish-setup` page guides post-purchase onboarding

**Feature gating** (`lib/plan-access.ts`):

```typescript
// Free plan limits
const FREE_PLAN_INVOICE_LIMIT = 3

// Feature checks
canCreateInvoice(plan, invoiceCount) // Free: max 3, Pro/Trade: unlimited
canUseVAT(plan)                      // Pro and Trade only
canUseCIS(plan)                      // Trade only
```

**Subscription sync flow:**

```
RevenueCat (iOS) → sync-revenuecat Edge Function → Supabase DB
                                                   ├── subscriptions table
                                                   └── user_preferences.plan
```

---

## 10. DEPLOYMENT + RELEASE

**Web (Vercel):**

```bash
npm run build    # Creates static export in out/
vercel deploy    # Or git push to trigger Vercel
```

**iOS (App Store):**

```bash
# 1. Build Next.js
npm run lint     # Must pass
npm run build

# 2. Sync to Capacitor
npx cap sync ios

# 3. Open Xcode
open ios/App/App.xcworkspace  # NOT .xcodeproj!

# 4. In Xcode
- Select "Any iOS Device (arm64)"
- Update Build number (must increment)
- Product → Clean Build Folder
- Product → Archive
- Window → Organizer → Distribute App

# 5. App Store Connect
- Wait for processing (10-30 mins)
- Add Export Compliance (answer No to encryption)
- Attach build to version
- Attach IAPs to version
- Submit for review
```

**Edge Functions:**

```bash
# Deploy all functions
supabase functions deploy transcribe
supabase functions deploy extract-invoice
supabase functions deploy sync-revenuecat
supabase functions deploy delete-account

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-xxx
```

**Critical settings:**
- `capacitor.config.ts`: `DEV_MODE = false` for production
- Bundle ID: `com.yapmate.app`
- Build number must increment for each upload

---

## 11. DOCS ALREADY IN REPO

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Main developer guide (this was extracted from) |
| `DESIGN_GUIDELINES.md` | UI/UX patterns, "Rugged Utility" design system |
| `BUILD_AND_TEST_GUIDE.md` | Detailed build process |
| `SANDBOX_TESTING_GUIDE.md` | IAP testing procedures |
| `REVENUECAT_VERIFICATION_CHECKLIST.md` | RevenueCat config verification |
| `APPLE_ISSUE_BREAKDOWN_JAN_12_2026.md` | App Store rejection analysis |
| `ADDING_TRADE_MONTHLY_GUIDE.md` | How to add Trade tier |
| `.env.example` | Environment variable template |

---

## 12. "WHAT I'D TEACH" NOTES

**If I were onboarding a new dev:**

1. **Start with the voice flow** - Run the app, record a voice note, watch the console. The transcribe → extract pipeline is the core feature.

2. **Understand the dual data sources** - RevenueCat is truth for iOS subscriptions, Supabase stores a synced copy. Always check both during debugging.

3. **RLS will bite you** - If a query returns nothing unexpectedly, check if you're using the right client (authenticated vs service role).

4. **Test on real device** - Simulator IAP doesn't work with real App Store. Use sandbox tester accounts.

5. **DEV_MODE toggle is critical** - Forget to set it false = app won't work when shipped to TestFlight.

6. **Edge Functions need secrets** - OpenAI key is NOT in .env.local for security. Set via `supabase secrets set`.

7. **Apple reviews on iPad** - Always test your UI on iPad before submitting. They will catch layout issues.

8. **Correlation IDs for debugging** - IAP sync has correlation ID tracing. Use it to trace requests across client → edge function → database.

9. **The tax calculations are correct** - VAT adds on top, CIS deducts from what you receive. Don't "fix" them unless you understand UK tax law.

10. **Anonymous purchases are required** - Apple rejects apps that force login before purchase. The finish-setup flow handles this.

---

## COPY PACK

Quick reference snippets for common tasks:

### Start development
```bash
npm run dev
```

### Build and deploy to iOS
```bash
npm run lint && npm run build && npx cap sync ios && open ios/App/App.xcworkspace
```

### Deploy edge function
```bash
supabase functions deploy <function-name>
```

### Run database migrations
```bash
npm run migrate
```

### Test IAP sync
```bash
npm run test:iap-sync
```

### Set Supabase secret
```bash
supabase secrets set OPENAI_API_KEY=sk-xxx
```

### RevenueCat product IDs
```typescript
const IAP_PRODUCTS = {
  PRO_MONTHLY: 'com.yapmate.pro.monthly',
  TRADE_MONTHLY: 'com.yapmate.trade.monthly',
}
```

### Calculate invoice totals
```typescript
import { calculateInvoiceTotals } from '@/lib/tax'

const result = calculateInvoiceTotals(
  4,        // labour hours
  45,       // labour rate (£/hr)
  [{ cost: 50, quantity: 1 }],  // materials
  true,     // CIS job
  20,       // CIS rate %
  true,     // VAT registered
  20        // VAT rate %
)
// result.invoiceTotal = £276
// result.netPayment = £240
```

### Check user plan
```typescript
import { getUserPlan, canCreateInvoice } from '@/lib/plan-access'

const plan = await getUserPlan(userId)
const canCreate = await canCreateInvoice(plan, currentInvoiceCount)
```

### Sync RevenueCat to Supabase
```typescript
import { syncRevenueCatToSupabase } from '@/lib/iap-sync'

await syncRevenueCatToSupabase(userId)
```

### Purchase product (iOS)
```typescript
import { purchaseProduct, IAP_PRODUCTS } from '@/lib/iap'

const result = await purchaseProduct(IAP_PRODUCTS.PRO_MONTHLY)
if (result.success) {
  // Handle success
}
```

---

*Generated from codebase analysis on 2026-01-18*
