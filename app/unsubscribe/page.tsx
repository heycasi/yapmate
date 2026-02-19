import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unsubscribe | YapMate',
  description: 'Unsubscribe from YapMate emails',
}

export default function UnsubscribePage() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F2F2F2] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center py-16">
        <div className="w-14 h-14 border border-gray-800 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-7 h-7 text-yapmate-gray-light"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1
          className="text-2xl font-bold text-white mb-3"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Unsubscribe
        </h1>

        <p className="text-yapmate-gray-light mb-8">
          Sorry to see you go. To unsubscribe from YapMate emails, send a quick email to:
        </p>

        <a
          href="mailto:connor@yapmate.co.uk?subject=Unsubscribe"
          className="inline-block bg-yapmate-status-orange text-black px-6 py-3 font-bold hover:bg-orange-400 transition-colors min-h-0"
        >
          connor@yapmate.co.uk
        </a>

        <p className="text-sm text-yapmate-gray-light mt-4">
          Just send &quot;unsubscribe&quot; and we&apos;ll remove you within 24 hours.
        </p>

        <div className="border-t border-gray-800 mt-10 pt-6">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} YapMate
          </p>
        </div>
      </div>
    </main>
  )
}
