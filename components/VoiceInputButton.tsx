'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { useVoiceInput } from '@/lib/use-voice-input'

interface VoiceInputButtonProps {
  onTranscribed: (text: string) => void
  disabled?: boolean
  /** Whether another voice input is currently active (prevents concurrent recordings) */
  globalRecordingActive?: boolean
  onRecordingStateChange?: (isActive: boolean) => void
  className?: string
  size?: 'sm' | 'md'
}

/**
 * A microphone button for re-recording individual fields.
 * Shows recording state, transcription progress, and handles errors gracefully.
 */
export function VoiceInputButton({
  onTranscribed,
  disabled = false,
  globalRecordingActive = false,
  onRecordingStateChange,
  className = '',
  size = 'sm',
}: VoiceInputButtonProps) {
  const prevActiveRef = useRef(false)

  const handleTranscribed = useCallback((text: string) => {
    onTranscribed(text)
  }, [onTranscribed])

  const [state, actions] = useVoiceInput({
    onTranscribed: handleTranscribed,
  })

  const { isRecording, isTranscribing, error, audioLevel } = state
  const { startRecording, stopRecording, cancelRecording } = actions

  const isActive = isRecording || isTranscribing

  // Notify parent of recording state changes
  useEffect(() => {
    if (prevActiveRef.current !== isActive) {
      prevActiveRef.current = isActive
      onRecordingStateChange?.(isActive)
    }
  }, [isActive, onRecordingStateChange])

  const handleClick = () => {
    if (disabled || (globalRecordingActive && !isActive)) {
      return
    }

    if (isRecording) {
      stopRecording()
    } else if (!isTranscribing) {
      startRecording()
    }
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    cancelRecording()
  }

  // Determine button size classes
  const sizeClasses = size === 'sm'
    ? 'w-8 h-8 min-w-[32px]'
    : 'w-10 h-10 min-w-[40px]'

  const iconSize = size === 'sm' ? 16 : 20

  // Determine button state and appearance
  const isDisabledByGlobal = globalRecordingActive && !isActive
  const isClickable = !disabled && !isDisabledByGlobal && !isTranscribing

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`}>
      {/* Main button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={!isClickable}
        className={`
          ${sizeClasses}
          flex items-center justify-center
          rounded
          transition-all duration-150
          ${isRecording
            ? 'bg-yapmate-status-red text-white animate-pulse'
            : isTranscribing
            ? 'bg-yapmate-amber text-yapmate-black'
            : disabled || isDisabledByGlobal
            ? 'bg-yapmate-slate-800 text-yapmate-slate-500 cursor-not-allowed'
            : 'bg-yapmate-slate-700 text-yapmate-slate-300 hover:bg-yapmate-slate-600 hover:text-white active:bg-yapmate-amber active:text-yapmate-black'
          }
        `}
        title={
          isRecording
            ? 'Tap to stop recording'
            : isTranscribing
            ? 'Transcribing...'
            : disabled
            ? 'Voice input disabled'
            : isDisabledByGlobal
            ? 'Another recording in progress'
            : 'Tap to re-record this field'
        }
      >
        {isTranscribing ? (
          // Loading spinner
          <svg
            className="animate-spin"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        ) : isRecording ? (
          // Stop icon (square)
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          // Microphone icon
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>

      {/* Cancel button (shown during recording or transcription) */}
      {isActive && (
        <button
          type="button"
          onClick={handleCancel}
          className={`
            ${sizeClasses}
            flex items-center justify-center
            rounded
            bg-yapmate-slate-800 text-yapmate-slate-400
            hover:bg-yapmate-slate-700 hover:text-yapmate-white
            transition-colors duration-150
          `}
          title="Cancel"
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Audio level indicator (shown during recording) */}
      {isRecording && (
        <div className="flex items-center gap-1 ml-1">
          <div
            className="w-1 h-3 bg-yapmate-status-green rounded-full transition-all duration-75"
            style={{ height: `${Math.max(12, Math.min(24, audioLevel / 4))}px` }}
          />
          <div
            className="w-1 h-3 bg-yapmate-status-green rounded-full transition-all duration-75"
            style={{ height: `${Math.max(12, Math.min(24, audioLevel / 3))}px` }}
          />
          <div
            className="w-1 h-3 bg-yapmate-status-green rounded-full transition-all duration-75"
            style={{ height: `${Math.max(12, Math.min(24, audioLevel / 5))}px` }}
          />
        </div>
      )}

      {/* Error tooltip */}
      {error && !isActive && (
        <div className="absolute top-full left-0 mt-1 z-10">
          <div className="bg-yapmate-status-red text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {error}
          </div>
        </div>
      )}
    </div>
  )
}

export default VoiceInputButton
