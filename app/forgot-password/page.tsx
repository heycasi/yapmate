'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 border-2 border-yapmate-status-green bg-yapmate-status-green/10 p-6">
            <h2 className="text-yapmate-status-green font-mono font-bold text-lg mb-2">
              CHECK YOUR EMAIL
            </h2>
            <p className="text-yapmate-slate-300 text-sm">
              We&apos;ve sent a password reset link to <strong className="text-yapmate-white">{email}</strong>
            </p>
          </div>
          <p className="text-yapmate-slate-400 text-xs mb-6">
            Didn&apos;t receive the email? Check your spam folder or try again.
          </p>
          <Link
            href="/login"
            className="inline-block text-yapmate-amber hover:text-yapmate-status-yellow font-mono text-sm transition-colors duration-snap"
          >
            ← Back to Login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
      <div className="w-full max-w-md">
        {/* Back to Login Link */}
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center text-yapmate-amber hover:text-yapmate-status-yellow font-mono text-sm transition-colors duration-snap"
          >
            ← BACK TO LOGIN
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-yapmate-white mb-2 uppercase tracking-wide">
            Forgot Password
          </h1>
          <p className="text-yapmate-slate-300 text-sm">
            Enter your email and we&apos;ll send you a reset link
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-4 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
              placeholder="your@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide border-none transition-colors duration-snap active:bg-yapmate-status-yellow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'SENDING...' : 'SEND RESET LINK'}
          </button>
        </form>
      </div>
    </main>
  )
}
