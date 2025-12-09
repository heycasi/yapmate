# YapMate - Environment Variables Documentation

## 🔒 Security Notice

**CRITICAL**: These environment variables contain sensitive credentials. Never commit them to Git.

- ✅ `.env.local` is in `.gitignore`
- ✅ Variables are set in Vercel dashboard separately
- ✅ YapMate and HeyCasi use completely separate configurations

---

## 📋 Complete Environment Variables List

### 🔴 CRITICAL - Required for Core Functionality

#### `NEXT_PUBLIC_SUPABASE_URL`
- **Purpose**: Supabase project API endpoint
- **Runtime**: Client & Server
- **Public**: Yes (NEXT_PUBLIC_ prefix)
- **Example**: `https://nidijdprgoauwkmuioer.supabase.co`
- **Where to find**: Supabase Dashboard → Settings → API
- **Used by**: All database operations, authentication
- **Impact if missing**: ❌ App will not work at all

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Purpose**: Public anon key for client-side Supabase access
- **Runtime**: Client & Server
- **Public**: Yes (NEXT_PUBLIC_ prefix)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → anon public
- **Used by**: Client-side database queries (with RLS)
- **Impact if missing**: ❌ Authentication and database access will fail

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Purpose**: Service role key for server-side admin operations
- **Runtime**: Server only
- **Public**: NO - Server-side only
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → service_role secret
- **Used by**: Server API routes, bypassing RLS, admin operations
- **Impact if missing**: ❌ Waitlist, invoice creation, admin features will fail
- **Security**: ⚠️  NEVER expose to client - API routes only

---

### 🟡 FEATURE SPECIFIC - Required for Specific Functionality

#### `OPENAI_API_KEY`
- **Purpose**: OpenAI API access for Whisper transcription
- **Runtime**: Server only
- **Public**: NO
- **Example**: `sk-proj-...`
- **Where to find**: https://platform.openai.com/api-keys
- **Used by**: `/api/transcribe` - Voice to text conversion
- **Features affected**:
  - Voice recording transcription
  - Invoice detail extraction from speech
- **Impact if missing**: ⚠️  Voice features won't work, but app still runs
- **Cost**: Pay-per-use (Whisper API pricing)

#### `STRIPE_SECRET_KEY`
- **Purpose**: Stripe payment processing
- **Runtime**: Server only
- **Public**: NO
- **Example**: `sk_test_...` (test) or `sk_live_...` (production)
- **Where to find**: https://dashboard.stripe.com/apikeys
- **Used by**: `/api/payment-link`, payment processing
- **Features affected**:
  - Payment link generation
  - Stripe checkout
  - Invoice payments
- **Impact if missing**: ⚠️  Payment features won't work
- **Important**: Use `sk_test_` for development, `sk_live_` for production

#### `RESEND_API_KEY`
- **Purpose**: Email sending via Resend
- **Runtime**: Server only
- **Public**: NO
- **Example**: `re_...`
- **Where to find**: https://resend.com/api-keys
- **Used by**: `/api/send-invoice` - Email delivery
- **Features affected**:
  - Sending invoices via email
  - Transactional emails
- **Impact if missing**: ⚠️  Email sending won't work
- **Alternative**: Could use SendGrid, Postmark, or other providers

---

## 🔧 Optional - Development & Database

#### `DATABASE_URL`
- **Purpose**: Direct PostgreSQL connection for migrations
- **Runtime**: Server only (CLI scripts)
- **Public**: NO
- **Example**: `postgresql://postgres:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`
- **Where to find**: Supabase Dashboard → Settings → Database → Connection string
- **Used by**: Migration scripts (`npm run migrate`)
- **Impact if missing**: Migrations must be run manually in Supabase SQL Editor
- **Not needed for**: Production runtime - only for deployment/migrations

#### `SUPABASE_DB_PASSWORD`
- **Purpose**: Alternative to DATABASE_URL for migrations
- **Runtime**: Server only (CLI scripts)
- **Public**: NO
- **Example**: `your_password_here`
- **Where to find**: Supabase Dashboard → Settings → Database
- **Used by**: Migration scripts (builds DATABASE_URL)
- **Impact if missing**: Same as DATABASE_URL

---

## 📍 Where to Set Variables

### Local Development (`.env.local`)

Create `/Users/conzo/dev/yapmate/.env.local`:

```env
# OpenAI
OPENAI_API_KEY=sk-proj-your-key-here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_DB_PASSWORD=your-db-password

# Stripe (use test keys for dev)
STRIPE_SECRET_KEY=sk_test_your-key-here

# Resend
RESEND_API_KEY=re_your-key-here
```

### Production (Vercel)

Set in: **Vercel Dashboard → Project → Settings → Environment Variables**

For each variable:
1. Click "Add New"
2. Enter name (exact match, case-sensitive)
3. Enter value
4. Select environments:
   - ✅ Production (required)
   - ✅ Preview (recommended - for PR previews)
   - ⚠️  Development (optional - uses `.env.local` usually)
5. Click "Save"

**After adding variables**: Redeploy for changes to take effect.

---

## 🔐 Security Best Practices

### Client-Side vs Server-Side

| Variable | Client | Server | Exposure |
|----------|--------|--------|----------|
| `NEXT_PUBLIC_*` | ✅ Yes | ✅ Yes | Public in browser |
| Regular vars | ❌ No | ✅ Yes | Server-only |

### Rules:

1. **NEXT_PUBLIC_ prefix**:
   - Accessible in browser JavaScript
   - Visible in page source
   - Use ONLY for non-sensitive public data
   - Examples: Supabase URL, Supabase anon key

2. **No prefix (regular)**:
   - Server-side only
   - Never sent to browser
   - Use for secrets and API keys
   - Examples: Service role keys, API secrets

3. **Never commit to Git**:
   - `.env.local` is in `.gitignore`
   - Always use Vercel dashboard for production
   - Use separate keys for dev/staging/production

---

## 🔄 Updating Environment Variables

### After changing variables:

#### Local Development:
1. Update `.env.local`
2. Restart dev server: `npm run dev`

#### Production:
1. Update in Vercel Dashboard
2. Trigger redeploy:
   ```bash
   vercel --prod
   ```
   OR push to GitHub (if auto-deploy enabled)

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] All CRITICAL variables are set in Vercel
- [ ] FEATURE variables for enabled features are set
- [ ] Used `sk_live_` Stripe keys for production (not `sk_test_`)
- [ ] Supabase URL matches your project
- [ ] Service role key is NOT exposed to client
- [ ] `.env.local` is NOT committed to Git
- [ ] YapMate variables are separate from HeyCasi

---

## 🚨 What If Variables Are Missing?

### Missing `NEXT_PUBLIC_SUPABASE_URL`:
```
Error: NEXT_PUBLIC_SUPABASE_URL is not defined
```
**Fix**: Add in Vercel → Redeploy

### Missing `SUPABASE_SERVICE_ROLE_KEY`:
```
Error: Cannot connect to Supabase (401)
```
**Fix**: Add in Vercel → Redeploy

### Missing `OPENAI_API_KEY`:
```
Error: OpenAI API key not configured
```
**Fix**: Voice features disabled. Add key if needed.

### Missing `STRIPE_SECRET_KEY`:
```
Error: No API key provided
```
**Fix**: Payment features disabled. Add key if needed.

---

## 📊 Feature Matrix

| Feature | Required Variables |
|---------|-------------------|
| Waitlist | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| Authentication | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY |
| Voice Recording | OPENAI_API_KEY |
| Invoice Generation | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| Payment Processing | STRIPE_SECRET_KEY |
| Email Sending | RESEND_API_KEY |
| Database Migrations | DATABASE_URL or SUPABASE_DB_PASSWORD |

---

## 🔗 Quick Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **OpenAI API Keys**: https://platform.openai.com/api-keys
- **Stripe Dashboard**: https://dashboard.stripe.com/apikeys
- **Resend API Keys**: https://resend.com/api-keys
- **Vercel Dashboard**: https://vercel.com

---

## ⚠️ HeyCasi Separation

YapMate and HeyCasi are COMPLETELY SEPARATE:

- ❌ Do NOT share environment variables
- ❌ Do NOT use the same Vercel project
- ❌ Do NOT use the same Supabase project (if different)
- ✅ Each has its own `.env.local`
- ✅ Each has its own Vercel configuration
- ✅ Each has its own database and auth

**This prevents**:
- Cross-contamination of data
- Accidental overwrites
- Security issues
- Deployment conflicts
