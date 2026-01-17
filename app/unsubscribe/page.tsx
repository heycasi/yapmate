export const metadata = {
  title: 'Unsubscribe | YapMate',
  description: 'Unsubscribe from YapMate marketing emails',
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You&apos;ve been unsubscribed
          </h1>
          <p className="text-gray-600">
            You won&apos;t receive marketing emails from YapMate anymore.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-6 text-sm text-gray-500">
          <p className="mb-4">
            If you didn&apos;t mean to unsubscribe, or if this was a mistake, get in touch:
          </p>
          <a
            href="mailto:support@yapmate.co.uk"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            support@yapmate.co.uk
          </a>
        </div>

        <div className="mt-8">
          <a
            href="/"
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            ← Back to YapMate
          </a>
        </div>
      </div>
    </div>
  )
}
