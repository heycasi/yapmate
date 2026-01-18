# Invoice Review Screen — Voice Input Audit Report

**Date:** 2026-01-14  
**Purpose:** Pre-flight audit for Feature 1 (per-field re-record functionality)  
**Status:** READ-ONLY INVESTIGATION — NO CODE CHANGES

---

## Executive Summary

**Per-field re-record functionality ALREADY EXISTS and is fully implemented.**

The invoice review/edit screen (`app/invoice/page.tsx`) already has:
- ✅ Voice input buttons (`VoiceInputButton`) on Customer, Job Summary, Notes, and Material Description fields
- ✅ Reusable voice recording logic (`lib/use-voice-input.ts` hook)
- ✅ Global recording state management to prevent concurrent recordings
- ✅ Transcription via Supabase edge function (`supabase/functions/transcribe`)
- ✅ Automatic field updates when transcription completes

**What's Missing:** Nothing. The feature is complete.

**Safe Extension Points:** Any new fields that need voice input can use the existing `VoiceInputButton` component.

---

## What Already Exists

### 1. Invoice Review/Edit Screen (`app/invoice/page.tsx`)

**Location:** `app/invoice/page.tsx` (764 lines)

**Key Features:**
- Full invoice editing UI with all fields editable via text inputs
- Voice input buttons attached to 4 fields: Customer Name, Job Summary, Notes, Material Description
- Invoice state managed in React state (`invoice` object, `materials` array)
- Save button writes to Supabase `invoices` and `materials` tables
- PDF generation, status toggling, bank details checking

**Voice Input Integration:**
```typescript
// State for preventing concurrent recordings
const [isVoiceRecordingActive, setIsVoiceRecordingActive] = useState(false)

// Handlers that update invoice state
const handleVoiceInput = useCallback((field: string, value: string) => {
  setInvoice((prev) => prev ? { ...prev, [field]: value } : prev)
}, [])

const handleMaterialVoiceInput = useCallback((index: number, value: string) => {
  setMaterials((prev) => {
    const updated = [...prev]
    updated[index] = { ...updated[index], description: value }
    return updated
  })
}, [])
```

**Fields with Voice Input Buttons:**
1. **Customer Name** (line 452-456)
2. **Job Summary** (line 473-477)
3. **Material Description** (line 546-551) — per material row
4. **Notes** (line 629-633)

### 2. Voice Input Button Component (`components/VoiceInputButton.tsx`)

**Location:** `components/VoiceInputButton.tsx` (216 lines)

**Purpose:** Reusable microphone button for per-field recording.

**Features:**
- Microphone icon (inactive), stop icon (recording), spinner (transcribing)
- Audio level indicator bars during recording
- Cancel button during active recording/transcription
- Global recording lock to prevent concurrent recordings
- Error tooltip display
- Two sizes: `sm` and `md`

**Props:**
- `onTranscribed: (text: string) => void` — callback with transcribed text
- `globalRecordingActive?: boolean` — prevents activation if another recording is active
- `onRecordingStateChange?: (isActive: boolean) => void` — notifies parent of state
- `disabled?: boolean` — manual disable
- `size?: 'sm' | 'md'` — button size

**Behavior:**
- Click → start recording
- Click again → stop and transcribe
- Cancel → abort without transcription
- Disabled if `globalRecordingActive && !isActive` (prevents concurrent recordings)

### 3. Voice Input Hook (`lib/use-voice-input.ts`)

**Location:** `lib/use-voice-input.ts` (291 lines)

**Purpose:** Low-level recording and transcription logic for single-field inputs.

**Features:**
- MediaRecorder API integration (audio/webm, audio/ogg, audio/mp4)
- Audio level monitoring via AnalyserNode
- 30-second max recording duration (`MAX_FIELD_RECORDING_SECONDS = 30`)
- Transcription via Supabase edge function (`/functions/v1/transcribe`)
- Cancellation support (abort mid-transcription)
- Error handling with user-friendly messages
- Automatic cleanup of audio resources

**API:**
```typescript
const [state, actions] = useVoiceInput({
  onTranscribed: (text: string) => void,
  onError?: (error: string) => void
})

// state: { isRecording, isTranscribing, error, audioLevel, recordingTime }
// actions: { startRecording, stopRecording, cancelRecording }
```

**Transcription Flow:**
1. User clicks mic → `startRecording()` → MediaRecorder starts
2. User clicks stop → `stopRecording()` → MediaRecorder stops
3. `handleTranscription()` → POST to `/functions/v1/transcribe` with FormData
4. Edge function calls OpenAI Whisper API
5. `onTranscribed(text)` callback → parent updates field

### 4. Transcription Edge Function (`supabase/functions/transcribe/index.ts`)

**Location:** `supabase/functions/transcribe/index.ts` (226 lines)

**Purpose:** Server-side audio transcription via OpenAI Whisper API.

**Features:**
- Authentication check (Supabase session required)
- Rate limiting (50/hour per plan, currently same for all plans)
- File size validation (max 25MB)
- OpenAI Whisper API integration (model: `whisper-1`)
- UK dialect prompt (handles "aye", "naw", "hunner", "quid", etc.)
- Usage logging to `api_usage` table
- Returns plain text transcription

**API:**
- POST `/functions/v1/transcribe`
- Headers: `Authorization: Bearer {supabase_access_token}`
- Body: `FormData` with `file` field (audio blob)
- Response: `{ text: string }`

### 5. Full Recording Flow (Separate — `app/record/page.tsx`)

**Location:** `app/record/page.tsx` (721 lines)

**Purpose:** Complete invoice creation from scratch via voice recording.

**Flow:**
1. User selects trade (Plumber, Electrician, etc.)
2. Records up to 3 minutes of audio
3. Transcription → `supabase/functions/transcribe`
4. Extraction → `supabase/functions/extract-invoice` (GPT-4 extracts structured data)
5. Creates invoice in database → redirects to `/invoice?id={invoiceId}`

**Key Difference from Review Screen:**
- Record page does FULL extraction (customer name, hours, materials, CIS/VAT flags)
- Review screen does SIMPLE transcription (raw text → field update)

---

## Current Flow: How Invoice Drafts Work

### State Management

**Invoice Edit Screen (`app/invoice/page.tsx`):**
- React state: `invoice` object (from Supabase), `materials` array (from Supabase)
- Loads on mount: `fetchInvoice(id)` queries Supabase with invoice ID from URL query param
- Edits are local state updates until "Save" is clicked

### How Edits Are Applied

**Text Input Edits:**
- Direct `setInvoice({ ...invoice, field: value })` or `setMaterials(updated)`
- No database write until "Save & Return" button clicked

**Voice Input Edits:**
1. User clicks mic button on field
2. `VoiceInputButton` → `useVoiceInput` hook starts recording
3. User stops recording → transcription via edge function
4. `onTranscribed(text)` → parent handler updates state
   - `handleVoiceInput('customer_name', text)` → `setInvoice({ ...invoice, customer_name: text })`
   - `handleMaterialVoiceInput(index, text)` → updates materials array
5. UI updates immediately (optimistic)
6. Database write happens on "Save & Return" click

### Where Transcription Results Are Written Back

**Transcription Result Flow:**
```
VoiceInputButton 
  → useVoiceInput hook 
    → handleTranscription() 
      → POST /functions/v1/transcribe 
        → OpenAI Whisper API 
          → { text: "transcribed text" } 
            → onTranscribed(text) callback 
              → handleVoiceInput/handleMaterialVoiceInput 
                → setInvoice() / setMaterials() 
                  → UI updates
```

**Database Write:**
- Transcription results are NOT written to database immediately
- They update React state only
- Database write happens on `handleSave()` click (line 115-185)
- `handleSave()` does `supabase.from('invoices').update()` and `supabase.from('materials').delete().insert()`

---

## What's Missing for Feature 1

**Nothing.** Per-field re-record functionality is already fully implemented.

**If "Feature 1" means something else:**
- Clarify what specific functionality is desired beyond what exists
- Current implementation covers all invoice text fields (except numeric inputs like hours/rate/cost)

**Potential Enhancements (Not Blocking):**
- Voice input for numeric fields (labour hours, rates, material costs) — would require extraction logic, not just transcription
- Voice input for VAT/CIS toggles — would require boolean extraction logic

---

## Safe Extension Points

### Where to Add New Voice Input Fields

**Pattern:** Any text input field can have a `VoiceInputButton` added next to it.

**Example (from existing code):**
```tsx
<div className="flex items-center justify-between mb-2">
  <label>Field Name</label>
  <VoiceInputButton
    onTranscribed={(text) => handleVoiceInput('field_name', text)}
    globalRecordingActive={isVoiceRecordingActive}
    onRecordingStateChange={setIsVoiceRecordingActive}
  />
</div>
<input
  value={invoice.field_name || ''}
  onChange={(e) => setInvoice({ ...invoice, field_name: e.target.value })}
  // ...
/>
```

**Safe Addition Points:**
- New text fields in `app/invoice/page.tsx` can follow the same pattern
- Reuses existing `VoiceInputButton` component (no changes needed)
- Reuses existing `useVoiceInput` hook (no changes needed)
- Reuses existing transcription edge function (no changes needed)

### What NOT to Touch

**DO NOT MODIFY:**
1. `lib/use-voice-input.ts` — core recording/transcription logic (working as intended)
2. `components/VoiceInputButton.tsx` — UI component (working as intended)
3. `supabase/functions/transcribe/index.ts` — edge function (working as intended)
4. `app/invoice/page.tsx` state management — `handleVoiceInput`, `handleMaterialVoiceInput`, `isVoiceRecordingActive` (working as intended)

**Only Safe Changes:**
- Adding new `VoiceInputButton` instances to existing or new fields
- Adding new fields to invoice state (if schema allows)

---

## File Inventory

### Core Files (Invoice Review)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `app/invoice/page.tsx` | Invoice review/edit screen with voice input integration | 764 | ✅ Complete |
| `components/VoiceInputButton.tsx` | Reusable mic button component for per-field recording | 216 | ✅ Complete |
| `lib/use-voice-input.ts` | Recording/transcription hook for single fields | 291 | ✅ Complete |

### Backend Services

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `supabase/functions/transcribe/index.ts` | Audio transcription via OpenAI Whisper | 226 | ✅ Complete |
| `supabase/functions/extract-invoice/index.ts` | Full invoice extraction (used by record page, not review screen) | 281 | ✅ Complete |

### Related Files (Context Only)

| File | Purpose | Notes |
|------|---------|-------|
| `app/record/page.tsx` | Full invoice creation from scratch | Separate flow, not part of review screen |
| `lib/invoice.ts` | TypeScript types for Invoice | Type definitions |

---

## Risks and Conflicts

### If Adding Mic-Per-Field Recording

**No Risks Identified:**
- Per-field recording already exists and is working
- Global recording lock (`isVoiceRecordingActive`) prevents concurrent recordings
- Clean separation: `VoiceInputButton` → `useVoiceInput` → edge function

**Potential Edge Cases (Already Handled):**
- ✅ Concurrent recording prevention (`globalRecordingActive` prop)
- ✅ Cancellation during transcription (cancelledRef in hook)
- ✅ Error handling (error state, user-friendly messages)
- ✅ Resource cleanup (audio context, streams, intervals)

### If Modifying Existing Voice Input

**High Risk:**
- Breaking existing per-field recording on Customer, Job Summary, Notes, Material fields
- Introducing race conditions if global recording lock is removed
- Breaking transcription edge function if API contract changes

**Recommendation:**
- Do NOT modify existing voice input implementation
- Only add new fields using the same pattern

---

## Answers to Audit Questions

### Q1: Is there already any per-field re-record functionality?

**YES.** Fully implemented and working:
- Customer Name field
- Job Summary field  
- Notes field
- Material Description fields (per material row)

### Q2: Is there any existing mic / audio UI on the review screen?

**YES.** `VoiceInputButton` component is already integrated on 4 fields:
- Shows microphone icon (inactive)
- Shows stop icon (recording)
- Shows spinner (transcribing)
- Shows audio level bars (recording)
- Shows cancel button (active state)

### Q3: Is there reusable logic that Feature 1 should hook into rather than reimplement?

**YES.**
- **Component:** `VoiceInputButton` — use for any new text field
- **Hook:** `lib/use-voice-input.ts` — already handles recording, transcription, cleanup
- **Backend:** `supabase/functions/transcribe` — already handles audio → text conversion

**No reimplementation needed.** Feature 1 is already complete.

---

## Conclusion

**Status:** ✅ Feature already exists and is fully functional.

**Recommendation:**
- If "Feature 1" is per-field re-record: **No work needed.**
- If "Feature 1" is something else: **Clarify requirements.**
- If adding new fields: **Use existing `VoiceInputButton` pattern.**

**Next Steps:**
- Confirm what "Feature 1" actually is
- If it's different from what exists, document the gap
- Otherwise, mark Feature 1 as complete and move to next task

---

**End of Audit Report**
