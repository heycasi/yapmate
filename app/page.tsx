import Link from 'next/link'
import Image from 'next/image'
import AppStoreBadge from '@/components/AppStoreBadge'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-yapmate-black text-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-end items-center gap-3">
          <Link
            href="/login"
            className="px-6 py-2 text-yapmate-yellow hover:text-yapmate-white font-semibold transition-all"
          >
            LOG IN
          </Link>
          <Link
            href="/signup"
            className="px-6 py-2 bg-yapmate-yellow text-yapmate-black hover:bg-yellow-400 font-semibold rounded transition-all"
          >
            SIGN UP
          </Link>
          <Link
            href="/pricing"
            className="px-6 py-2 border border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-semibold rounded transition-all"
          >
            PRICING
          </Link>
          <AppStoreBadge className="hidden md:block w-32" />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-16 md:py-24 max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center">
          {/* Logo with Glow Effect */}
          <div className="mb-12 relative flex items-center justify-center">
            {/* Outer glow - larger and more intense */}
            <div className="absolute inset-0 bg-yapmate-yellow rounded-full blur-3xl opacity-30 scale-150" />
            {/* Inner glow */}
            <div className="absolute inset-0 bg-yapmate-yellow rounded-full blur-xl opacity-40 scale-125" />
            {/* Logo background circle */}
            <div className="relative bg-yapmate-yellow p-5 rounded-full shadow-yapmate-glow">
              <Image
                src="/yapmatetransparetnew112.png"
                alt="YapMate Logo"
                width={150}
                height={150}
                className="relative z-10"
                priority
              />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            YapMate
          </h1>

          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
            Stop Typing Invoices.
            <br />
            <span className="text-yapmate-yellow">Start Yapping Them.</span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-yapmate-gray-lightest mb-10 max-w-2xl leading-relaxed">
            Voice-powered invoice assistant for UK tradespeople.
            <br />
            Just yap your job details, we&apos;ll handle the rest.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
            <Link
              href="/waitlist"
              className="w-full sm:flex-1 px-8 py-4 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button text-center text-lg"
            >
              Join Waitlist
            </Link>
            <Link
              href="/record"
              className="w-full sm:flex-1 px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center text-lg"
            >
              Try Demo
            </Link>
          </div>

          {/* App Store Badge */}
          <div className="mt-6">
            <AppStoreBadge className="w-36 md:w-40" />
          </div>

          {/* Social Proof / Tagline */}
          <p className="mt-6 text-sm text-yapmate-gray-light">
            Built for sparkies, plumbers, joiners, and every tradie who grafts
          </p>
        </div>
      </section>

      {/* Quick Features Section */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-yapmate-gray-dark p-6 rounded-xl border border-gray-800 hover:border-yapmate-yellow/50 transition-colors">
            <div className="text-4xl mb-4">🎤</div>
            <h3 className="text-xl font-bold mb-2 text-yapmate-yellow">Just Speak</h3>
            <p className="text-yapmate-gray-lightest">
              No typing. No forms. Just say the job and we&apos;ll handle it.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-yapmate-gray-dark p-6 rounded-xl border border-gray-800 hover:border-yapmate-yellow/50 transition-colors">
            <div className="text-4xl mb-4">🧾</div>
            <h3 className="text-xl font-bold mb-2 text-yapmate-yellow">Auto-Invoice</h3>
            <p className="text-yapmate-gray-lightest">
              Professional invoices generated in seconds, ready to send.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-yapmate-gray-dark p-6 rounded-xl border border-gray-800 hover:border-yapmate-yellow/50 transition-colors">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2 text-yapmate-yellow">UK-Focused</h3>
            <p className="text-yapmate-gray-lightest">
              CIS deductions, VAT rates, and UK trade slang understood.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  )
}
