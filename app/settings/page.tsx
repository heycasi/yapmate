'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

interface UserPreferences {
  default_labour_rate: number
  default_vat_enabled: boolean
  default_cis_enabled: boolean
  bank_account_name: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
  payment_reference: string | null
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [labourRate, setLabourRate] = useState('45.00')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [cisEnabled, setCisEnabled] = useState(false)

  const [bankAccountName, setBankAccountName] = useState('')
  const [bankSortCode, setBankSortCode] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    loadUserAndPreferences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUserAndPreferences = async () => {
    try {
      // Check auth
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Load preferences
      const { data, error } = await (supabase
        .from('user_preferences') as any)
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" - that's okay, we'll use defaults
        console.error('Error loading preferences:', error)
      }

      if (data) {
        setLabourRate(data.default_labour_rate.toString())
        setVatEnabled(data.default_vat_enabled)
        setCisEnabled(data.default_cis_enabled)
        setBankAccountName(data.bank_account_name || '')
        setBankSortCode(data.bank_sort_code || '')
        setBankAccountNumber(data.bank_account_number || '')
        setPaymentReference(data.payment_reference || '')
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate sort code format if provided
      if (bankSortCode && !/^\d{2}-\d{2}-\d{2}$/.test(bankSortCode)) {
        throw new Error('Sort code must be in format XX-XX-XX')
      }

      const preferences: UserPreferences = {
        default_labour_rate: parseFloat(labourRate),
        default_vat_enabled: vatEnabled,
        default_cis_enabled: cisEnabled,
        bank_account_name: bankAccountName || null,
        bank_sort_code: bankSortCode || null,
        bank_account_number: bankAccountNumber || null,
        payment_reference: paymentReference || null,
      }

      // Upsert preferences
      const { error } = await (supabase
        .from('user_preferences') as any)
        .upsert({
          user_id: user.id,
          ...preferences,
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <span className="font-mono text-sm text-yapmate-slate-300">{'/ / LOADING SETTINGS'}</span>
        </div>
        <Navigation />
      </>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-yapmate-black">
        {/* Header */}
        <div className="border-b border-yapmate-slate-700 px-4 py-4">
          <h1 className="font-mono text-xl font-bold text-yapmate-white uppercase tracking-wide">
            Settings
          </h1>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mx-4 mt-4 border-2 border-yapmate-status-red bg-yapmate-status-red/10 p-4">
            <p className="text-yapmate-status-red text-sm font-mono">{error}</p>
          </div>
        )}

        {success && (
          <div className="mx-4 mt-4 border-2 border-yapmate-status-green bg-yapmate-status-green/10 p-4">
            <p className="text-yapmate-status-green text-sm font-mono">Preferences saved</p>
          </div>
        )}

        <div className="p-4 space-y-6 pb-32">
          {/* Default Labour Rate */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <label className="block text-yapmate-white text-xs font-mono uppercase tracking-wide mb-2">
              Default Labour Rate (£/hr)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={labourRate}
              onChange={(e) => setLabourRate(e.target.value)}
              className="w-full px-4 py-4 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white text-2xl font-mono font-bold focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
            />
            <p className="text-xs text-yapmate-slate-300 mt-2 font-mono">
              Used as default for new invoices
            </p>
          </div>

          {/* Default VAT */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-yapmate-white text-xs font-mono uppercase tracking-wide">
                Default VAT Enabled
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 border-2 border-yapmate-slate-700 peer-focus:border-yapmate-amber peer-checked:bg-yapmate-amber peer-checked:border-yapmate-amber transition-colors duration-snap"></div>
                <div className="absolute left-1 top-1 w-6 h-6 bg-yapmate-white peer-checked:translate-x-6 transition-transform duration-snap"></div>
              </div>
            </label>
            <p className="text-xs text-yapmate-slate-300 mt-2 font-mono">
              New invoices start with VAT {vatEnabled ? 'ON' : 'OFF'}
            </p>
          </div>

          {/* Default CIS */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-yapmate-white text-xs font-mono uppercase tracking-wide">
                Default CIS Enabled
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={cisEnabled}
                  onChange={(e) => setCisEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 border-2 border-yapmate-slate-700 peer-focus:border-yapmate-amber peer-checked:bg-yapmate-amber peer-checked:border-yapmate-amber transition-colors duration-snap"></div>
                <div className="absolute left-1 top-1 w-6 h-6 bg-yapmate-white peer-checked:translate-x-6 transition-transform duration-snap"></div>
              </div>
            </label>
            <p className="text-xs text-yapmate-slate-300 mt-2 font-mono">
              New invoices start with CIS {cisEnabled ? 'ON' : 'OFF'}
            </p>
          </div>

          {/* Payment Details */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <h2 className="text-yapmate-white text-sm font-mono uppercase tracking-wide mb-4">
              Payment Details
            </h2>
            <p className="text-xs text-yapmate-slate-400 font-mono mb-4">
              Bank details will appear on all generated invoice PDFs
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
                  Sort Code
                </label>
                <input
                  type="text"
                  value={bankSortCode}
                  onChange={(e) => setBankSortCode(e.target.value)}
                  className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
                  placeholder="12-34-56"
                  maxLength={8}
                />
                <p className="text-xs text-yapmate-slate-400 font-mono mt-1">
                  Format: XX-XX-XX
                </p>
              </div>

              <div>
                <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
                  placeholder="12345678"
                  maxLength={8}
                />
              </div>

              <div>
                <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
                  Payment Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
                  placeholder="e.g. INV or your name"
                />
                <p className="text-xs text-yapmate-slate-400 font-mono mt-1">
                  Defaults to invoice number if left blank
                </p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="pt-4">
            <button
              onClick={handleLogout}
              className="w-full h-12 border-2 border-yapmate-status-red text-yapmate-status-red font-mono font-bold uppercase tracking-wide bg-transparent transition-colors duration-snap active:bg-yapmate-status-red active:text-yapmate-black"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Fixed Bottom Save Button */}
        <div className="fixed bottom-0 left-0 right-0 pb-safe" style={{ bottom: '68px' }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bar-button h-14"
          >
            {isSaving ? 'SAVING...' : 'SAVE PREFERENCES'}
          </button>
        </div>
      </main>
      <Navigation />
    </>
  )
}
