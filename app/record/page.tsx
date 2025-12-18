'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Invoice } from '@/lib/invoice'
import Navigation from '@/components/Navigation'
import { openaiClient } from '@/lib/openai_client'

// PROMPTS MOVED FROM API ROUTES
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

PRESERVE ALL FACTUAL CONTENT. Output only the cleaned transcript with no preamble.`

const EXTRACTION_SYSTEM_PROMPT = `You extract clean, structured invoice data from voice transcripts from UK tradespeople.

The user's trade will be provided to help you understand vocabulary and context. Use it ONLY for interpretation guidance - do NOT invent job details based on trade stereotypes.

TRADE VOCABULARY HINTS:
- Plumber: radiator, valve, boiler, pipe, trap, leak, washer, ballcock, cistern, copper, flux, solder
- Electrician: socket, switch, fuse, consumer unit, spur, rewire, cable, patress, backbox, breaker, rcd
- Joiner: skirting, architrave, stud, ply, mdf, hinge, lock, door, frame, joist, batten
- Painter & Decorator: emulsion, gloss, undercoat, primer, filler, caulk, masking, roller, cutting in
- Other: Use general trade context

You must output JSON that matches this EXACT TypeScript type:

Invoice {
  customerName: string | null;
  jobSummary: string; // REQUIRED: Never null
  labourHours: number | null;
  materials: { description: string; cost: number | null }[];
  cisJob: boolean | null; // true/false if mentioned, null if unknown
  vatRegistered: boolean | null; // true/false if mentioned, null if unknown
  notes: string | null;
}

CORE RULE (NON-NEGOTIABLE):
If you are unsure about a value, return null. NEVER guess.

FIELD RULES

1) customerName
- Extract EXACTLY as spoken in the transcript. Do NOT correct spelling.
- Look for phrases like: "job for Mrs Smith", "for John Campbell", "invoice for Acme Ltd"
- Strip leading filler ("job for", "work for", "invoice for").
- CRITICAL: Preserve names exactly - if transcript says "Dahl", use "Dahl" (not "Dow" or "Doll")
- If no customer name mentioned → null
- If confidence is low (e.g., unclear audio, multiple names) → null

2) jobSummary
- One short sentence (max 35 words) that sums up the work done.
- Use trade-friendly wording.
- Do NOT include prices, hours, addresses or payment terms here.
- Examples:
  - "Replaced leaking radiator valve and fitted new radiator in living room."
  - "Serviced boiler and replaced faulty pump."

3) labourHours
- Extract ONLY if explicitly stated with a clear number.
- Supported UK phrasing:
  - "an hour" / "an hoor" → 1
  - "hour and a half" / "hoor and a half" → 1.5
  - "couple of hours" / "couple of hoors" → 2
  - "half an hour" / "half an hoor" → 0.5
  - "two and a half hours" → 2.5
  - "three hours" → 3
- VAGUE phrases return null:
  - "wee while" → null
  - "most of the afternoon" → null
  - "quick job" → null
  - "bit of time" → null
- If no time mentioned → null

4) materials
- Each clearly separate part or material becomes one item.
- description:
  - Short, specific phrase:
    - "600mm double radiator"
    - "boiler valve kit"
    - "copper pipe and fittings"
  - Keep the description as stated (preserve terminology).
- cost:
  - ONLY extract if explicitly stated. NO guessing.
  - Supported UK money slang:
    - "quid" → pounds (e.g., "180 quid" → 180)
    - "hunner" → 100 (e.g., "a hunner and eighty quid" → 180)
    - "one fifty" → 150
    - "a hundred and twenty" → 120
  - Return numeric value only (no £ symbol).
  - If material mentioned with no price → cost: null
  - If no materials mentioned → []

5) cisJob (CRITICAL: Never guess)
- Return true ONLY if transcript contains explicit CIS confirmation:
  - "This is a CIS job"
  - "aye it's CIS"
  - "CIS applies"
  - "CIS job"
  - "CIS is on"
- Return false ONLY if transcript explicitly says NO to CIS:
  - "This is not a CIS job"
  - "no CIS"
  - "naw CIS"
  - "not a CIS job"
- Return null if CIS is NOT mentioned at all

6) vatRegistered (CRITICAL: Never guess)
- Return true ONLY if transcript contains explicit VAT confirmation:
  - "VAT is charged"
  - "I'm VAT registered"
  - "plus VAT"
  - "VAT to be added"
- Return false ONLY if transcript explicitly says NO to VAT:
  - "No VAT is charged"
  - "no VAT"
  - "naw VAT"
  - "nae VAT"
  - "not VAT registered"
- Return null if VAT is NOT mentioned at all

7) notes
- Short free-text field for any extra useful info that does not fit above:
  - payment terms: "payment due in 14 days"
  - address: "24 Oak Street, Glasgow"
  - extra context: "tenant will pay materials separately"
- Do NOT repeat the full job summary.
- If there is nothing useful to add → null.

Always respond with ONLY the JSON object and nothing else.`

export default function RecordPage() {
  const [selectedTrade, setSelectedTrade] = useState<string>('Plumber') // Default to Plumber
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [rawTranscript, setRawTranscript] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const router = useRouter()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    checkAuth()
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const startRecording = async () => {
    try {
      setError(null)
      setTranscript(null)
      setRawTranscript(null)
      setInvoice(null)
      setInvoiceId(null)
      setRecordingTime(0)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      // Try different MIME types based on browser support
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      console.log('Using MIME type:', mimeType)

      // Set up audio level monitoring
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyserRef.current = analyser
      const microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)
      analyser.fftSize = 256
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(Math.round(average))
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      updateAudioLevel()

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('Chunk size:', event.data.size)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())

        // Log the chunks for debugging
        console.log('Audio chunks:', audioChunksRef.current.length,
          'Total size:', audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0))

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log('Final blob size:', audioBlob.size, 'type:', audioBlob.type)
        await handleTranscription(audioBlob)
      }

      // Request data every 100ms to ensure we capture everything
      mediaRecorder.start(100)
      setIsRecording(true)

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= 60) {
            stopRecording()
            return 60
          }
          return newTime
        })
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to access microphone. Please grant permission and try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setAudioLevel(0)

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    setError(null)

    try {
      const file = new File([audioBlob], 'recording.webm', { type: audioBlob.type })

      // Step 1: Client-side Whisper
      const transcriptResponse = await openaiClient.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'en',
        temperature: 0,
        prompt: WHISPER_PROMPT,
      })

      const rawTranscriptText = transcriptResponse.text
      setRawTranscript(rawTranscriptText)

      // Step 2: Client-side Cleanup
      const cleaningResponse = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: CLEANING_SYSTEM_PROMPT },
            { role: 'user', content: rawTranscriptText },
        ],
        temperature: 0,
      })

      const cleanedTranscript = cleaningResponse.choices[0]?.message?.content?.trim() || rawTranscriptText
      setTranscript(cleanedTranscript)

      // Use the cleaned transcript for extraction
      await handleExtraction(cleanedTranscript)
    } catch (err: any) {
      console.error('Transcription error:', err)
      setError(err.message || 'Failed to transcribe audio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleExtraction = async (transcriptText: string) => {
    setIsExtracting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const tradeContext = selectedTrade ? `\n\nUser's trade: ${selectedTrade}` : ''

      // Client-side Extraction
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: `Extract invoice data from this transcript:${tradeContext}\n\nTranscript:\n${transcriptText}` },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      })

      const responseContent = completion.choices[0]?.message?.content
      if (!responseContent) throw new Error('No AI response')

      const extractedInvoice: Invoice = JSON.parse(responseContent)

      // Insert into Supabase
      const { data: invoiceData, error: invoiceError } = await (supabase
        .from('invoices') as any)
        .insert({
            user_id: user.id,
            customer_name: extractedInvoice.customerName,
            job_summary: extractedInvoice.jobSummary,
            labour_hours: extractedInvoice.labourHours,
            labour_rate: 45.0, // Default
            cis_job: extractedInvoice.cisJob,
            cis_rate: 20.0,
            vat_registered: extractedInvoice.vatRegistered,
            vat_rate: 20.0,
            status: 'draft',
            notes: extractedInvoice.notes,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError
      if (!invoiceData) throw new Error('Failed to create invoice record')

      // Insert Materials
      if (extractedInvoice.materials.length > 0) {
        const materialsToInsert = extractedInvoice.materials
            .filter((m) => m.cost !== null)
            .map((material) => ({
                invoice_id: invoiceData.id,
                description: material.description,
                cost: material.cost!,
                quantity: 1,
            }))
        
        if (materialsToInsert.length > 0) {
            await (supabase.from('materials') as any).insert(materialsToInsert)
        }
      }

      setInvoice(extractedInvoice)
      setInvoiceId(invoiceData.id)
    } catch (err: any) {
      console.error('Extraction error:', err)
      setError(err.message || 'Failed to extract invoice data')
    } finally {
      setIsExtracting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return { mins, secs }
  }

  const getSystemStatus = () => {
    if (isRecording) return '/ / RECORDING IN PROGRESS'
    if (isTranscribing) return '/ / PROCESSING AUDIO'
    if (isExtracting) return '/ / EXTRACTING DATA'
    return '/ / SYSTEM READY'
  }

  const { mins, secs } = formatTime(recordingTime)
  const colonBlink = isRecording && secs % 2 === 0

  return (
    <>
      {/* TALLY LIGHT BAR - Full Width, No Padding */}
      <div
        className={`w-full h-12 flex items-center justify-center border-b transition-colors duration-snap ${
          isRecording
            ? 'bg-yapmate-status-red border-yapmate-status-red'
            : 'bg-yapmate-black border-yapmate-slate-700 dark:border-yapmate-slate-700'
        }`}
        style={!isRecording ? {
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(51, 65, 85, 0.3) 10px, rgba(51, 65, 85, 0.3) 20px)'
        } : undefined}
      >
        <span className="section-header border-0 py-0">
          {getSystemStatus()}
        </span>
      </div>

      {/* MAIN INTERFACE - Full Bleed */}
      <main className="min-h-screen flex flex-col">
        {/* TRADE SELECTOR - Full Width Data Row */}
        <div className="data-row">
          <span className="data-label">TRADE</span>
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            disabled={isRecording || isTranscribing || isExtracting}
            className="bg-transparent border-none text-white font-mono text-sm uppercase focus:outline-none disabled:opacity-50"
          >
            <option value="Plumber">PLUMBER</option>
            <option value="Electrician">ELECTRICIAN</option>
            <option value="Joiner">JOINER</option>
            <option value="Painter & Decorator">PAINTER</option>
            <option value="Other">OTHER</option>
          </select>
        </div>

        {/* CENTER CONTROL AREA */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* TIMER - Hero Element */}
          <div className="flex items-center justify-center mb-12">
            <span className="text-8xl font-mono font-bold tabular-nums">
              {mins.toString().padStart(2, '0')}
            </span>
            <span className={`text-8xl font-mono font-bold mx-2 transition-opacity duration-0 ${
              colonBlink ? 'opacity-0' : 'opacity-100'
            }`}>
              :
            </span>
            <span className="text-8xl font-mono font-bold tabular-nums">
              {secs.toString().padStart(2, '0')}
            </span>
          </div>

          {/* DECIBEL METER - Raw Data Display */}
          {isRecording && (
            <div className="w-full max-w-md mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="data-label">INPUT LEVEL</span>
                <span className="font-mono text-sm">{audioLevel} dB</span>
              </div>
              <div className="w-full h-3 border border-yapmate-slate-700 dark:border-yapmate-slate-700">
                <div
                  className="h-full bg-yapmate-status-green transition-none"
                  style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* RECORD BUTTON - Massive Square Target */}
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isTranscribing || isExtracting}
              className="w-32 h-32 bg-yapmate-status-red disabled:bg-yapmate-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-transform duration-0 active:scale-98 border-2 border-yapmate-black dark:border-yapmate-black"
              style={{ transform: 'scale(1)' }}
            >
              <div className="w-12 h-12 bg-yapmate-white" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-32 h-32 bg-yapmate-slate-900 flex items-center justify-center transition-transform duration-0 active:scale-98 border-2 border-yapmate-slate-700"
              style={{ transform: 'scale(1)' }}
            >
              <div className="w-12 h-12 bg-yapmate-white" />
            </button>
          )}
        </div>

        {/* ERROR DISPLAY - Full Width Bar */}
        {error && (
          <div className="w-full bg-yapmate-status-red border-y border-yapmate-black py-3 px-4">
            <span className="data-label text-yapmate-black">ERROR</span>
            <p className="text-yapmate-black font-mono text-sm mt-1">{error}</p>
          </div>
        )}

        {/* TRANSCRIPT - Data Row Format */}
        {transcript && (
          <>
            <div className="section-header">{'// TRANSCRIPT'}</div>
            <div className="px-4 py-4 border-b border-yapmate-slate-700 dark:border-yapmate-slate-700">
              <p className="font-mono text-sm leading-relaxed">
                {transcript}
              </p>
            </div>
          </>
        )}

        {/* INVOICE CREATED - Data Grid Format */}
        {invoice && invoiceId && (
          <>
            <div className="section-header">{'// INVOICE CREATED'}</div>
            <div className="data-row">
              <span className="data-label">STATUS</span>
              <span className="status-badge text-yapmate-status-green">READY</span>
            </div>
            <div className="data-row">
              <span className="data-label">CUSTOMER</span>
              <span className="data-value mono text-base">
                {invoice.customerName || 'UNSPECIFIED'}
              </span>
            </div>
            <div className="data-row border-b-0">
              <span className="data-label">JOB</span>
              <span className="font-mono text-sm text-right max-w-[60%]">
                {invoice.jobSummary}
              </span>
            </div>
          </>
        )}

        {/* BOTTOM ACTION BAR - Fixed */}
        {invoice && invoiceId && (
          <div className="fixed bottom-0 left-0 right-0 pb-safe">
            <button
              onClick={() => router.push(`/invoice?id=${invoiceId}`)}
              className="bar-button h-14"
            >
              REVIEW INVOICE
            </button>
          </div>
        )}

        {/* Spacer for Navigation */}
        <div className="h-20" />
      </main>
      <Navigation />
    </>
  )
}
