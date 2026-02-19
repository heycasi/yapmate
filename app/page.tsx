import Link from 'next/link'
import Image from 'next/image'
import AppStoreBadge from '@/components/AppStoreBadge'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-yapmate-black text-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link
              href="/record"
              className="text-yapmate-amber hover:text-white font-semibold transition-colors text-sm py-2"
            >
              RECORD
            </Link>
            <Link
              href="/pricing"
              className="text-yapmate-amber hover:text-white font-semibold transition-colors text-sm py-2"
            >
              PRICING
            </Link>
            <Link
              href="/blog"
              className="text-yapmate-amber hover:text-white font-semibold transition-colors text-sm py-2"
            >
              BLOG
            </Link>
            <Link
              href="/login"
              className="text-yapmate-amber hover:text-white font-semibold transition-colors text-sm py-2"
            >
              LOG IN
            </Link>
          </div>
          <AppStoreBadge className="w-32" />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-16 md:py-24 max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center">
          {/* Logo with Glow Effect */}
          <div className="mb-12 relative flex items-center justify-center">
            {/* Outer glow - larger and more intense */}
            <div className="absolute inset-0 bg-yapmate-amber rounded-full blur-3xl opacity-30 scale-150" />
            {/* Inner glow */}
            <div className="absolute inset-0 bg-yapmate-amber rounded-full blur-xl opacity-40 scale-125" />
            {/* Logo - no background circle to avoid overlap */}
            <div className="relative">
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
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-8">
            YapMate
          </h1>

          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-8">
            Talk the Job.
            <br />
            <span className="text-yapmate-amber">Invoice Done.</span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-yapmate-gray-lightest mb-12 max-w-2xl leading-relaxed">
            Speak your job details into your phone.
            <br />
            YapMate turns it into a proper invoice — fast, simple, and ready to send.
          </p>

          {/* CTA Section */}
          <div className="flex flex-col items-center gap-6 mt-8">
            {/* Primary CTA - Start Recording (for users who already have the app) */}
            <Link
              href="/record"
              className="px-12 py-5 bg-yapmate-amber text-yapmate-black font-bold rounded-lg hover:bg-yapmate-amber/80 transition-all text-center text-lg shadow-lg shadow-yapmate-amber/20"
            >
              Start Recording
            </Link>

            {/* App Store CTA */}
            <a
              href="https://apps.apple.com/gb/app/yapmate/id6756750891"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yapmate-amber hover:text-white transition-colors text-sm font-semibold"
            >
              Download on App Store →
            </a>

            {/* Pricing CTA */}
            <Link
              href="/pricing"
              className="text-yapmate-gray-light hover:text-white transition-colors text-sm"
            >
              View pricing
            </Link>
          </div>

          {/* Social Proof / Tagline */}
          <p className="mt-12 text-sm text-yapmate-gray-light">
            Voice invoicing for every trade. No typing. No forms.
          </p>
        </div>
      </section>

      {/* Quick Features Section */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-yapmate-gray-dark p-6 rounded-xl border border-gray-800 hover:border-yapmate-amber/50 transition-colors">
            <div className="text-4xl mb-4">🎤</div>
            <h3 className="text-xl font-bold mb-2 text-yapmate-amber">Just Speak</h3>
            <p className="text-yapmate-gray-lightest">
              No typing. No fiddly fields. Just say the job and it&apos;s done.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-yapmate-gray-dark p-6 rounded-xl border border-gray-800 hover:border-yapmate-amber/50 transition-colors">
            <div className="text-4xl mb-4">🧾</div>
            <h3 className="text-xl font-bold mb-2 text-yapmate-amber">Auto-Invoice</h3>
            <p className="text-yapmate-gray-lightest">
              Professional invoices generated in seconds, ready to send.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-yapmate-gray-dark p-6 rounded-xl border border-gray-800 hover:border-yapmate-amber/50 transition-colors">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2 text-yapmate-amber">UK-Focused</h3>
            <p className="text-yapmate-gray-lightest">
              VAT, CIS, and Reverse Charge handled. Built for how UK trades work.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  )
}
