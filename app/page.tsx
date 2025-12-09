import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-6xl font-bold text-white mb-6">
          YapMate
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Voice-powered invoice assistant for UK tradespeople.
          <br />
          Just yap your job details, we&apos;ll handle the rest.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/record"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors duration-200"
          >
            Start Recording
          </Link>
          <Link
            href="/waitlist"
            className="inline-block text-gray-400 hover:text-white font-medium px-6 py-4 transition-colors duration-200"
          >
            Join Waitlist →
          </Link>
        </div>
      </div>
    </main>
  )
}
