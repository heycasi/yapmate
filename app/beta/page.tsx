'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function BetaSignupPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !email.includes('@')) {
      setStatus('error')
      setMessage('Please enter a valid email address')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const response = await fetch('/api/beta-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(data.error || 'Something went wrong')
        return
      }

      setStatus('success')
      setMessage(`You're in! Check ${email} for your access details.`)
      setEmail('')

    } catch (error) {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <Image
          src="/email/yapmate-logo.png"
          alt="YapMate"
          width={150}
          height={40}
          className="mx-auto"
        />
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">

          {status === 'success' ? (
            // Success state
            <div className="text-center">
              <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">You&apos;re in!</h1>
              <p className="text-slate-400 mb-8">{message}</p>
              <a
                href="https://apps.apple.com/gb/app/yapmate/id6756750891"
                className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3 rounded-lg transition-colors"
              >
                Download YapMate
              </a>
            </div>
          ) : (
            // Form state
            <div>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-3">
                  Try YapMate Free
                </h1>
                <p className="text-slate-400">
                  Get 7 days of Pro access - no card required
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-4 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-lg"
                    disabled={status === 'loading'}
                  />
                </div>

                {status === 'error' && (
                  <p className="text-red-400 text-sm">{message}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-900 font-semibold py-4 rounded-lg transition-colors text-lg"
                >
                  {status === 'loading' ? 'Setting up your access...' : 'Get Free Access'}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-slate-500 text-sm mb-4">What you get:</p>
                <div className="flex justify-center gap-6 text-slate-400 text-sm">
                  <span>Unlimited invoices</span>
                  <span>VAT support</span>
                  <span>PDF export</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-slate-500 text-sm">
        <p>Voice-powered invoicing for UK tradespeople</p>
        <a href="https://www.yapmate.co.uk" className="text-amber-500 hover:text-amber-400">
          www.yapmate.co.uk
        </a>
      </footer>
    </div>
  )
}
