# How to Test Voice Re-Record - Quick Guide

You're seeing the **home page** (marketing page) which is normal! 

To test voice re-record, you need to get to an **invoice page**. Here's how:

---

## 🎯 Quick Way to Test

### Step 1: Log In
1. Click **"LOG IN"** (top-left of the page)
2. Or go directly to: **http://localhost:3000/login**
3. Log in with your account (or create one)

### Step 2: Get to Dashboard
After login, you'll be on the **Dashboard** page which shows your invoices.

### Step 3: Click Any Invoice
Click on any invoice in the list → This takes you to `/invoice?id={invoiceId}`

### Step 4: Test Mic Buttons! 🎤
Once you're on the invoice edit page, you'll see **mic buttons** next to:
- Customer field (top)
- Job Summary field
- Notes field (bottom)
- Material descriptions (if any materials exist)

---

## 🚀 Alternative: Create New Invoice

**Option A: From Record Page**
1. Go to: **http://localhost:3000/record**
2. Record a new invoice (speak your job details)
3. Click **"REVIEW INVOICE"** button
4. This takes you to the invoice edit page where mic buttons are!

---

## 📍 Direct Links (After Login)

Once logged in, you can go directly to:
- **Dashboard:** http://localhost:3000/dashboard
- **Record:** http://localhost:3000/record
- **Invoice (example):** http://localhost:3000/invoice?id=YOUR_INVOICE_ID

---

## 🎤 What You're Looking For

On the invoice edit page, you'll see:
- **Gray mic icon** buttons next to text fields
- When you click mic → **Red pulsing button** (recording)
- After stop → **Amber spinner** (transcribing)
- Field updates with spoken text!

---

## ❓ Still "Weird"?

If the home page looks weird (colors broken, layout off), it might be:
1. **Tailwind CSS not loading** - Check browser console (F12) for errors
2. **Images not loading** - Logo might be missing

**Quick Fix:**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Check browser console for errors

But honestly, **the home page isn't what you need to test** - you need to log in and get to an invoice! 🎯
