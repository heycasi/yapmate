'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// Analytics tracking - using console for now (Vercel Analytics auto-tracks page views)
// Custom events can be added later if needed
const track = (event: string, props?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    console.log(`[Analytics] ${event}`, props || '')
    // Future: Add Vercel Analytics custom event tracking here
    // track(event, props)
  }
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [isReadyToLogin, setIsReadyToLogin] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setNeedsConfirmation(false)
    setIsReadyToLogin(false)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) throw error

      // Check if user can log in immediately (session exists) or needs confirmation
      if (data.session) {
        // User is logged in immediately - redirect to dashboard
        track('signup_success_ready_to_login')
        setIsReadyToLogin(true)
        // Auto-redirect after a brief delay to show success message
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else if (data.user) {
        // User created but needs email confirmation
        track('signup_success_needs_confirmation')
        setNeedsConfirmation(true)
      } else {
        // Fallback: treat as ready to login (when confirmation is disabled)
        track('signup_success_ready_to_login')
        setIsReadyToLogin(true)
      }
    } catch (err: any) {
      // Handle "User already registered" error
      if (err.message?.includes('already registered') || err.message?.includes('already exists')) {
        setError('An account with this email already exists. Please log in instead.')
        track('signup_error_already_exists')
      } else {
        setError(err.message || 'Failed to sign up')
        track('signup_error', { error: err.message })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Success state: Ready to login (confirmation disabled)
  if (isReadyToLogin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
        <div className="w-full max-w-md">
          <div className="border-2 border-yapmate-status-green bg-yapmate-status-green/10 p-8 text-center">
            <div className="text-6xl mb-4 text-yapmate-status-green">✓</div>
            <h1 className="font-mono text-xl font-bold text-yapmate-white mb-4 uppercase">
              Account Created
            </h1>
            <p className="text-yapmate-slate-300 text-sm mb-6 leading-relaxed">
              Your account has been created. You can log in now.
            </p>
            <Link
              href="/login"
              className="inline-block w-full h-12 flex items-center justify-center bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide transition-colors duration-snap active:bg-yapmate-status-yellow"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Success state: Needs email confirmation
  if (needsConfirmation) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
        <div className="w-full max-w-md">
          <div className="border-2 border-yapmate-status-green bg-yapmate-status-green/10 p-8 text-center">
            <div className="text-6xl mb-4 text-yapmate-status-green">✓</div>
            <h1 className="font-mono text-xl font-bold text-yapmate-white mb-4 uppercase">
              Check Your Email
            </h1>
            <p className="text-yapmate-slate-300 text-sm mb-6 leading-relaxed">
              We&apos;ve sent you a confirmation link. Check your email to verify your account, then log in.
            </p>
            <Link
              href="/login"
              className="inline-block w-full h-12 flex items-center justify-center bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide transition-colors duration-snap active:bg-yapmate-status-yellow"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
      <div className="w-full max-w-md">
        {/* Back to Home Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-yapmate-amber hover:text-yapmate-status-yellow font-mono text-sm transition-colors duration-snap"
          >
            ← HOME
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-yapmate-white mb-2 uppercase tracking-wide">
            YapMate Signup
          </h1>
          <p className="text-yapmate-slate-300 text-sm">
            Industrial invoicing for UK tradies
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 border-2 border-yapmate-status-red bg-yapmate-status-red/10 p-4">
            <p className="text-yapmate-status-red text-sm font-mono">{error}</p>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-6">
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

          <div>
            <label className="block text-yapmate-white text-xs font-mono uppercase tracking-wide mb-2">
              Password
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
            <p className="text-xs text-yapmate-slate-300 mt-2 font-mono">
              Min. 6 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide border-none transition-colors duration-snap active:bg-yapmate-status-yellow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center border-t border-yapmate-slate-700 pt-6">
          <p className="text-yapmate-slate-300 text-sm font-mono">
            Have an account?{' '}
            <Link
              href="/login"
              className="text-yapmate-amber hover:text-yapmate-status-yellow font-bold transition-colors duration-snap"
            >
              Log In
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
