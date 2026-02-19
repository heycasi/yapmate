import type { Metadata } from 'next'

const APP_URL =
  'https://yapmate.co.uk/app?utm_source=email&utm_medium=cold&utm_campaign=leads'

export const metadata: Metadata = {
  title: 'YapMate — Invoice by Voice in 30 Seconds',
  description:
    'Voice-powered invoicing for UK tradespeople. Talk for 30 seconds, get a professional invoice. VAT and CIS handled automatically.',
  openGraph: {
    title: 'YapMate — Invoice by Voice in 30 Seconds',
    description:
      'Voice-powered invoicing for UK tradespeople. VAT and CIS handled automatically.',
    type: 'website',
    url: 'https://yapmate.co.uk/try',
  },
}

export default function TryPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F2F2F2] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-yapmate-status-orange text-sm font-semibold uppercase tracking-wider mb-6">
          Built for tradespeople
        </p>

        <h1
          className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4 max-w-lg"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Invoice by voice.
          <br />
          30 seconds. Done.
        </h1>

        <p className="text-lg text-yapmate-gray-light max-w-md mb-10">
          Speak your job details into your phone. YapMate turns it into a professional invoice —
          ready to send.
        </p>

        {/* Video placeholder */}
        <div className="w-full max-w-sm mb-10">
          <a
            href={APP_URL}
            className="block relative aspect-[9/16] max-h-[420px] mx-auto bg-gray-900 border border-gray-800 overflow-hidden group min-h-0"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-yapmate-status-orange/20 flex items-center justify-center mb-3 group-hover:bg-yapmate-status-orange/30 transition-colors">
                <svg
                  className="w-8 h-8 text-yapmate-status-orange ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-sm text-yapmate-gray-light">See it in action</p>
            </div>
          </a>
        </div>

        {/* 3 bullet points */}
        <div className="w-full max-w-sm space-y-4 mb-10 text-left">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 bg-yapmate-status-orange/10 flex items-center justify-center mt-0.5">
              <span className="text-yapmate-status-orange font-bold text-sm">1</span>
            </div>
            <div>
              <p
                className="text-white font-semibold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Speak your job details
              </p>
              <p className="text-sm text-yapmate-gray-light">
                Labour, materials, customer — just talk
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 bg-yapmate-status-orange/10 flex items-center justify-center mt-0.5">
              <span className="text-yapmate-status-orange font-bold text-sm">2</span>
            </div>
            <div>
              <p
                className="text-white font-semibold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                VAT &amp; CIS auto-calculated
              </p>
              <p className="text-sm text-yapmate-gray-light">
                Labour/materials split, 20% deduction — sorted
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 bg-yapmate-status-orange/10 flex items-center justify-center mt-0.5">
              <span className="text-yapmate-status-orange font-bold text-sm">3</span>
            </div>
            <div>
              <p
                className="text-white font-semibold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                PDF sent to your customer
              </p>
              <p className="text-sm text-yapmate-gray-light">
                Professional invoice, emailed in seconds
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href={APP_URL}
          className="w-full max-w-sm block bg-yapmate-status-orange text-black text-center py-4 font-bold text-lg hover:bg-orange-400 transition-colors min-h-0"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Try Free for 7 Days
        </a>

        <p className="text-xs text-yapmate-gray-light mt-3">No card needed. Cancel anytime.</p>
      </section>

      {/* Social proof */}
      <section className="border-t border-gray-800 px-6 py-8 text-center">
        <p className="text-sm text-yapmate-gray-light mb-1">
          Join tradespeople across the UK who&apos;ve ditched the spreadsheet.
        </p>
        <div className="flex items-center justify-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <svg
              key={i}
              className="w-4 h-4 text-yapmate-status-orange"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-xs text-yapmate-gray-light ml-1">5.0 on the App Store</span>
        </div>
      </section>

      {/* Minimal footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} YapMate</p>
      </footer>
    </main>
  )
}
