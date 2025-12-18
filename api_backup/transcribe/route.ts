import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export const runtime = 'nodejs'

// Whisper prompt to guide UK accent and tradesperson terminology
const WHISPER_PROMPT = `You are transcribing voice notes from UK tradespeople. Speech may include Glaswegian, Edinburgh, Geordie, Scouse, Mancunian and general Scottish/English dialects. Preserve names accurately. Pay special attention to common Scottish surnames such as: Dahl, McDonald, McDowell, Campbell, Robertson, O'Neill, Brown, Smith, Fraser. If the audio sounds like any of these names, prefer the exact spelled version rather than sounding alike alternatives such as Dow or Doll.

Examples:
- 'Conor Dahl' → Conor Dahl
- 'Job for Mrs Dahl' → Mrs Dahl

Dialect glossary:
- aye → yes
- naw / nae → no
- mibby → maybe
- an hoor / an hour → one hour
- a couple of hoors → two hours
- hunner → one hundred
- quid → GBP

Focus on accurately capturing:
- customer names
- addresses
- hours / labour time
- material descriptions and costs
- CIS / VAT statements

Return only the exact transcript text with no interpretation.`

// System prompt for cleaning up dialect transcripts
const CLEANING_SYSTEM_PROMPT = `You convert UK tradesperson speech with Scottish and Northern English dialects into clean written English.

CRITICAL RULES - YOU MUST NOT CHANGE:
- Person names (e.g., "Mrs Smith", "John Dahl", "Campbell")
- Company names (e.g., "Oak Tree Builders", "Acme Plumbing")
- Street/road names and house numbers (e.g., "24 Oak Street", "15 High Road")
- Postcodes (e.g., "G12 8QQ", "NE1 4ST")
- Money amounts (e.g., "£180", "45 quid", "a hundred and twenty pounds")
- Hour counts (e.g., "3 hours", "an hour and a half")

YOU MAY NORMALISE:
- Slang: "aye" → "yes", "naw/nae" → "no", "mibby" → "maybe", "an hoor" → "an hour", "hunner" → "hundred", "quid" → "pounds"
- Filler words: "like", "ken", "ye know", "innit", "um", "uh", "er"
- Casual grammar: "I done" → "I did", "we was" → "we were"

YOU MUST REMOVE:
- Garbage tokens that are NOT valid English words AND NOT numbers, currency, postcodes, names, or addresses
- Examples of garbage to remove: random consonant clusters, transcription artifacts, nonsense syllables
- ONLY remove if you are certain it is garbage - when in doubt, keep it

CRITICAL: CIS AND VAT PHRASE NORMALISATION

CIS phrases - normalise to clear statements:
- "aye it's CIS", "it's a CIS job", "CIS is on", "aye CIS", "CIS applies" → "This is a CIS job."
- "naw/no CIS", "no CIS on it", "not a CIS job" → "This is not a CIS job."

VAT phrases - normalise to clear statements:
- "I'm VAT registered", "plus VAT", "VAT to be added", "VAT is charged" → "VAT is charged."
- "naw/no VAT", "nae VAT", "no VAT on it", "others nae VAT", "no VAT to add", "VAT not applicable" → "No VAT is charged."

If both CIS and VAT are mentioned in one messy sentence, split them into two clear sentences.

EXAMPLES:

Input:
"Job for Conor Dahl at 24 Ashgill Road. Fitted a new radiator and replaced a leaking valve. Three hours labour. Materials were £180. Aye it's CIS and naw others nae VAT."

Output:
"Job for Conor Dahl at 24 Ashgill Road. Fitted a new radiator and replaced a leaking valve. Three hours labour. Materials were £180. This is a CIS job. No VAT is charged."

Input:
"Job for Mrs Smith. Boiler service. Two hoors. A hunner and twenty quid. Naw, no VAT on it."

Output:
"Job for Mrs Smith. Boiler service. Two hours. £120. No VAT is charged."

Input:
"Job for John Campbell. Fixed the pipe. An hoor and a half. Aye it's CIS, I'm VAT registered too."

Output:
"Job for John Campbell. Fixed the pipe. One and a half hours. This is a CIS job. VAT is charged."

PRESERVE ALL FACTUAL CONTENT. Output only the cleaned transcript with no preamble.`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('audio')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    console.log('Incoming audio:', {
      size: file.size,
      type: file.type,
      name: file.name,
    })

    // Step 1: Get raw transcription from Whisper with dialect-aware prompt
    const transcriptResponse = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'en',
      temperature: 0,
      prompt: WHISPER_PROMPT,
    })

    const rawTranscript = transcriptResponse.text
    console.log('Raw Whisper transcript:', rawTranscript)

    // Step 2: Clean up the transcript using GPT-4o to normalise dialect
    const cleaningResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: CLEANING_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: rawTranscript,
        },
      ],
      temperature: 0,
    })

    const cleanedTranscript = cleaningResponse.choices[0]?.message?.content?.trim() || rawTranscript

    console.log('Cleaned transcript:', cleanedTranscript)

    return NextResponse.json({
      rawTranscript,
      transcript: cleanedTranscript,
    })
  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
