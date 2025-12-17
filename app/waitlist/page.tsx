'use client'

import { useState, FormEvent } from 'react'
import Image from 'next/image'

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setMessage(data.message || "You're on the list! We'll be in touch soon.")
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Something went wrong. Please try again.')
      }
    } catch (err) {
      setStatus('error')
      setMessage('Network error. Please check your connection and try again.')
    }
  }

  return (
    <main className="min-h-screen bg-[#000000] text-white">
      {/* Hero Section */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-12 relative flex items-center justify-center">
            {/* Outer glow - larger and more intense */}
            <div className="absolute inset-0 bg-[#ffc422] rounded-full blur-3xl opacity-30 scale-150"></div>
            {/* Inner glow */}
            <div className="absolute inset-0 bg-[#ffc422] rounded-full blur-xl opacity-40 scale-125"></div>
            {/* Logo background circle */}
            <div className="relative bg-[#ffc422] p-5 rounded-full shadow-2xl shadow-[#ffc422]/50">
              <Image
                src="/yapmatetransparetnew112.png"
                alt="YapMate Logo"
                width={200}
                height={200}
                className="relative z-10"
                priority
              />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Stop Typing Invoices.
            <br />
            <span className="text-[#ffc422]">Start Yapping Them.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-[#F2F2F2] mb-8 max-w-2xl leading-relaxed">
            Built for UK tradies who hate paperwork. Speak into your phone → get a clean invoice in seconds.
          </p>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-md mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email to join the early access list..."
                required
                disabled={status === 'loading'}
                className="flex-1 px-6 py-4 bg-[#1A1A1A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ffc422] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-8 py-4 bg-gradient-to-br from-[#F2C94C] to-[#E2B649] text-[#000000] font-bold rounded-lg hover:from-[#E2B649] hover:to-[#B48828] transition-all shadow-lg shadow-[#F2C94C]/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {status === 'loading' ? 'Joining...' : 'Get Early Access'}
              </button>
            </div>

            {/* Status Messages */}
            {status === 'success' && (
              <p className="mt-4 text-[#ffc422] font-medium">{message}</p>
            )}
            {status === 'error' && (
              <p className="mt-4 text-red-400">{message}</p>
            )}
          </form>

          {/* Credibility Line */}
          <p className="text-sm text-[#9CA3AF]">
            Made for sparkies, plumbers, joiners, carpet fitters and every tradie who grafts.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          How It <span className="text-[#ffc422]">Works</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 hover:border-[#ffc422]/50 transition-colors">
            <div className="text-4xl mb-4">🎤</div>
            <h3 className="text-xl font-bold mb-3 text-[#ffc422]">1. Tap Record</h3>
            <p className="text-gray-300">
              Say the job out loud — no typing, no faffing.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 hover:border-[#ffc422]/50 transition-colors">
            <div className="text-4xl mb-4">🧾</div>
            <h3 className="text-xl font-bold mb-3 text-[#ffc422]">2. YapMate Extracts the Details</h3>
            <p className="text-gray-300">
              Hours, materials, customer name, price — even slang and dialect.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 hover:border-[#ffc422]/50 transition-colors">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-3 text-[#ffc422]">3. Invoice Ready to Send</h3>
            <p className="text-gray-300">
              PDF ready to share with your customer in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Built for <span className="text-[#ffc422]">Real Tradies</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 border-l-4 border-l-[#ffc422] hover:border-[#ffc422]/50 transition-colors">
            <h3 className="font-bold text-lg mb-2 text-white">Understands UK Dialects</h3>
            <p className="text-gray-400">
              Glasgow, Scouse, Geordie, Manc — YapMate gets you.
            </p>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 border-l-4 border-l-[#ffc422] hover:border-[#ffc422]/50 transition-colors">
            <h3 className="font-bold text-lg mb-2 text-white">CIS-Ready Invoices</h3>
            <p className="text-gray-400">
              Handles CIS deductions automatically.
            </p>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 border-l-4 border-l-[#ffc422] hover:border-[#ffc422]/50 transition-colors">
            <h3 className="font-bold text-lg mb-2 text-white">VAT or Non-VAT Jobs</h3>
            <p className="text-gray-400">
              Flexible invoicing for any job type.
            </p>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 border-l-4 border-l-[#ffc422] hover:border-[#ffc422]/50 transition-colors">
            <h3 className="font-bold text-lg mb-2 text-white">Trade-Specific AI</h3>
            <p className="text-gray-400">
              Built for plumbers, sparkies, joiners, flooring and more.
            </p>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 border-l-4 border-l-[#ffc422] hover:border-[#ffc422]/50 transition-colors">
            <h3 className="font-bold text-lg mb-2 text-white">Material & Labour Breakdown</h3>
            <p className="text-gray-400">
              Automatically separates costs and hours.
            </p>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 border-l-4 border-l-[#ffc422] hover:border-[#ffc422]/50 transition-colors">
            <h3 className="font-bold text-lg mb-2 text-white">Saves All Your Jobs</h3>
            <p className="text-gray-400">
              Keep track of customers and invoices in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          What Tradies Are <span className="text-[#ffc422]">Saying</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 hover:border-[#ffc422]/30 transition-colors">
            <p className="text-gray-200 italic mb-4">
              &quot;This would save me a few hours every Sunday night.&quot;
            </p>
            <p className="text-gray-400 text-sm">— Electrician, Manchester</p>
          </div>

          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-gray-800 hover:border-[#ffc422]/30 transition-colors">
            <p className="text-gray-200 italic mb-4">
              &quot;It picked up my accent better than my phone ever has.&quot;
            </p>
            <p className="text-gray-400 text-sm">— Plumber, Glasgow</p>
          </div>
        </div>
      </section>

      {/* Footer CTA Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="bg-[#1A1A1A] p-8 md:p-12 rounded-2xl border-2 border-[#ffc422]/50 text-center shadow-2xl shadow-[#ffc422]/20">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Join the Waitlist
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Early users get a free month.
          </p>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email..."
                required
                disabled={status === 'loading'}
                className="flex-1 px-6 py-4 bg-[#000000] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ffc422] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-8 py-4 bg-gradient-to-br from-[#F2C94C] to-[#E2B649] text-[#000000] font-bold rounded-lg hover:from-[#E2B649] hover:to-[#B48828] transition-all shadow-lg shadow-[#F2C94C]/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {status === 'loading' ? 'Joining...' : 'Get Early Access'}
              </button>
            </div>

            {status === 'success' && (
              <p className="mt-4 text-[#ffc422] font-medium">{message}</p>
            )}
            {status === 'error' && (
              <p className="mt-4 text-red-400">{message}</p>
            )}
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-gray-500 text-sm border-t border-gray-900">
        <p>© {new Date().getFullYear()} YapMate. Built for tradies, by tradies.</p>
      </footer>
    </main>
  )
}
