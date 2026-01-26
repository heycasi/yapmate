# Plan: Improve Glaswegian Accent Transcription Accuracy

**Date:** 2026-01-14  
**Goal:** Enhance Whisper transcription prompt to better handle strong Glaswegian accents  
**Status:** PLANNING - No code changes yet

---

## Current State

**File:** `supabase/functions/transcribe/index.ts`

**Current WHISPER_PROMPT:**
- Mentions Glaswegian in list of dialects
- Has basic dialect glossary (aye, naw/nae, mibby, hoor, hunner, quid)
- Scottish surname examples (Dahl, McDonald, etc.)
- Temperature: 0 (deterministic)

**What Works:**
- Basic dialect awareness is there
- Some Scottish names handled
- UK money/time slang covered

**What Could Be Better:**
- Minimal Glaswegian-specific examples
- Small dialect glossary (only 7 phrases)
- No phonetic guidance
- No Glasgow-specific place names/areas
- No trade-specific Glaswegian phrases

---

## Improvement Ideas (No Implementation Yet)

### Option 1: Expand Whisper Prompt (Easiest - Quick Win)

**What:** Add more Glaswegian-specific examples and phrases to WHISPER_PROMPT

**Pros:**
- Easy to implement (just edit prompt text)
- No API changes
- No cost increase
- Immediate improvement

**Cons:**
- Whisper prompt has token limits (but we're nowhere near limit)
- Need real Glaswegian examples to add

**What to Add:**
- More Glaswegian pronunciation examples
- Glasgow area names (Govan, Partick, East End, etc.)
- Common Glaswegian phrases tradespeople use
- Trade-specific Glaswegian terminology
- Phonetic hints for common mishearings

---

### Option 2: Increase Prompt Context (Trade-Specific)

**What:** Add more trade context to help Whisper understand vocabulary

**Pros:**
- Helps with both accent AND trade terminology
- Easy to implement

**Cons:**
- Might not directly help with accent (already mentions tradespeople)

**What to Add:**
- More examples of common trade phrases in Glaswegian
- "Job for..." patterns with Glaswegian pronunciation

---

### Option 3: Post-Processing Correction (More Complex)

**What:** After transcription, run transcript through correction model to fix accent-specific mishearings

**Pros:**
- Can catch patterns Whisper misses
- Two-pass accuracy boost

**Cons:**
- More complex (two API calls per transcription)
- More cost (double API calls)
- More latency (slower)
- Need to build correction logic

**Not Recommended:** Too complex for current needs, slower, more expensive

---

### Option 4: User Feedback Loop (Long-term)

**What:** Collect misheard words/phrases, build correction dictionary

**Pros:**
- Learns from real data
- Improves over time
- Custom to your users

**Cons:**
- Takes time to build up data
- Need infrastructure to collect/store corrections
- More complex implementation

**Future Consideration:** Good for later, not now

---

## Recommended Approach: Option 1 (Expand Prompt)

**Why:**
- Easiest to implement
- No code changes beyond prompt text
- Immediate improvement
- No added cost/latency

**What to Add to WHISPER_PROMPT:**

### 1. More Glaswegian Dialect Examples

**Current (7 phrases):**
- aye, naw/nae, mibby, hoor, hunner, quid

**Suggested Additions:**
- **Time:** "haur" (hour), "twa" (two), "three" (may sound like "free"), "fower" (four)
- **Common phrases:** "dae" (do), "cannae" (can't), "widnae" (wouldn't), "isnae" (isn't)
- **Filler words:** "ken" (know), "like", "see", "but"
- **Common words:** "aye" (yes), "naw" (no), "aye right" (sarcastic yes), "wee" (small)

### 2. Glasgow-Specific Place Names

**Add examples:**
- Govan, Partick, East End, West End, Southside, Bearsden, Milngavie
- Glasgow postcodes: G1-G84 patterns
- Street names: "Sauchiehall", "Buchanan", "Argyle"

**Why:** Whisper might mishear Glasgow area names with strong accent

### 3. Phonetic Hints for Common Mishearings

**Add guidance:**
- "Dahl" might sound like "Dow" or "Doll" → prefer "Dahl" (known Scottish surname)
- "three hours" might sound like "free hours" → it's "three"
- "forty" might sound like "farty" → it's "forty"
- "twenty" might sound different → it's "twenty"

### 4. Trade-Specific Glaswegian Phrases

**Add examples:**
- "Job for..." (common opening)
- "CIS job" / "it's CIS" (with accent)
- "Plus VAT" / "nae VAT" (with accent)
- Material descriptions with accent ("copper pipe", "radiator", etc.)

### 5. Common Glaswegian Pronunciation Patterns

**Add hints:**
- "r" sounds might be rolled or dropped
- Vowel sounds (especially "o" and "u")
- Hard consonants (especially "t" and "d")
- Word endings might be clipped or extended

---

## Specific Prompt Additions (Draft)

**To Add After Line 18 (after current dialect glossary):**

```
Glaswegian-specific pronunciations and common phrases:
- Time: "haur" / "hoor" → hour, "twa" → two, "three" might sound like "free" → it's "three"
- Common words: "dae" → do, "cannae" → can't, "widnae" → wouldn't, "isnae" → isn't, "ken" → know
- Place names: Govan, Partick, East End, Southside, Bearsden, Milngavie
- Postcodes: Glasgow G1-G84 patterns (e.g., "G12 8QQ")
- Street names: Sauchiehall, Buchanan, Argyle, Byres Road
- Trade phrases: "job for", "it's a CIS job", "aye it's CIS", "plus VAT", "nae VAT"
- Money: "fifty quid" might sound different → it's "fifty", "forty" (not "farty"), "twenty" (not "twenny")

Common Glaswegian mishearings to avoid:
- Names: If it sounds like "Dow" or "Doll" but context suggests surname → prefer "Dahl" (common Scottish surname)
- Numbers: "three" might sound like "free" → it's "three", "forty" might sound like "farty" → it's "forty"
- Vowel sounds may vary, consonants may be harder/clipped
```

---

## Questions to Consider

### 1. What specific words/phrases are getting misheard?

**Need from user:**
- What words/phrases with your accent are getting transcribed wrong?
- Examples of what you say vs what Whisper returns?
- Common patterns (numbers? names? places?)

**Why:** Helps target improvements to actual problems

---

### 2. Are there trade-specific Glaswegian terms?

**Examples to consider:**
- Trade slang in Glaswegian
- Material names with accent
- Common job description phrases

---

### 3. Should we adjust temperature?

**Current:** `temperature: 0` (very deterministic)

**Considerations:**
- `0` = most deterministic (usually best)
- Higher (0.1-0.3) = slightly more creative, might catch accents better
- Lower = more predictable but might miss accents

**Recommendation:** Keep at 0 for now, only change if needed

---

## Testing Plan (After Implementation)

1. **Record test phrases** with strong Glaswegian accent:
   - Common invoice phrases ("job for Mrs Smith", "three hours", etc.)
   - Glasgow place names
   - Numbers with accent
   - Trade terminology

2. **Compare before/after:**
   - Same test recordings
   - Measure accuracy improvement
   - Check if specific mishearings fixed

3. **Iterate:**
   - If still issues, add more examples
   - Collect real mishearings from use
   - Refine prompt based on data

---

## Next Steps

1. **Gather examples from user:**
   - What specific words/phrases are getting misheard?
   - Examples of what you say vs what it returns

2. **Draft expanded prompt** with Glaswegian-specific additions

3. **Test with real recordings** before/after

4. **Deploy if improved** ✅

---

## Files to Modify (When Ready)

**Primary:**
- `supabase/functions/transcribe/index.ts` - WHISPER_PROMPT constant (lines 4-26)

**No other changes needed** - prompt-only improvement

---

## Cost/Latency Impact

**None!** Just changing prompt text, no additional API calls or complexity.

---

**Status:** Ready to implement Option 1 once we have specific mishearing examples from you! 🎯
