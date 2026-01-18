/**
 * useVoiceInput - A hook for single-field voice recording and transcription
 *
 * Used in the invoice review screen to re-record individual fields without
 * wiping the entire invoice draft.
 */

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Max recording time for single field (30 seconds is plenty for a field)
const MAX_FIELD_RECORDING_SECONDS = 30

export interface VoiceInputState {
  isRecording: boolean
  isTranscribing: boolean
  error: string | null
  audioLevel: number
  recordingTime: number
}

export interface VoiceInputActions {
  startRecording: () => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
}

interface UseVoiceInputOptions {
  onTranscribed: (text: string) => void
  onError?: (error: string) => void
}

export function useVoiceInput(options: UseVoiceInputOptions): [VoiceInputState, VoiceInputActions] {
  const { onTranscribed, onError } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)
  const mimeTypeRef = useRef<string>('audio/webm')

  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setAudioLevel(0)
    setRecordingTime(0)
  }, [])

  const handleTranscription = useCallback(async (audioBlob: Blob) => {
    // Check if cancelled before processing
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }

    setIsTranscribing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const file = new File([audioBlob], 'field-recording.webm', { type: audioBlob.type })

      // Validate file size
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('Recording too large')
      }

      const formData = new FormData()
      formData.append('file', file)

      const transcribeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/transcribe`

      const response = await fetch(transcribeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'Transcription failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // Ignore parse errors
        }

        if (response.status === 429) {
          throw new Error(errorMessage)
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication error. Please log in again.')
        }
        throw new Error(errorMessage)
      }

      const { text } = await response.json()

      // Check again if cancelled during transcription
      if (cancelledRef.current) {
        cancelledRef.current = false
        return
      }

      // Call the success callback with transcribed text
      onTranscribed(text.trim())
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsTranscribing(false)
    }
  }, [onTranscribed, onError])

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) {
      return
    }

    try {
      cancelledRef.current = false
      setError(null)
      setRecordingTime(0)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // Determine MIME type
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }
      mimeTypeRef.current = mimeType

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
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
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
        }
      }

      mediaRecorder.onstop = async () => {
        cleanup()

        // Check if cancelled
        if (cancelledRef.current) {
          cancelledRef.current = false
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current })

        // Minimum recording duration check (0.5 seconds)
        if (audioBlob.size < 1000) {
          setError('Recording too short')
          return
        }

        await handleTranscription(audioBlob)
      }

      mediaRecorder.start(100)
      setIsRecording(true)

      // Timer with max duration - inline stop logic to avoid circular dependency
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= MAX_FIELD_RECORDING_SECONDS) {
            // Inline stop: directly stop the media recorder via ref
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop()
              setIsRecording(false)
            }
            return MAX_FIELD_RECORDING_SECONDS
          }
          return newTime
        })
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to access microphone')
      cleanup()
    }
  }, [isRecording, isTranscribing, cleanup, handleTranscription])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }

    setIsRecording(false)
    setIsTranscribing(false)
    setError(null)
    cleanup()
  }, [isRecording, cleanup])

  const state: VoiceInputState = {
    isRecording,
    isTranscribing,
    error,
    audioLevel,
    recordingTime,
  }

  const actions: VoiceInputActions = {
    startRecording,
    stopRecording,
    cancelRecording,
  }

  return [state, actions]
}
