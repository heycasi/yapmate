'use client'

import { useEffect } from 'react'

const APP_STORE_URL = 'https://apps.apple.com/gb/app/yapmate/id6756750891'

export default function AppRedirect() {
  useEffect(() => {
    // Immediate redirect to App Store
    window.location.href = APP_STORE_URL
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center bg-yapmate-black p-6">
      <div className="text-center">
        <p className="text-yapmate-white font-mono mb-4">Redirecting to App Store...</p>
        <a
          href={APP_STORE_URL}
          className="text-yapmate-amber hover:text-yapmate-status-yellow font-mono underline"
        >
          Click here if not redirected
        </a>
      </div>
    </main>
  )
}
