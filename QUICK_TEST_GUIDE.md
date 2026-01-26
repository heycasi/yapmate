# Quick Test Guide - Voice Re-Record Feature

**For vibe coders learning as they go! 🎉**

---

## ✅ Dev Server Status

I've started the dev server for you! It should be running at:
**http://localhost:3000**

---

## 🎤 Test Voice Re-Record (No Database Needed!)

### Step 1: Open the App

1. Open your browser
2. Go to: **http://localhost:3000**
3. Log in (or create account if needed)

### Step 2: Get to an Invoice

You need to open an invoice to test. Two ways:

**Option A: From Dashboard**
1. After login, you should see the Dashboard
2. Click on any invoice in the list
3. This takes you to `/invoice?id={invoiceId}`

**Option B: Direct URL (if you know an invoice ID)**
1. Go to: `http://localhost:3000/invoice?id=YOUR_INVOICE_ID`
2. Replace `YOUR_INVOICE_ID` with a real invoice ID from your database

**Option C: Create New Invoice First**
1. Go to `/record` page
2. Record a new invoice
3. Click "REVIEW INVOICE" button
4. This takes you to the invoice edit page

### Step 3: Test the Mic Buttons! 🎤

Once you're on an invoice page, you'll see **4 mic buttons**:

1. **Customer field** (top of page)
   - Click the mic button (small gray button next to "Customer" label)
   - Speak: "John Smith" (or any name)
   - Click stop button (red square)
   - Wait for transcription (spinner shows)
   - ✅ Field should update with what you said!

2. **Job Summary field**
   - Click mic button
   - Speak: "Fixed leaking pipe in kitchen"
   - Stop → Wait → ✅ Field updates!

3. **Notes field** (bottom of form)
   - Click mic button
   - Speak: "Payment due in 14 days"
   - Stop → Wait → ✅ Field updates!

4. **Material Description** (if invoice has materials)
   - Find a material row
   - Click the small mic button next to description
   - Speak: "Copper pipe and fittings"
   - Stop → Wait → ✅ Description updates!

### Step 4: Test Edge Cases

**Test Global Lock:**
1. Click mic on Customer field (start recording)
2. Try to click mic on Job Summary → Should be disabled/gray
3. Stop Customer recording
4. Now Job Summary mic should work ✅

**Test Cancel:**
1. Click mic → Start recording
2. Click the X (cancel) button
3. ✅ Field should NOT change (stays as it was)

---

## 🐛 If Something Breaks

**Browser Console:**
- Press `F12` (or `Cmd+Option+I` on Mac)
- Look at "Console" tab for errors
- Look for messages starting with `[VoiceInput]` or `[IAP]`

**Common Issues:**

**"Failed to access microphone"**
- Browser needs permission
- Click "Allow" when browser asks for mic access

**"Transcription failed"**
- Check browser console for error
- Might be Supabase edge function issue
- Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` set

**"Not authenticated"**
- Make sure you're logged in
- Try logging out and back in

---

## 📸 What You Should See

**Mic Button States:**
- **Gray mic icon** = Ready to record
- **Red pulsing square** = Recording (with audio level bars)
- **Amber spinner** = Transcribing
- **Gray + disabled** = Another recording active (global lock)

**After Recording:**
- Field text updates with transcribed text
- No page refresh needed
- Can immediately record again if needed

---

## ✅ Success Checklist

- [ ] Can click mic button on Customer field
- [ ] Recording starts (red button, audio bars)
- [ ] Can stop recording
- [ ] Transcription completes (spinner disappears)
- [ ] Customer field updates with spoken text
- [ ] Same works for Job Summary
- [ ] Same works for Notes
- [ ] Same works for Material Description
- [ ] Global lock works (can't record two fields at once)
- [ ] Cancel button works (no change to field)

---

## 🎯 Next Steps After This Works

Once voice re-record is working:
1. Run database migration (for branding features)
2. Create storage bucket (for logo upload)
3. Test branding features

But first, let's make sure voice re-record works! 🚀

---

**Need help?** Check browser console (F12) for error messages!
