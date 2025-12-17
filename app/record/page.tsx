'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Invoice } from '@/lib/invoice'
import Navigation from '@/components/Navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

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
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      <PageShell
        title="Create Invoice"
        description="Describe your job and we'll handle the details"
      >
        {/* Trade Selector */}
        <Card className="mb-4">
          <label className="block text-yapmate-slate-400 text-label mb-2">
            Your Trade *
          </label>
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            disabled={isRecording || isTranscribing || isExtracting}
            className="w-full px-4 py-3 rounded-lg bg-yapmate-slate-900 border border-yapmate-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500 disabled:opacity-50"
          >
            <option value="Plumber">Plumber</option>
            <option value="Electrician">Electrician</option>
            <option value="Joiner">Joiner</option>
            <option value="Painter & Decorator">Painter & Decorator</option>
            <option value="Other">Other</option>
          </select>
          <p className="text-yapmate-slate-500 text-xs mt-2">
            Helps AI understand trade-specific terms
          </p>
        </Card>

        {/* Recording Controls */}
        <Card elevated className="mb-4">
          <div className="flex flex-col items-center gap-6 py-4">
            {/* Timer */}
            <div className="text-6xl font-mono text-white tabular-nums">
              {formatTime(recordingTime)}
            </div>

            {/* Record Button */}
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isTranscribing || isExtracting}
                className="w-24 h-24 rounded-full bg-red-500 active:bg-red-600 disabled:bg-yapmate-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 shadow-lg active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-white" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-24 h-24 rounded-full bg-yapmate-slate-700 active:bg-yapmate-slate-600 flex items-center justify-center transition-all duration-200 shadow-lg active:scale-95"
              >
                <div className="w-8 h-8 bg-white rounded-sm" />
              </button>
            )}

            {/* Status Text */}
            <div className="text-sm text-yapmate-slate-400 text-center">
              {isRecording
                ? 'Tap to stop recording'
                : isTranscribing
                  ? 'Transcribing your voice...'
                  : isExtracting
                    ? 'Creating your invoice...'
                    : 'Tap to start recording (max 60 seconds)'}
            </div>

            {/* Audio Level Meter */}
            {isRecording && (
              <div className="w-full max-w-md">
                <div className="w-full h-2 bg-yapmate-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yapmate-amber-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-yapmate-slate-500 mt-2 text-center">
                  {audioLevel === 0 ? '⚠️ No audio detected' : '🎤 Listening...'}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-4 border-2 border-red-500/50 bg-red-500/10">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

        {/* Transcript Display */}
        {transcript && (
          <Card elevated className="mb-4">
            <h3 className="text-white font-semibold mb-3">What we heard:</h3>
            <div className="bg-yapmate-slate-900 rounded-lg p-4">
              <p className="text-yapmate-slate-200 leading-relaxed text-sm">
                "{transcript}"
              </p>
            </div>
          </Card>
        )}

        {/* Invoice Preview */}
        {invoice && invoiceId && (
          <Card elevated className="mb-24">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">
                Invoice Created!
              </h3>
              <p className="text-yapmate-slate-400 text-sm">
                Review and send when ready
              </p>
            </div>

            <div className="bg-yapmate-slate-900 rounded-lg p-4 space-y-3 mb-4">
              <div>
                <p className="text-yapmate-slate-500 text-xs uppercase tracking-wide mb-1">
                  Customer
                </p>
                <p className="text-white font-semibold">
                  {invoice.customerName || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-yapmate-slate-500 text-xs uppercase tracking-wide mb-1">
                  Job Summary
                </p>
                <p className="text-yapmate-slate-200 text-sm">
                  {invoice.jobSummary}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => router.push(`/invoice/${invoiceId}`)}
                size="large"
                className="flex-1"
              >
                Review Invoice
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="secondary"
                size="large"
              >
                Done
              </Button>
            </div>
          </Card>
        )}
      </PageShell>
      <Navigation />
    </>
  )
}
