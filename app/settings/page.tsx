'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    } else {
      setUser(session.user)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen p-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Settings</h1>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
            {/* Account Info */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Account Information
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Email
                  </label>
                  <p className="text-white">{user.email}</p>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    User ID
                  </label>
                  <p className="text-white text-xs font-mono">{user.id}</p>
                </div>
              </div>
            </div>

            {/* Default Rates */}
            <div className="border-t border-white/20 pt-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Default Rates
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-white text-sm mb-2">
                    Labour Rate (£/hr)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue="45.00"
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-2">
                    CIS Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue="20.0"
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-2">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue="20.0"
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Logout */}
            <div className="border-t border-white/20 pt-6">
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </main>
      <Navigation />
    </>
  )
}
