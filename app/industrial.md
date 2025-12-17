# YapMate Industrial UI System

## Design Philosophy

This is a **field-ready utility interface** for tradespeople, not a consumer SaaS dashboard.

Mental model: **POS Terminal / Logistics Scanner / Power Tool App**

## Core Principles

### 1. DATA FIRST, CHROME LAST
Numbers and facts are 1.5-2x larger than labels. The invoice amount is more important than "Amount:".

### 2. FULL-WIDTH ROWS, NOT CARDS
Content extends edge-to-edge with 1px borders. No rounded boxes floating on grey backgrounds.

### 3. MONOSPACE FOR ALL DATA
Currency, dates, IDs, status codes use `ui-monospace`. This creates visual rhythm and scannability.

### 4. HIGH CONTRAST ONLY
Pure black on white (light mode) or pure white on black (dark mode). No mid-tone grays.

### 5. ASCII STATUS INDICATORS
Status is shown as `[ PAID ]` not colored pills. Text-first, boxy, construction-site aesthetic.

### 6. MECHANICAL INTERACTIONS
Transitions are 100ms linear. No springs, no easing, no "delightful" bounces.

---

## Typography Scale

```jsx
// Labels (small, uppercase, tracked)
<span className="data-label">CUSTOMER NAME</span>

// Values (large, monospace, bold)
<span className="data-value">£1,250.00</span>

// Large values (invoice totals, dates)
<span className="data-value-lg">£4,380.00</span>

// Section headers (uppercase, bordered)
<div className="section-header">// CLIENT DETAILS</div>
```

---

## Layout Patterns

### Full-Width Data Row
```jsx
<div className="data-row">
  <span className="data-label">INVOICE #</span>
  <span className="data-value mono">INV-1024</span>
</div>
```

### Data Grid (Invoice List)
```jsx
<div className="data-grid">
  <div className="data-row">
    <div>
      <span className="data-label">JOHN SMITH CONSTRUCTION</span>
      <span className="data-value mono">£1,250.00</span>
    </div>
    <span className="status-paid">PAID</span>
  </div>
  {/* More rows... */}
</div>
```

### Bar Button (Bottom Fixed)
```jsx
<button className="bar-button">
  CREATE INVOICE
</button>
```

---

## Status Indicators

Always use ASCII bracket style:

```jsx
<span className="status-paid">PAID</span>
// Renders as: [ PAID ]

<span className="status-sent">SENT</span>
// Renders as: [ SENT ]

<span className="status-draft">DRAFT</span>
// Renders as: [ DRAFT ]

<span className="status-overdue">OVERDUE</span>
// Renders as: [ OVERDUE ]
```

Colors:
- **PAID**: Green (#22C55E) - success, completed
- **SENT**: Orange (#F97316) - attention, pending
- **DRAFT**: Gray (#cbd5e1) - inactive
- **OVERDUE**: Red (#EF4444) - critical, requires action

---

## Color Palette

### Backgrounds
- **Dark mode**: Pure black (#000000)
- **Light mode**: Pure white (#FFFFFF)

### Surfaces (rare use)
- **Dark mode**: Slate-900 (#0f172a) - only for modals/overlays
- **Light mode**: Gray-50 (#f9fafb) - only for modals/overlays

### Text
- **Dark mode**: White (#FFFFFF)
- **Light mode**: Black (#000000)

### Borders
- **Dark mode**: Slate-700 (#334155)
- **Light mode**: Slate-300 (#cbd5e1)

### Status Colors
- **Yellow**: #FACC15 (construction yellow)
- **Orange**: #F97316 (alert orange)
- **Green**: #22C55E (success green)
- **Red**: #EF4444 (critical red)

### Accent (active state only)
- **Amber**: #f59e0b

---

## BANNED PATTERNS

❌ **Do NOT use:**
- Rounded corners (no `rounded-xl`, `rounded-lg`)
- Soft shadows (no `shadow-lg`, `shadow-xl`)
- Cards with padding and backgrounds
- Centered layouts with hero sections
- Gradients
- Playful animations (bounces, springs)
- Mid-tone colors (slate-400, slate-500, etc.)
- Marketing copy ("Welcome back!", "Here's your summary")

✅ **DO use:**
- Sharp edges (no border radius or 1px max)
- Hard drop shadows (`shadow-hard`) if needed
- Full-width rows with bottom borders
- Edge-to-edge layouts
- Solid color fills
- 100ms linear transitions
- High contrast extremes (black/white)
- Direct data display (no introductory text)

---

## Examples

### Invoice List Row (BEFORE - BANNED)
```jsx
// ❌ WRONG - Soft card style
<div className="card rounded-xl p-4 shadow-lg mb-3">
  <h3 className="text-lg font-semibold">John Smith</h3>
  <p className="text-gray-400">£1,250.00</p>
  <span className="status-pill bg-green-500/20">Paid</span>
</div>
```

### Invoice List Row (AFTER - CORRECT)
```jsx
// ✅ CORRECT - Full-width data row
<div className="data-row">
  <div className="flex-1">
    <div className="data-label">JOHN SMITH CONSTRUCTION</div>
    <div className="data-value mono">£1,250.00</div>
  </div>
  <span className="status-paid">PAID</span>
</div>
```

### Invoice Detail Section (BEFORE - BANNED)
```jsx
// ❌ WRONG - Card with soft header
<div className="card-elevated mb-4">
  <h2 className="text-xl mb-4">Client Details</h2>
  <div>John Smith</div>
</div>
```

### Invoice Detail Section (AFTER - CORRECT)
```jsx
// ✅ CORRECT - Section header with data rows
<div className="section-header">// CLIENT DETAILS</div>
<div className="data-row">
  <span className="data-label">NAME</span>
  <span className="data-value">JOHN SMITH</span>
</div>
<div className="data-row">
  <span className="data-label">INVOICE #</span>
  <span className="data-value mono">INV-1024</span>
</div>
```

---

## Migration Checklist

When refactoring a page:

1. [ ] Remove all `.card` and `.card-elevated` classes
2. [ ] Replace with `.data-row` for list items
3. [ ] Replace with `.section-header` for section dividers
4. [ ] Change all currency/numbers to `.data-value` or `.data-value-lg` with `.mono`
5. [ ] Change all labels to `.data-label`
6. [ ] Replace status pills with `.status-badge` classes
7. [ ] Remove rounded corners (`rounded-xl` → no rounding)
8. [ ] Remove soft shadows (`shadow-lg` → remove or use `shadow-hard`)
9. [ ] Change button to `.bar-button` if full-width bottom action
10. [ ] Ensure all transitions use `duration-snap ease-industrial`
