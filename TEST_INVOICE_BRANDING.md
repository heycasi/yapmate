# Test Invoice Branding Feature

**Status:** ✅ Migration run - ready to test!

---

## What to Test

### 1. Logo Upload in Settings

**Steps:**
1. Navigate to: **http://localhost:3000/settings**
2. Scroll down to **"Invoice Branding"** section
3. Click **"Tap to upload logo"**
4. Select a PNG/JPG file (< 2MB)
5. Wait for upload to complete
6. ✅ Logo should appear in preview
7. Click **"Save"** button at bottom
8. ✅ Should see "Preferences saved" message

**Verify in Database:**
```sql
SELECT invoice_logo_url, invoice_company_name 
FROM user_preferences 
WHERE user_id = 'your-user-id';
```

Should show `invoice_logo_url` with Supabase Storage URL.

---

### 2. Company Name Input

**Steps:**
1. In Settings → Invoice Branding section
2. Enter company name: "Test Company Ltd" (or any name)
3. Click **"Save"** at bottom
4. ✅ Should save successfully

**Verify in Database:**
```sql
SELECT invoice_company_name 
FROM user_preferences 
WHERE user_id = 'your-user-id';
```

Should show the company name you entered.

---

### 3. PDF Generation with Branding

**Steps:**
1. Open any invoice: **http://localhost:3000/invoice?id={invoiceId}**
2. Click **"Download PDF"** button
3. Open the generated PDF
4. ✅ Should see:
   - Your uploaded logo (if uploaded) OR YapMate logo (if not)
   - Your company name (if provided)
   - Invoice details as normal

**Expected:**
- If logo uploaded → PDF shows your logo at top left
- If company name set → PDF shows company name in header
- If both set → PDF shows logo + company name
- If neither set → PDF shows YapMate logo (fallback)

---

## Common Issues

**"Failed to upload logo"**
- Check browser console (F12) for error
- Verify storage bucket `invoice-logos` exists (see below)
- Check file size (< 2MB)
- Check file type (PNG, JPG, WebP only)

**"Logo uploads but doesn't appear in PDF"**
- Check `invoice_logo_url` is saved in database
- Verify PDF generation is fetching branding (check browser console)
- Try regenerating PDF after uploading

**"Company name doesn't save"**
- Check browser console for errors
- Verify migration ran successfully (check database columns exist)
- Check "Preferences saved" message appears

---

## Still Needed: Storage Bucket

**If logo upload fails**, you need to create the storage bucket:

**In Supabase Dashboard:**
1. Storage → New Bucket
2. Name: `invoice-logos`
3. Public: ✅ Yes (check this!)
4. Create

**Then add RLS policies** (see `STATUS_FEAT_RERECORD_BRANDING.md` for details)

---

## Quick Test Checklist

- [ ] Can navigate to Settings
- [ ] Can see "Invoice Branding" section
- [ ] Can upload logo (or see error if bucket not created)
- [ ] Logo preview appears after upload
- [ ] Can enter company name
- [ ] Can save settings successfully
- [ ] Can download PDF with branding

**Test it now:** http://localhost:3000/settings 🚀
