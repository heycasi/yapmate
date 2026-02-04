'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const returnPath = searchParams.get('return') || '/record'
  console.log('[ResetPassword] returnPath=' + returnPath)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // If there's a session with a recovery token, it's valid
      setIsValidSession(!!session)
    }
    checkSession()

    // Listen for auth state changes (recovery link clicked)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess(true)

      // Redirect to return path (or /record) after 2 seconds
      setTimeout(() => {
        router.push(returnPath)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (isValidSession === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
        <div className="text-yapmate-white font-mono">Loading...</div>
      </main>
    )
  }

  // No valid session - invalid or expired link
  if (!isValidSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 border-2 border-yapmate-status-red bg-yapmate-status-red/10 p-6">
            <h2 className="text-yapmate-status-red font-mono font-bold text-lg mb-2">
              INVALID OR EXPIRED LINK
            </h2>
            <p className="text-yapmate-slate-300 text-sm">
              This password reset link is invalid or has expired.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="inline-block bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide px-6 py-3 transition-colors duration-snap active:bg-yapmate-status-yellow"
          >
            Request New Link
          </Link>
        </div>
      </main>
    )
  }

  // Success state
  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 border-2 border-yapmate-status-green bg-yapmate-status-green/10 p-6">
            <h2 className="text-yapmate-status-green font-mono font-bold text-lg mb-2">
              PASSWORD UPDATED
            </h2>
            <p className="text-yapmate-slate-300 text-sm">
              Your password has been reset successfully. Redirecting...
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-yapmate-white mb-2 uppercase tracking-wide">
            Reset Password
          </h1>
          <p className="text-yapmate-slate-300 text-sm">
            Enter your new password below
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 border-2 border-yapmate-status-red bg-yapmate-status-red/10 p-4">
            <p className="text-yapmate-status-red text-sm font-mono">{error}</p>
          </div>
        )}

        {/* Reset Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-yapmate-white text-xs font-mono uppercase tracking-wide mb-2">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-4 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-yapmate-white text-xs font-mono uppercase tracking-wide mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-4 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide border-none transition-colors duration-snap active:bg-yapmate-status-yellow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
          <div className="text-yapmate-white font-mono">Loading...</div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
