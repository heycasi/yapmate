'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Invoice } from '@/lib/invoice'
import Navigation from '@/components/Navigation'
import { ensureCustomer } from '@/lib/customer-helpers'
import { canCreateInvoice } from '@/lib/plan-access'

// Recording limits
const MAX_RECORDING_SECONDS = 180 // 3 minutes max

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
  const [canCreate, setCanCreate] = useState(true)
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)

  const router = useRouter()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

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
      return
    }

    // Check if user can create invoices
    setIsCheckingAccess(true)
    try {
      const accessCheck = await canCreateInvoice(session.user.id)
      setCanCreate(accessCheck.canCreate)

      if (!accessCheck.canCreate) {
        setPlanLimitMessage(accessCheck.reason || 'Cannot create more invoices')
      }
    } catch (err) {
      console.error('Error checking plan access:', err)
      // On error, allow creation (fail open)
      setCanCreate(true)
    } finally {
      setIsCheckingAccess(false)
    }
  }

  const startRecording = async () => {
    // Block if user cannot create invoices
    if (!canCreate) {
      setError(planLimitMessage || 'Cannot create more invoices')
      return
    }

    try {
      setError(null)
      setTranscript(null)
      setRawTranscript(null)
      setInvoice(null)
      setInvoiceId(null)
      setRecordingTime(0)
      startTimeRef.current = Date.now()
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
        const duration = Date.now() - startTimeRef.current
        stream.getTracks().forEach((track) => track.stop())

        if (duration < 1000) {
          setError('Recording too short (minimum 1 second)')
          return
        }

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
          if (newTime >= MAX_RECORDING_SECONDS) {
            stopRecording()
            setError('Max recording length is 3 minutes')
            return MAX_RECORDING_SECONDS
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const file = new File([audioBlob], 'recording.webm', { type: audioBlob.type })

      // Validate file size (max 25MB for Whisper)
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('Recording too large. Please record a shorter message.')
      }

      // Step 1: Call Supabase Edge Function for transcription
      const formData = new FormData()
      formData.append('file', file)

      const transcribeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/transcribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      )

      if (!transcribeResponse.ok) {
        const error = await transcribeResponse.json()
        if (transcribeResponse.status === 429) {
          throw new Error('Rate limit exceeded. Max 10 recordings per hour.')
        }
        throw new Error(error.error || 'Transcription failed')
      }

      const { text: rawTranscriptText } = await transcribeResponse.json()
      setRawTranscript(rawTranscriptText)

      // Step 2: Call Edge Function for cleaning
      const cleaningResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clean-transcript`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rawTranscript: rawTranscriptText }),
        }
      )

      if (!cleaningResponse.ok) {
        throw new Error('Transcript cleaning failed')
      }

      const { cleanedTranscript } = await cleaningResponse.json()
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Step 3: Call Edge Function for extraction
      const extractionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extract-invoice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript: transcriptText,
            trade: selectedTrade,
          }),
        }
      )

      if (!extractionResponse.ok) {
        const error = await extractionResponse.json()
        if (error.error.includes('Suspicious input')) {
          throw new Error('Suspicious input detected. Please record a normal invoice description.')
        }
        throw new Error(error.error || 'Extraction failed')
      }

      const { invoice: extractedInvoice } = await extractionResponse.json()

      // Ensure customer record exists and get customer_id
      const customerId = await ensureCustomer(session.user.id, extractedInvoice.customerName)

      // Enforce plan-based access control
      const { canUseVAT, canUseCIS } = await import('@/lib/plan-access')
      const vatAccess = await canUseVAT(session.user.id)
      const cisAccess = await canUseCIS(session.user.id)

      // Force VAT/CIS to false if user doesn't have access
      const finalVatRegistered = vatAccess && extractedInvoice.vatRegistered
      const finalCisJob = cisAccess && extractedInvoice.cisJob

      // Insert into Supabase
      const { data: invoiceData, error: invoiceError } = await (supabase
        .from('invoices') as any)
        .insert({
            user_id: session.user.id,
            customer_id: customerId,
            customer_name: extractedInvoice.customerName,
            job_summary: extractedInvoice.jobSummary,
            labour_hours: extractedInvoice.labourHours,
            labour_rate: 45.0, // Default
            cis_job: finalCisJob,
            cis_rate: finalCisJob ? 20.0 : 0,
            vat_registered: finalVatRegistered,
            vat_rate: finalVatRegistered ? 20.0 : 0,
            status: 'draft',
            notes: extractedInvoice.notes,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError
      if (!invoiceData) throw new Error('Failed to create invoice record')

      // Usage Logging
      try {
        await (supabase.from('usage_events') as any).insert({
          user_id: session.user.id,
          event_type: 'invoice_created',
          invoice_id: invoiceData.id,
        })
      } catch (logErr) {
        console.warn('Failed to log usage event:', logErr)
      }

      // Insert Materials
      if (extractedInvoice.materials.length > 0) {
        const materialsToInsert = extractedInvoice.materials
            .filter((m: { description: string; cost: number | null }) => m.cost !== null)
            .map((material: { description: string; cost: number | null }) => ({
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
              disabled={isTranscribing || isExtracting || !canCreate || isCheckingAccess}
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

        {/* PLAN LIMIT MESSAGE - Full Width Bar */}
        {!canCreate && planLimitMessage && !error && (
          <div className="w-full bg-[#2A2A2A] border-y border-[#3A3A3A] py-4 px-4">
            <div className="max-w-md mx-auto text-center">
              <span className="data-label text-[#F97316]">FREE PLAN LIMIT REACHED</span>
              <p className="text-[#F2F2F2] font-mono text-sm mt-2 mb-3">
                {planLimitMessage}
              </p>
              <p className="text-[#8A8A8A] text-sm mb-3">
                Upgrade to Pro to create unlimited invoices
              </p>
              <button
                onClick={() => router.push('/pricing')}
                className="bg-[#F97316] text-[#0B0B0B] font-semibold px-6 py-3 rounded-[4px] text-sm uppercase tracking-wide"
              >
                View Plans
              </button>
            </div>
          </div>
        )}

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

        {/* Spacer for bottom elements */}
        <div className="h-32" />
      </main>

      {/* BOTTOM ACTION BAR - Above Navigation */}
      {invoice && invoiceId && (
        <div className="fixed left-0 right-0 z-50" style={{ bottom: '68px' }}>
          <button
            onClick={() => router.push(`/invoice?id=${invoiceId}`)}
            className="bar-button h-14"
          >
            REVIEW INVOICE
          </button>
        </div>
      )}

      <Navigation />
    </>
  )
}
