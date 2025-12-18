'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to log in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-yapmate-white mb-2 uppercase tracking-wide">
            YapMate Login
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

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
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
              className="w-full px-4 py-4 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-yapmate-amber text-yapmate-black font-mono font-bold uppercase tracking-wide border-none transition-colors duration-snap active:bg-yapmate-status-yellow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center border-t border-yapmate-slate-700 pt-6">
          <p className="text-yapmate-slate-300 text-sm font-mono">
            No account?{' '}
            <Link
              href="/signup"
              className="text-yapmate-amber hover:text-yapmate-status-yellow font-bold transition-colors duration-snap"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
