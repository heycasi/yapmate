# YapMate v1.0.1 UI/UX Improvements - Implementation Plan

**Version:** v1.0.1 (patch release)
**Scope:** Invoice paid/unpaid actions, color consistency, layout alignment, customer list cleanup
**Status:** AWAITING APPROVAL

---

## A) FILES INVOLVED

### 1. **Invoice "Mark as Paid" Feature**

**Primary Files:**
- `/app/invoice/page.tsx` (605 lines)
  - Add "Mark as Paid" button in invoice summary section (near Save button)
  - Update invoice status via Supabase update
  - Show success feedback (toast or inline message)
  - Handle optimistic UI update

**Supporting Files:**
- `/app/dashboard/page.tsx` (195 lines)
  - Already has filter logic for PAID/UNPAID - no changes needed
  - Status badges already exist - will automatically reflect new status

**Database:**
- No schema changes needed - `invoices.status` field already exists with constraint: `'draft' | 'sent' | 'paid' | 'cancelled'`
- Current filtering logic already works: `status === 'paid'` (PAID filter) and `status !== 'paid'` (UNPAID filter)

### 2. **Color Consistency Fixes**

**Files to Update:**
- `/app/page.tsx` (landing page)
  - Replace `yapmate-yellow` (#ffc422) with `yapmate-status-orange` (#F97316)
  - Replace `yapmate-gold` gradient with solid `yapmate-status-orange`
  - Affects: CTA buttons, feature accents, logo glow

- `/app/pricing/page.tsx`
  - Replace `yapmate-yellow` with `yapmate-status-orange`
  - Replace `yapmate-gold` gradient with solid `yapmate-status-orange`
  - Affects: "Recommended" badge, button borders, footer links

- `/components/Navigation.tsx` (line 27)
  - Fix undefined `yapmate-amber-500` → `yapmate-amber`
  - This is a critical bug fix

- `/app/record/page.tsx` (lines 640-656)
  - Replace hardcoded hex colors with Tailwind tokens:
    - `#2A2A2A` → `bg-yapmate-slate-900` or `bg-black/20`
    - `#3A3A3A` → `border-yapmate-slate-700`
    - `#F97316` → `text-yapmate-status-orange` and `bg-yapmate-status-orange`
    - `#F2F2F2` → `text-yapmate-gray-lightest`
    - `#8A8A8A` → `text-yapmate-slate-300`
    - `#0B0B0B` → `text-yapmate-black`
    - `rounded-[4px]` → `rounded` (standard Tailwind)

**Color Token Reference:**
- `/tailwind.config.ts` - No changes needed, tokens already defined
- **Unified accent color: `yapmate-amber` (#f59e0b)** - use across entire product
- **Status colors** (green, orange, red, yellow) - **only for status badges**, NOT UI accents
- **Verified:** `yapmate-amber-500` is UNDEFINED (line 46 shows single value, not object)

### 3. **Customer List - Remove Initials**

**File:**
- `/app/customers/page.tsx` (lines 80-90)
  - Remove the avatar/initials div (48px circle)
  - Adjust spacing: reduce or remove left gap since avatar is gone
  - Keep layout: Name → Invoice count → Chevron

### 4. **Settings Page - Toggle Alignment**

**File:**
- `/app/settings/page.tsx` (lines 397-420)
  - "Default VAT Enabled" row already uses `flex items-center justify-between`
  - Issue: Two-line label structure may cause visual misalignment
  - Fix: Ensure label container aligns toggle with the center of the entire label block (including subtext)
  - Solution: Restructure to align toggle with label baseline, not subtext

### 5. **General Alignment Audit**

**Files to Review:**
- `/app/settings/page.tsx` - All toggle rows (VAT, CIS, Bank Details sections)
- `/app/customers/detail/page.tsx` - Contact info rows
- `/app/dashboard/page.tsx` - Invoice list items
- Any shared components using flex layouts

---

## B) PROPOSED UI CHANGES

### 1. Invoice Detail Page - "Mark as Paid" Action

**Current State:**
- Invoice edit screen shows all fields (customer, labour, materials, VAT, CIS)
- Bottom section has: "SAVE INVOICE" button + "DOWNLOAD PDF" button
- No way to change status from 'draft' or 'sent' to 'paid'

**Proposed Changes:**

**Location:** Bottom of invoice edit screen, between calculations summary and action buttons

**UI Structure:**
```
┌─────────────────────────────────────────┐
│ [Invoice calculations: Labour, VAT, etc.]│
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Invoice Status: [DRAFT]             │ │ ← Status indicator (StatusPill)
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Mark as Paid                    │ │ │ ← Single action button
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌───────────────┐ ┌───────────────────┐│
│ │ SAVE INVOICE  │ │ DOWNLOAD PDF      ││ ← Existing buttons
│ └───────────────┘ └───────────────────┘│
└─────────────────────────────────────────┘

After clicking "Mark as Paid":
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ Invoice Status: [PAID]              │ │ ← Status updated to PAID (green)
│ │                                     │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Mark as Unpaid                  │ │ │ ← Button text changes
│ │ └─────────────────────────────────┘ │ │
│ │                                     │ │
│ │ ✓ Marked as paid  [Undo]           │ │ ← Undo bar (3 seconds)
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Button Behavior:**
- **Show ONE button at a time** based on current status:
  - When status is 'draft' or 'sent': Show **"Mark as Paid"**
  - When status is 'paid': Show **"Mark as Unpaid"**

- **On "Mark as Paid" click:**
  1. Disable button immediately (prevent double tap)
  2. Update status to 'paid' in database
  3. Optimistic UI: Update status badge to PAID (green)
  4. Button text changes to "Mark as Unpaid"
  5. Show inline undo bar: "✓ Marked as paid [Undo]" (auto-dismiss after 3 seconds)
  6. Re-enable button

- **On "Mark as Unpaid" click:**
  1. Disable button immediately
  2. Update status to 'draft' in database (internally uses 'draft' status)
  3. Optimistic UI: Update status badge to DRAFT (gray)
  4. Button text changes to "Mark as Paid"
  5. Show undo bar: "✓ Marked as unpaid [Undo]"
  6. Re-enable button

- **On "Undo" click (within 3 seconds):**
  1. Revert status to previous value
  2. Update database with reverted status
  3. Update badge and button text
  4. Hide undo bar immediately

**Styling:**
- Status section: `bg-black/20 rounded-lg p-4 mb-4`
- Status badge: Existing StatusPill component (green for PAID, gray for DRAFT, orange for SENT)
- Action button: `border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black disabled:opacity-50 disabled:cursor-not-allowed w-full py-3`
- Undo bar: `bg-yapmate-status-green/10 border-l-4 border-yapmate-status-green text-yapmate-status-green px-4 py-2 mt-3 flex justify-between items-center text-sm`
- Undo button: `text-yapmate-amber hover:underline cursor-pointer font-semibold`
- Spacing: Status section 1rem margin below, button full-width

**User Decisions Confirmed:**
- Instant update (no confirmation modal)
- Allow undo (can mark paid → unpaid)
- Single button with dynamic label
- Lightweight inline undo bar (no external libraries)
- Button disabled during request

---

### 2. Color Unification

**Target Color:** `yapmate-amber` (#f59e0b) - **ONE accent color across entire product**

**Before (Landing Page):**
- "Join Waitlist" button: Gold gradient (`#F2C94C` to `#E2B649`)
- "Try Demo" button: Yellow border (`#ffc422`)
- Feature accents: Yellow text (`#ffc422`)

**After (Landing Page):**
- "Join Waitlist" button: Solid amber (`bg-yapmate-amber text-yapmate-black`)
- "Try Demo" button: Amber border (`border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black`)
- Feature accents: Amber text (`text-yapmate-amber`)

**Before (Pricing Page):**
- "Start Free Trial" (Pro): Gold gradient
- "Recommended" badge: Yellow background (`#ffc422`)
- Border buttons: Yellow border (`#ffc422`)

**After (Pricing Page):**
- "Start Free Trial" (Pro): Solid amber (`bg-yapmate-amber text-yapmate-black`)
- "Recommended" badge: Amber background (`bg-yapmate-amber text-yapmate-black`)
- Border buttons: Amber border (`border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black`)

**Before (Authenticated Pages):**
- Already use `yapmate-amber` (#f59e0b) - **keep as-is** ✓
- Bug fix: Navigation tab uses undefined `yapmate-amber-500` → change to `yapmate-amber`

**Visual Impact:**
- Public pages shift from warm yellow/gold → amber (matches logged-in accent)
- Logged-in pages stay amber - **no change needed**
- **One unified accent color** across entire product (#f59e0b)
- Status colors (green, orange, red) **only used for status badges**, not UI accents

**Verified:** `yapmate-amber-500` is UNDEFINED in tailwind.config.ts (line 46 shows amber as single value, not object). Navigation class must be fixed.

---

### 3. Customer List - Remove Initials

**Before:**
```
┌─────────────────────────────────────┐
│ ┌──┐  John Smith              ›   │
│ │JS│  3 invoices                  │
│ └──┘  john@example.com            │
│       +44 7700 900000             │
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│ John Smith                      ›  │
│ 3 invoices                         │
│ john@example.com                   │
│ +44 7700 900000                    │
└─────────────────────────────────────┘
```

**Implementation:**
- Delete avatar div (lines 83-87 in `/app/customers/page.tsx`)
- Reduce gap from `gap-4` to `gap-3` or remove entirely (test visually)
- Ensure name aligns to left edge with consistent padding

---

### 4. Settings Toggle Alignment Fix

**Before (Default VAT Enabled row):**
```
Default VAT Enabled          [Toggle]
New invoices start with VAT ON
```
Problem: Toggle may not align with center of two-line label block

**After:**
```
Default VAT Enabled          [Toggle]
New invoices start with VAT ON
```
Solution: Keep same visual layout but ensure toggle vertically centers against the label text (first line), not the entire block including subtext.

**Technical Fix:**
Current structure:
```tsx
<label className="flex items-center justify-between">
  <span>Default VAT Enabled</span>
  <div className="relative">[Toggle]</div>
</label>
<p className="text-xs text-yapmate-slate-300 mt-2">Helper text</p>
```

This is correct - `items-center` aligns toggle with label text. Issue may be visual perception due to helper text creating asymmetry.

**Option A:** Move helper text inside label (not recommended - breaks semantic HTML)
**Option B:** Adjust toggle vertical positioning with `self-start` or `self-center` if needed
**Option C:** Add explicit alignment via `items-start` + manual top padding on toggle

**Recommendation:** Test current implementation first. If alignment looks off, add `self-center` to toggle div.

---

### 5. General Layout Polish

**Spacing Audit:**
- Ensure all cards/rows use consistent padding: `p-4` (1rem)
- Ensure flex gaps are consistent: `gap-4` for large items, `gap-2` or `gap-3` for compact
- Ensure touch targets are minimum 44x44px (iOS guideline)

**Text Alignment:**
- All flex rows with text + action: `items-center` for vertical centering
- Multi-line labels: Keep helper text outside flex container with `mt-2`

**Visual Hierarchy:**
- Headers: `font-bold uppercase tracking-wide text-xs` (established pattern)
- Values: `text-base font-mono` or `font-semibold`
- Helper text: `text-xs text-yapmate-slate-300`

---

## C) DATA/SCHEMA CHANGES

### Database

**No schema changes needed.**

**Existing Schema:**
```sql
CREATE TABLE invoices (
  ...
  status TEXT CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  ...
)
```

**Current Default:** `'draft'`

**Update Operation:**
```sql
UPDATE invoices
SET status = 'paid', updated_at = NOW()
WHERE id = ? AND user_id = ?
```

**Rollback Operation:**
```sql
UPDATE invoices
SET status = 'draft', updated_at = NOW()
WHERE id = ? AND user_id = ?
```

### Optional: Add `paid_at` Timestamp

**Not implemented in v1.0.1** - requires migration and more complex logic.

**Rationale:** Current `status` field is sufficient for filtering and display. Adding `paid_at` would require:
1. Migration to add column
2. Update logic to set timestamp when marking paid
3. Clear timestamp when marking unpaid
4. No immediate user-facing benefit (timestamp isn't displayed anywhere)

**Defer to v1.1 or later** if analytics/reporting features are added.

---

## D) IMPLEMENTATION STEPS (IN ORDER)

### Step 1: Color Consistency Fixes (Lowest Risk)

**Duration:** 30-45 minutes

1.1. Fix Navigation bug (highest priority):
   - File: `/components/Navigation.tsx` line 27
   - Change: `text-yapmate-amber-500` → `text-yapmate-amber`
   - Test: Check navigation tab highlighting works in logged-in pages

1.2. Fix Record page hardcoded colors:
   - File: `/app/record/page.tsx` lines 640-656
   - Replace all hex values with Tailwind tokens (see Section A)
   - Test: View plan limit banner in free plan

1.3. Unify public page colors to amber:
   - File: `/app/page.tsx`
     - Find all `yapmate-yellow` → replace with `yapmate-amber`
     - Find all `yapmate-gold` and `yapmate-gold-dark` → replace with `yapmate-amber`
     - Remove gradient classes, use solid: `bg-yapmate-amber text-yapmate-black`
     - Remove gradient background images if used
   - File: `/app/pricing/page.tsx`
     - Find all `yapmate-yellow` → replace with `yapmate-amber`
     - Find all `yapmate-gold` and `yapmate-gold-dark` → replace with `yapmate-amber`
     - Update "Recommended" badge: `bg-yapmate-amber text-yapmate-black`
     - Update CTA buttons: `bg-yapmate-amber text-yapmate-black`
     - Update border buttons: `border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black`
     - Update footer links: `text-yapmate-amber hover:underline`
   - Test: Visual review - ALL pages now use single amber accent (#f59e0b)

1.4. Run validation:
   ```bash
   npm run lint
   npm run build
   ```

---

### Step 2: Customer List - Remove Initials (Lowest Risk)

**Duration:** 15-20 minutes

2.1. Edit customer list:
   - File: `/app/customers/page.tsx` lines 80-90
   - Delete avatar div (entire block with `w-12 h-12 rounded-full bg-yapmate-amber-500...`)
   - Adjust spacing: Test with `gap-3` or `gap-4`
   - Ensure name aligns cleanly to left

2.2. Test:
   - Navigate to `/customers` in app
   - Verify: No avatar, name is left-aligned, spacing looks balanced
   - Check: Chevron still on right, invoice count visible

---

### Step 3: Settings Toggle Alignment (Medium Risk)

**Duration:** 20-30 minutes

3.1. Review current implementation:
   - File: `/app/settings/page.tsx` lines 397-420
   - Current structure already uses `flex items-center justify-between`

3.2. Test visually:
   - If alignment looks correct → no changes
   - If toggle appears misaligned → add `self-center` to toggle div

3.3. Apply same check to other toggle rows:
   - "Default CIS Enabled" (if exists)
   - "Bank Details" section toggles
   - Any other settings rows with toggles

3.4. Test:
   - Navigate to `/settings`
   - Verify: All toggles align with their label text (first line)
   - Check: Helper text below doesn't throw off visual balance

---

### Step 4: Invoice "Mark as Paid" Feature (Highest Risk)

**Duration:** 60-90 minutes

4.1. Add state to invoice edit page:
   - File: `/app/invoice/page.tsx`
   - Location: After calculation summary (around line 500-550), before action buttons
   - Add states:
     ```typescript
     const [invoiceStatus, setInvoiceStatus] = useState<string>(invoice.status || 'draft')
     const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
     const [showUndo, setShowUndo] = useState(false)
     const [previousStatus, setPreviousStatus] = useState<string | null>(null)
     ```

4.2. Add single action button (conditional):
   - Show **ONE** button based on `invoiceStatus`:
     - If status is 'draft' or 'sent': Button text = **"Mark as Paid"**
     - If status is 'paid': Button text = **"Mark as Unpaid"**
   - Button styling: `border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black disabled:opacity-50 disabled:cursor-not-allowed w-full py-3`
   - Disabled when `isUpdatingStatus === true`
   - On click: Call `handleStatusToggle()`

4.3. Implement status toggle function:
   ```typescript
   const handleStatusToggle = async () => {
     const newStatus = invoiceStatus === 'paid' ? 'draft' : 'paid'

     // Disable button
     setIsUpdatingStatus(true)

     // Store previous status for undo
     setPreviousStatus(invoiceStatus)

     // Optimistic update
     setInvoiceStatus(newStatus)

     // Update database
     const { error } = await supabase
       .from('invoices')
       .update({ status: newStatus, updated_at: new Date().toISOString() })
       .eq('id', invoiceId)
       .eq('user_id', session.user.id)

     if (error) {
       // Rollback optimistic update
       setInvoiceStatus(previousStatus || invoice.status)
       setPreviousStatus(null)
       console.error('Failed to update invoice status:', error)
       setIsUpdatingStatus(false)
       return
     }

     // Show undo bar
     setShowUndo(true)
     setIsUpdatingStatus(false)

     // Auto-hide undo bar after 3 seconds
     setTimeout(() => {
       setShowUndo(false)
       setPreviousStatus(null)
     }, 3000)
   }
   ```

4.4. Add undo function:
   ```typescript
   const handleUndo = async () => {
     if (!previousStatus) return

     // Hide undo bar immediately
     setShowUndo(false)
     setIsUpdatingStatus(true)

     // Revert to previous status
     setInvoiceStatus(previousStatus)

     // Update database
     const { error } = await supabase
       .from('invoices')
       .update({ status: previousStatus, updated_at: new Date().toISOString() })
       .eq('id', invoiceId)
       .eq('user_id', session.user.id)

     if (error) {
       console.error('Failed to undo status change:', error)
       // Could show error, but keep UI in reverted state
     }

     setPreviousStatus(null)
     setIsUpdatingStatus(false)
   }
   ```

4.5. Add inline undo bar UI:
   - Render conditionally when `showUndo === true`
   - Placement: Below action button, inside status section
   - Markup:
     ```tsx
     {showUndo && (
       <div className="bg-yapmate-status-green/10 border-l-4 border-yapmate-status-green text-yapmate-status-green px-4 py-2 mt-3 flex justify-between items-center text-sm rounded">
         <span>✓ Marked as {invoiceStatus === 'paid' ? 'paid' : 'unpaid'}</span>
         <button
           onClick={handleUndo}
           className="text-yapmate-amber hover:underline cursor-pointer font-semibold"
         >
           Undo
         </button>
       </div>
     )}
     ```
   - No external libraries - pure HTML/CSS

4.5. Test thoroughly:
   - Create test invoice in 'draft' status
   - Click "Mark as Paid" → verify status updates
   - Go to dashboard → verify invoice appears in PAID filter
   - Go back to invoice → verify "Mark as Draft" button appears
   - Click "Mark as Draft" → verify status reverts
   - Go to dashboard → verify invoice appears in UNPAID filter

4.6. Edge case testing:
   - Test with no network (should fail gracefully, rollback optimistic update)
   - Test with multiple rapid clicks (should debounce or disable button during update)
   - Test with invoice belonging to different user (should fail due to RLS policy)

---

### Step 5: Final Validation

**User Decision:** Skip general layout polish for v1.0.1 - focus on core fixes only. Layout polish deferred to v1.0.2.

**Duration:** 15-20 minutes

5.1. Run linter:
   ```bash
   npm run lint
   ```
   - Fix any errors or warnings

5.2. Build production bundle:
   ```bash
   npm run build
   ```
   - Ensure no build errors
   - Check bundle size (should not increase significantly)

5.3. Sync to iOS:
   ```bash
   npx cap sync ios
   ```
   - Verify sync completes without errors

5.4. Visual regression test:
   - Open each page in browser/simulator
   - Compare to previous version (screenshots if available)
   - Verify no layout breaks, color changes are intentional

---

## E) TEST PLAN

### Device Testing

**Platforms:**
- iOS Simulator (iPhone 14 Pro)
- Physical iOS device (iPhone or iPad) - preferred
- Browser (Safari/Chrome) for web testing

**Test Accounts:**
- Free plan user (to test plan limits)
- Pro plan user (to test full features)

---

### Test Cases

#### TC-1: Invoice Status Update (Critical Path)

**Preconditions:**
- Logged in as Pro user
- At least one invoice exists in 'draft' status

**Steps:**
1. Navigate to Dashboard
2. Tap on draft invoice to open edit page
3. Scroll to status section (above Save/Download buttons)
4. Verify: Status badge shows "DRAFT" in gray
5. Verify: "Mark as Paid" button is visible
6. Tap "Mark as Paid" button
7. Wait for update (should be instant or ~1 second)
8. Verify: Status badge changes to "PAID" in green
9. Verify: Button changes to "Mark as Draft"
10. Navigate back to Dashboard
11. Tap "PAID" filter tab
12. Verify: Invoice appears in Paid section
13. Tap "UNPAID" filter tab
14. Verify: Invoice does NOT appear in Unpaid section
15. Tap on invoice again to re-open
16. Tap "Mark as Draft" button
17. Verify: Status changes back to "DRAFT"
18. Navigate to Dashboard → UNPAID filter
19. Verify: Invoice appears in Unpaid section

**Expected Results:**
- Status updates immediately (optimistic UI)
- Dashboard filters update correctly
- No errors in console
- Smooth, fast UX

---

#### TC-2: Color Consistency (Visual Check)

**Steps:**
1. Open landing page (`/`)
2. Verify: "Join Waitlist" button is orange (`#F97316`), not gold
3. Verify: "Try Demo" button has orange border, not yellow
4. Verify: Feature card accents are orange
5. Navigate to `/pricing`
6. Verify: "Recommended" badge is orange
7. Verify: Pro plan "Start Free Trial" button is orange
8. Verify: Footer links are orange
9. Log in to app
10. Navigate to Dashboard
11. Verify: Filter tabs use amber (`#f59e0b`) when active
12. Navigate to Settings
13. Verify: Buttons use amber accent
14. Navigate to Record page
15. Verify: Plan limit banner (if visible) uses Tailwind tokens, not hardcoded colors

**Expected Results:**
- Public pages consistently use orange (`#F97316`)
- Logged-in pages consistently use amber (`#f59e0b`)
- No yellow (`#ffc422`) or gold gradients visible
- No hardcoded hex colors in plan limit banner

---

#### TC-3: Customer List - No Initials (Visual Check)

**Steps:**
1. Navigate to `/customers`
2. Verify: No circular avatar/initials visible
3. Verify: Customer names are left-aligned
4. Verify: Invoice count appears below name
5. Verify: Chevron appears on right
6. Verify: Spacing looks balanced (not too cramped)

**Expected Results:**
- Clean list: Name → Count → Chevron
- No initials/avatars
- Good visual spacing

---

#### TC-4: Settings Toggle Alignment (Visual Check)

**Steps:**
1. Navigate to `/settings`
2. Scroll to "Default VAT Enabled" row
3. Verify: Toggle switch aligns with "Default VAT Enabled" text
4. Verify: Toggle does not appear too high or too low
5. Verify: Helper text ("New invoices start with...") appears below, not interfering with alignment
6. Check all other toggle rows (CIS, Bank Details)
7. Verify: Consistent alignment across all toggles

**Expected Results:**
- Toggles align with their label text (first line)
- Helper text positioned below without causing visual imbalance
- Touch target feels natural (thumb can easily tap toggle)

---

#### TC-5: Edge Cases - Invoice Status

**Preconditions:**
- Logged in as Pro user

**Steps:**
1. Create new invoice via `/record` (status will be 'draft')
2. Open invoice in edit page
3. Click "Mark as Paid" rapidly 3 times
4. Verify: Only one status update occurs (debouncing or button disabled during update)
5. Turn on Airplane Mode (disable network)
6. Click "Mark as Draft"
7. Verify: Error message appears or status rollback occurs
8. Turn off Airplane Mode
9. Retry status change
10. Verify: Update succeeds

**Expected Results:**
- No double updates from rapid clicks
- Graceful error handling when offline
- Optimistic UI rolls back on error

---

#### TC-6: Regression Testing (Ensure No Breaks)

**Critical Paths to Re-Test:**
1. Create invoice via voice recording (`/record`)
2. Save invoice (`/invoice` edit page)
3. Download invoice as PDF
4. Add/edit customer (`/customers`)
5. Edit settings (VAT toggle, CIS toggle, bank details)
6. Filter dashboard by ALL/PAID/UNPAID
7. Navigate between pages (bottom nav tabs)

**Expected Results:**
- All existing features work as before
- No layout breaks
- No console errors

---

### Test Checklist

- [ ] TC-1: Invoice status update works (mark as paid/draft)
- [ ] TC-2: Colors are consistent (orange public, amber logged-in)
- [ ] TC-3: Customer initials removed, layout clean
- [ ] TC-4: Settings toggles align properly
- [ ] TC-5: Edge cases handled (rapid clicks, offline)
- [ ] TC-6: No regressions in existing features
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] iOS sync succeeds: `npx cap sync ios`
- [ ] Simulator test: All pages render correctly
- [ ] Device test: All interactions feel smooth

---

## F) RISKS & MITIGATION

### Risk 1: Invoice Status Update Breaks Filtering

**Risk Level:** MEDIUM

**Description:**
If status update fails silently or RLS policy blocks update, invoices could get stuck in wrong filter sections.

**Mitigation:**
1. Test RLS policy: Ensure `user_id = auth.uid()` check allows updates
2. Add error handling: Rollback optimistic update if database update fails
3. Add logging: Console log errors for debugging
4. Test edge cases: Offline, rapid clicks, network errors
5. Keep status update logic simple: No cascading updates or triggers

**Rollback Plan:**
If status updates break filtering:
- Remove status update buttons from invoice page
- Keep existing filter logic (works correctly in v1.0)
- Defer feature to v1.0.2 after further testing

---

### Risk 2: Color Changes Break Branding or User Expectations

**Risk Level:** LOW

**Description:**
Users familiar with yellow/gold landing page may find orange jarring or off-brand.

**Mitigation:**
1. User requested this change (color consistency is explicit requirement)
2. Orange is already used in app (status indicators, "SENT" badges)
3. Orange aligns with "construction/industrial" design system
4. Change is reversible (single source of truth in Tailwind config)

**Rollback Plan:**
If user dislikes orange:
- Revert landing page to yellow/gold (single file change)
- Keep logged-in pages as amber (already working)
- Alternative: Pick different unified accent (e.g., amber for all pages)

---

### Risk 3: Removing Customer Initials Reduces Scannability

**Risk Level:** LOW

**Description:**
Initials provide visual anchor for scanning long customer lists. Removing them might make list harder to navigate.

**Mitigation:**
1. User explicitly requested removal ("Remove the customer initials... Not needed.")
2. Customer names are still prominent (large text, left-aligned)
3. Invoice count provides secondary information
4. Chevron indicates tappable row
5. Test with real customer list (10+ customers) to verify scannability

**Rollback Plan:**
If scannability suffers:
- Restore avatar but use different visual (icon, colored dot, or smaller size)
- Alternative: Add subtle left border color per customer (like calendar color coding)

---

### Risk 4: Settings Toggle Alignment Changes Break Mobile UX

**Risk Level:** LOW

**Description:**
Adjusting toggle positioning could make it harder to tap on small screens.

**Mitigation:**
1. Current implementation already uses `items-center` (correct approach)
2. Only make changes if visual misalignment is confirmed
3. Test on physical device before committing changes
4. Keep touch target minimum 44x44px (iOS guideline)

**Rollback Plan:**
If alignment changes break UX:
- Revert to current implementation (already works functionally)
- Accept minor visual asymmetry in favor of better touch target

---

### Risk 5: Layout Polish Introduces New Bugs

**Risk Level:** MEDIUM

**Description:**
Adjusting padding/spacing across multiple components could introduce layout bugs or break responsive design.

**Mitigation:**
1. Make minimal changes (only fix obvious issues)
2. Use existing spacing tokens (`gap-3`, `gap-4`, `p-4`) - don't introduce new values
3. Test each page after changes (visual regression)
4. Focus on high-impact areas (Settings, Customers, Invoice) rather than bulk changes
5. Keep "layout polish" as optional Step 5 - skip if time-constrained

**Rollback Plan:**
If layout bugs appear:
- Revert spacing changes per file (git revert or manual undo)
- Prioritize functional correctness over visual perfection
- Document specific issues for future fix

---

### Risk 6: Build or Sync Failures Block Deployment

**Risk Level:** LOW

**Description:**
Syntax errors, missing dependencies, or Capacitor sync issues could prevent iOS build.

**Mitigation:**
1. Run `npm run lint` after each change
2. Run `npm run build` before final commit
3. Run `npx cap sync ios` to verify iOS compatibility
4. Test in simulator before deploying to device
5. Use TypeScript strict mode (already enabled) to catch type errors early

**Rollback Plan:**
If build fails:
- Fix syntax/type errors (usually quick - linter points to exact issue)
- If sync fails, check Capacitor config and iOS project settings
- Worst case: Revert entire commit, re-implement changes incrementally

---

## SUMMARY

**Total Estimated Time:** 2.5-3 hours (including testing)

**Scope for v1.0.1 (Confirmed):**
1. Fix Navigation color bug (`yapmate-amber-500` → `yapmate-amber`) - CRITICAL
2. Add "Mark as Paid" button to invoice page - CORE FEATURE REQUEST
3. Unify public page colors (yellow/gold → orange) - USER FEEDBACK
4. Remove customer initials - USER FEEDBACK
5. Fix hardcoded colors in Record page plan banner - CONSISTENCY
6. Verify Settings toggle alignment (may not need changes) - USER FEEDBACK

**Deferred to v1.0.2:**
- General layout polish (spacing audit across all pages)

**Implementation Order:**
1. Color fixes (lowest risk, highest visibility) - 45 min
2. Customer list cleanup (low risk, quick win) - 20 min
3. Settings alignment check (low risk, may not need changes) - 20 min
4. Invoice status feature (highest risk, core functionality) - 90 min
5. Final validation (lint, build, sync, test) - 20 min

**Deployment:**
- Target: v1.0.1 patch release
- No database migrations needed
- No breaking changes
- Backward compatible with v1.0

---

## APPROVAL CHECKLIST

**User Decisions (Confirmed):**
- ✅ "Mark as Paid" uses instant update (no confirmation modal)
- ✅ Allow undo: Show "Mark as Draft" button when invoice is paid
- ✅ Skip general layout polish for v1.0.1 (deferred to v1.0.2)

**Implementation Scope:**
- ✅ "Mark as Paid" button placement: Near Save/Download buttons in invoice edit page
- ✅ Orange color (`#F97316`) for public pages (landing, pricing)
- ✅ Amber color (`#f59e0b`) stays as-is for logged-in pages
- ✅ Remove customer initials completely (not just hide)
- ✅ Verify Settings toggle alignment (may not need changes)
- ✅ Implementation order: Colors → Customers → Settings → Invoice Status → Validation
- ✅ Timeline: 2.5-3 hours

**Ready for Implementation:**
All design decisions confirmed. No database migrations needed. No breaking changes. Plan is complete and executable.

---

**PLAN COMPLETE - READY FOR YOUR APPROVAL TO PROCEED**

---

## CONCISE EXECUTION CHECKLIST

### Phase 1: Color Consistency (45 min)

**File: `/components/Navigation.tsx`**
- [ ] Line 27: Change `text-yapmate-amber-500` → `text-yapmate-amber`
- [ ] Test: Check active tab color works in logged-in pages

**File: `/app/record/page.tsx`**
- [ ] Lines 640-656: Replace hardcoded hex colors with Tailwind tokens:
  - `#2A2A2A` → `bg-black/20`
  - `#3A3A3A` → `border-yapmate-slate-700`
  - `#F97316` → `bg-yapmate-status-orange` and `text-yapmate-status-orange`
  - `#F2F2F2` → `text-yapmate-gray-lightest`
  - `#8A8A8A` → `text-yapmate-slate-300`
  - `#0B0B0B` → `text-yapmate-black`
  - `rounded-[4px]` → `rounded`

**File: `/app/page.tsx` (Landing Page)**
- [ ] Replace ALL `yapmate-yellow` → `yapmate-amber`
- [ ] Replace ALL `yapmate-gold` / `yapmate-gold-dark` / `yapmate-gold-darker` → `yapmate-amber`
- [ ] Remove gradient classes: `from-yapmate-gold to-yapmate-gold-dark` → `bg-yapmate-amber`
- [ ] Buttons: `bg-yapmate-amber text-yapmate-black` and `border-2 border-yapmate-amber text-yapmate-amber`

**File: `/app/pricing/page.tsx`**
- [ ] Replace ALL `yapmate-yellow` → `yapmate-amber`
- [ ] Replace ALL `yapmate-gold` gradients → `yapmate-amber`
- [ ] "Recommended" badge: `bg-yapmate-amber text-yapmate-black`
- [ ] Pro button: `bg-yapmate-amber text-yapmate-black`
- [ ] Border buttons: `border-2 border-yapmate-amber text-yapmate-amber`
- [ ] Footer links: `text-yapmate-amber`

---

### Phase 2: Customer List - Remove Initials (20 min)

**File: `/app/customers/page.tsx`**
- [ ] Lines 83-87: Delete entire avatar div:
  ```tsx
  <div className="w-12 h-12 rounded-full bg-yapmate-amber-500...">
    <span>{getInitials(customer.name)}</span>
  </div>
  ```
- [ ] Adjust gap spacing if needed (test `gap-3` vs `gap-4`)
- [ ] Test: Customers list renders cleanly without initials

---

### Phase 3: Settings Toggle Alignment (20 min)

**File: `/app/settings/page.tsx`**
- [ ] Lines 397-420: Review "Default VAT Enabled" toggle alignment
- [ ] Current implementation uses `flex items-center justify-between`
- [ ] Test visually on device/simulator
- [ ] If misaligned: Add `self-center` to toggle div
- [ ] If aligned correctly: No changes needed

---

### Phase 4: Invoice "Mark as Paid/Unpaid" (90 min)

**File: `/app/invoice/page.tsx`**

**4A. Add state (top of component):**
```typescript
const [invoiceStatus, setInvoiceStatus] = useState<string>(invoice.status || 'draft')
const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
const [showUndo, setShowUndo] = useState(false)
const [previousStatus, setPreviousStatus] = useState<string | null>(null)
```

**4B. Add functions:**
- [ ] Implement `handleStatusToggle()` function (see Step 4.3 above)
- [ ] Implement `handleUndo()` function (see Step 4.4 above)

**4C. Add UI (after calculations summary, before Save/Download buttons):**
```tsx
{/* Status Section */}
<div className="bg-black/20 rounded-lg p-4 mb-4">
  {/* Status Badge */}
  <div className="mb-3">
    <span className="text-xs text-yapmate-slate-300 uppercase tracking-wide mr-2">
      Invoice Status:
    </span>
    <StatusPill status={invoiceStatus} />
  </div>

  {/* Action Button */}
  <button
    onClick={handleStatusToggle}
    disabled={isUpdatingStatus}
    className="border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black disabled:opacity-50 disabled:cursor-not-allowed w-full py-3 rounded font-semibold uppercase tracking-wide text-sm transition-colors duration-snap"
  >
    {invoiceStatus === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
  </button>

  {/* Undo Bar */}
  {showUndo && (
    <div className="bg-yapmate-status-green/10 border-l-4 border-yapmate-status-green text-yapmate-status-green px-4 py-2 mt-3 flex justify-between items-center text-sm rounded">
      <span>✓ Marked as {invoiceStatus === 'paid' ? 'paid' : 'unpaid'}</span>
      <button
        onClick={handleUndo}
        className="text-yapmate-amber hover:underline cursor-pointer font-semibold"
      >
        Undo
      </button>
    </div>
  )}
</div>
```

**4D. Test:**
- [ ] Mark draft invoice as paid → status updates, badge turns green, button changes to "Mark as Unpaid"
- [ ] Check undo bar appears for 3 seconds
- [ ] Click Undo → status reverts to draft
- [ ] Go to dashboard → verify PAID filter shows/hides invoice correctly
- [ ] Test rapid clicking → button should be disabled during update
- [ ] Test offline → error handling works

---

### Phase 5: Validation (20 min)

**Build & Lint:**
- [ ] Run `npm run lint` → fix any errors
- [ ] Run `npm run build` → ensure success
- [ ] Run `npx cap sync ios` → verify iOS sync

**Visual Regression:**
- [ ] Landing page: Amber buttons, no yellow/gold
- [ ] Pricing page: Amber accents throughout
- [ ] Dashboard: Amber active tabs (already correct)
- [ ] Settings: Amber buttons/focus states (already correct)
- [ ] Customers: No initials, clean list
- [ ] Invoice edit: Status section renders correctly

**Functional Testing:**
- [ ] Create invoice → mark as paid → check dashboard PAID filter
- [ ] Mark as unpaid → check dashboard UNPAID filter
- [ ] Test undo within 3 seconds
- [ ] Test all existing features still work (create, edit, download PDF)

---

### File Summary

**Files to Modify:**
1. `/components/Navigation.tsx` - Fix amber-500 bug
2. `/app/record/page.tsx` - Fix hardcoded colors
3. `/app/page.tsx` - Unify to amber accent
4. `/app/pricing/page.tsx` - Unify to amber accent
5. `/app/customers/page.tsx` - Remove initials
6. `/app/settings/page.tsx` - Verify toggle alignment (may not need changes)
7. `/app/invoice/page.tsx` - Add mark as paid/unpaid feature

**Files to Read (No Changes):**
- `/tailwind.config.ts` - Verify token definitions
- `/app/dashboard/page.tsx` - Check filter logic (already works)
- `/components/ui/StatusPill.tsx` - Use existing component

---

**Total Estimated Time:** 2.5-3 hours
**Scope:** v1.0.1 patch release
**Breaking Changes:** None
**Database Changes:** None (uses existing `status` field)

**AWAITING USER APPROVAL TO BEGIN IMPLEMENTATION**
