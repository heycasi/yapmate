'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Invoice } from '@/lib/invoice'
import Navigation from '@/components/Navigation'

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
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Transcription failed')
      }

      const data = await response.json()

      // Store both raw and cleaned transcripts
      setRawTranscript(data.rawTranscript)
      setTranscript(data.transcript)

      // Log raw transcript for debugging
      console.log('Raw transcript:', data.rawTranscript)
      console.log('Cleaned transcript:', data.transcript)

      // Use the cleaned transcript for extraction
      await handleExtraction(data.transcript)
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
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transcript: transcriptText,
          trade: selectedTrade // Pass selected trade for context
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        const errorData = await response.json()
        throw new Error(errorData.error || 'Extraction failed')
      }

      const data = await response.json()
      
      if (!data.invoiceId) {
        throw new Error('Failed to save invoice: No ID returned')
      }

      setInvoice(data.invoice)
      setInvoiceId(data.invoiceId)
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
              onClick={() => router.push(`/invoice/${invoiceId}`)}
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
