'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { getUserPlan, canUseVAT, canUseCIS, canUseInvoiceBranding, type PricingPlan } from '@/lib/plan-access'
import { BRANDING_PAYWALL_ERROR } from '@/lib/logo-upload'
import { isIAPAvailable, restorePurchases, getCustomerInfo } from '@/lib/iap'
import { syncRevenueCatToSupabase } from '@/lib/iap-sync'
import { isIOS, isWeb, isBillingEnabled, isTradeEnabled } from '@/lib/runtime-config'
import { uploadLogo, deleteLogo, validateLogoFile } from '@/lib/logo-upload'

interface UserPreferences {
  default_labour_rate: number
  default_vat_enabled: boolean
  default_cis_enabled: boolean
  bank_account_name: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
  payment_reference: string | null
  invoice_logo_url: string | null
  invoice_company_name: string | null
  plan?: 'free' | 'pro' | 'trade'
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [labourRate, setLabourRate] = useState('45.00')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [cisEnabled, setCisEnabled] = useState(false)

  const [bankAccountName, setBankAccountName] = useState('')
  const [bankSortCode, setBankSortCode] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  // Invoice branding
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState<string | null>(null)
  const [invoiceCompanyName, setInvoiceCompanyName] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  // Plan-based access control
  const [userPlan, setUserPlan] = useState<PricingPlan>('free')
  const [canAccessVAT, setCanAccessVAT] = useState(false)
  const [canAccessCIS, setCanAccessCIS] = useState(false)
  const [canAccessBranding, setCanAccessBranding] = useState(false)

  // Subscription status (iOS only)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null)
  const [willRenew, setWillRenew] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    loadUserAndPreferences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSubscriptionStatus = async () => {
    if (!isIOS() || !isIAPAvailable()) return

    try {
      const customerInfo = await getCustomerInfo()
      if (!customerInfo) return

      const { entitlements } = customerInfo
      const activeEntitlements = entitlements?.active || {}

      // Check for active entitlements
      let status = 'expired'
      let expiryDate: string | null = null
      let renew = false

      if (activeEntitlements.trade?.isActive) {
        const ent = activeEntitlements.trade
        status = ent.periodType === 'TRIAL' || ent.periodType === 'INTRO' ? 'trialing' : 'active'
        expiryDate = ent.expirationDate
        renew = ent.willRenew
      } else if (activeEntitlements.pro?.isActive) {
        const ent = activeEntitlements.pro
        status = ent.periodType === 'TRIAL' || ent.periodType === 'INTRO' ? 'trialing' : 'active'
        expiryDate = ent.expirationDate
        renew = ent.willRenew
      }

      setSubscriptionStatus(status)
      setSubscriptionExpiry(expiryDate)
      setWillRenew(renew)
    } catch (err) {
      console.error('Error loading subscription status:', err)
    }
  }

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

      // Check plan access
      const plan = await getUserPlan(session.user.id)
      const vatAccess = await canUseVAT(session.user.id)
      const cisAccess = await canUseCIS(session.user.id)
      const brandingAccess = await canUseInvoiceBranding(session.user.id)

      setUserPlan(plan)
      setCanAccessVAT(vatAccess)
      setCanAccessCIS(cisAccess)
      setCanAccessBranding(brandingAccess)

      // Load subscription status (iOS only)
      await loadSubscriptionStatus()

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
        setLabourRate(data.default_labour_rate?.toString() || '45.00')
        // Only set VAT/CIS if user has access
        setVatEnabled(vatAccess && data.default_vat_enabled)
        setCisEnabled(cisAccess && data.default_cis_enabled)
        setBankAccountName(data.bank_account_name || '')
        setBankSortCode(data.bank_sort_code || '')
        setBankAccountNumber(data.bank_account_number || '')
        setPaymentReference(data.payment_reference || '')
        // Invoice branding
        setInvoiceLogoUrl(data.invoice_logo_url || null)
        setInvoiceCompanyName(data.invoice_company_name || '')
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

      // Enforce plan-based access control
      let finalVatEnabled = vatEnabled
      let finalCisEnabled = cisEnabled
      let warningMessage = ''

      if (vatEnabled && !canAccessVAT) {
        finalVatEnabled = false
        warningMessage = 'VAT features require Pro plan'
      }

      if (cisEnabled && !canAccessCIS) {
        finalCisEnabled = false
        warningMessage = warningMessage
          ? warningMessage + '. CIS features require Trade plan'
          : 'CIS features require Trade plan'
      }

      // Enforce branding access - only save branding if user has access
      // (Migration safety: existing free users keep their data, just can't update)
      let finalLogoUrl = invoiceLogoUrl
      let finalCompanyName = invoiceCompanyName

      if (!canAccessBranding) {
        // Free users: Don't save new branding values, keep existing
        console.log('[Settings] branding_save_attempt_blocked: free user cannot save branding')
        // We don't clear the local state - they can see their existing config
        // But we won't save changes. Fetch existing values to preserve them.
        const { data: existingPrefs } = await (supabase
          .from('user_preferences') as any)
          .select('invoice_logo_url, invoice_company_name')
          .eq('user_id', user.id)
          .single()

        finalLogoUrl = existingPrefs?.invoice_logo_url ?? null
        finalCompanyName = existingPrefs?.invoice_company_name ?? null

        if (invoiceLogoUrl !== finalLogoUrl || invoiceCompanyName !== (finalCompanyName || '')) {
          warningMessage = warningMessage
            ? warningMessage + '. Invoice branding requires Pro plan'
            : 'Invoice branding requires Pro plan'
        }
      }

      const preferences: UserPreferences = {
        default_labour_rate: parseFloat(labourRate),
        default_vat_enabled: finalVatEnabled,
        default_cis_enabled: finalCisEnabled,
        bank_account_name: bankAccountName || null,
        bank_sort_code: bankSortCode || null,
        bank_account_number: bankAccountNumber || null,
        payment_reference: paymentReference || null,
        invoice_logo_url: finalLogoUrl,
        invoice_company_name: finalCompanyName || null,
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

      // Update local state to match enforced values
      setVatEnabled(finalVatEnabled)
      setCisEnabled(finalCisEnabled)

      if (warningMessage) {
        setError(warningMessage)
        setTimeout(() => setError(null), 4000)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestorePurchases = async () => {
    if (!user) return

    setIsRestoring(true)
    setError(null)
    setSuccess(false)

    try {
      // 1. Restore via RevenueCat
      console.log('[Settings] Starting restore purchases...')
      const result = await restorePurchases()

      if (!result.success) {
        if (result.userCancelled) {
          // User cancelled - don't show error
          return
        }
        // Better messaging for no purchases
        if (result.error?.includes('No purchases') || result.error?.includes('not found')) {
          throw new Error('No subscription found on this Apple ID. If you purchased on a different Apple ID, sign in with that account and try again.')
        }
        throw new Error(result.error || 'Failed to restore purchases')
      }

      console.log('[Settings] Restore successful, syncing to Supabase...')

      // 2. Sync to Supabase using canonical function
      // This links RC user and syncs subscription data
      const syncResult = await syncRevenueCatToSupabase(user.id)

      if (!syncResult.success) {
        console.error('[Settings] Sync failed:', syncResult.error)
        throw new Error('Restore succeeded but sync failed. Please contact support.')
      }

      console.log('[Settings] Sync successful:', syncResult)

      // 3. Refresh plan and subscription state
      setSuccess(true)
      setTimeout(async () => {
        setSuccess(false)
        await loadUserAndPreferences()
      }, 2000)
    } catch (err: any) {
      console.error('Restore error:', err)
      setError(err.message || 'Failed to restore purchases')
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsRestoring(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Clear previous errors
    setLogoError(null)

    // Client-side paywall check (prevents unnecessary API calls)
    if (!canAccessBranding) {
      setLogoError(BRANDING_PAYWALL_ERROR)
      e.target.value = ''
      return
    }

    // Validate file first
    const validation = validateLogoFile(file)
    if (!validation.valid) {
      setLogoError(validation.error || 'Invalid file')
      return
    }

    setIsUploadingLogo(true)

    try {
      const result = await uploadLogo(file, user.id)

      if (!result.success) {
        setLogoError(result.error || 'Upload failed')
        return
      }

      // Update state with new URL
      setInvoiceLogoUrl(result.url || null)

      // Save to database immediately
      await (supabase
        .from('user_preferences') as any)
        .upsert({
          user_id: user.id,
          invoice_logo_url: result.url,
        }, {
          onConflict: 'user_id'
        })

      console.log('[Settings] branding_rendered_paid_user: logo uploaded')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      console.error('Logo upload error:', err)
      setLogoError('Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      // Reset the input
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    if (!user) return

    setIsUploadingLogo(true)
    setLogoError(null)

    try {
      // Delete from storage
      const result = await deleteLogo(user.id)

      if (!result.success) {
        setLogoError(result.error || 'Failed to remove logo')
        return
      }

      // Update state
      setInvoiceLogoUrl(null)

      // Update database
      await (supabase
        .from('user_preferences') as any)
        .upsert({
          user_id: user.id,
          invoice_logo_url: null,
        }, {
          onConflict: 'user_id'
        })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      console.error('Logo remove error:', err)
      setLogoError('Failed to remove logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    setIsDeleting(true)
    setError(null)
    setShowDeleteConfirm(false)

    try {
      // Call delete-account edge function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      // Account deleted successfully - sign out and redirect
      await supabase.auth.signOut()
      router.push('/login?deleted=true')
    } catch (err: any) {
      console.error('Delete account error:', err)
      setError(err.message || 'Failed to delete account. Please try again or contact support.')
      setIsDeleting(false)
    }
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
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-yapmate-black border-2 border-yapmate-status-red max-w-md w-full p-6">
            <h2 className="text-yapmate-white text-lg font-mono font-bold uppercase mb-4">
              Confirm Account Deletion
            </h2>
            <p className="text-yapmate-slate-300 text-sm font-mono mb-6">
              Are you absolutely sure? This will permanently delete your account and all data. This action cannot be undone.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full h-12 border-2 border-yapmate-status-red bg-yapmate-status-red text-yapmate-black font-mono font-bold uppercase tracking-wide transition-colors duration-snap active:bg-transparent active:text-yapmate-status-red disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="w-full h-12 border-2 border-yapmate-slate-700 text-yapmate-white font-mono font-bold uppercase tracking-wide bg-transparent transition-colors duration-snap active:bg-yapmate-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

          {/* Invoice Branding */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-yapmate-white text-sm font-mono uppercase tracking-wide">
                Invoice Branding
              </h2>
              {!canAccessBranding && (
                <span className="text-xs font-mono uppercase px-2 py-1 border border-yapmate-amber text-yapmate-amber">
                  Pro Feature
                </span>
              )}
            </div>

            {/* Paywall Banner for Free Users */}
            {!canAccessBranding && (
              <div className="mb-4 p-4 border-2 border-yapmate-amber/50 bg-yapmate-amber/5">
                <p className="text-yapmate-amber text-sm font-mono mb-3">
                  Upgrade to Pro to add your logo and company name to invoices
                </p>
                <button
                  onClick={() => router.push('/pricing')}
                  className="w-full h-10 border-2 border-yapmate-amber text-yapmate-amber font-mono font-bold uppercase tracking-wide bg-transparent transition-colors duration-snap active:bg-yapmate-amber active:text-yapmate-black"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

            <p className="text-xs text-yapmate-slate-400 font-mono mb-4">
              Add your logo or company name to appear on invoice PDFs
            </p>

            {/* Logo Upload - Locked for free users */}
            <div className={`mb-4 ${!canAccessBranding ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
                Company Logo
              </label>

              {invoiceLogoUrl ? (
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 border-2 border-yapmate-slate-700 overflow-hidden flex items-center justify-center bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={invoiceLogoUrl}
                      alt="Company logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={handleLogoRemove}
                      disabled={isUploadingLogo || !canAccessBranding}
                      className="text-yapmate-status-red text-xs font-mono uppercase hover:underline disabled:opacity-50"
                    >
                      {isUploadingLogo ? 'Removing...' : 'Remove Logo'}
                    </button>
                    <p className="text-xs text-yapmate-slate-400 font-mono mt-1">
                      {canAccessBranding ? 'Logo will appear on invoice header' : 'Upgrade to edit'}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={`block ${!canAccessBranding ? 'cursor-not-allowed' : ''}`}>
                    <div className={`w-full px-4 py-4 border-2 border-dashed border-yapmate-slate-700 text-center ${canAccessBranding ? 'cursor-pointer hover:border-yapmate-amber' : 'cursor-not-allowed'} transition-colors duration-snap`}>
                      <span className="text-yapmate-slate-300 text-sm font-mono">
                        {isUploadingLogo ? 'Uploading...' : canAccessBranding ? 'Tap to upload logo' : 'Locked - Upgrade to Pro'}
                      </span>
                      <p className="text-xs text-yapmate-slate-500 font-mono mt-1">
                        PNG, JPG or WebP (max 2MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo || !canAccessBranding}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {logoError && (
                <p className="text-xs text-yapmate-status-red font-mono mt-2">
                  {logoError}
                </p>
              )}
            </div>

            {/* Company Name - Locked for free users */}
            <div className={!canAccessBranding ? 'opacity-50' : ''}>
              <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
                Company/Trading Name
              </label>
              <input
                type="text"
                value={invoiceCompanyName}
                onChange={(e) => setInvoiceCompanyName(e.target.value)}
                disabled={!canAccessBranding}
                className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white font-mono focus:outline-none focus:border-yapmate-amber transition-colors duration-snap disabled:cursor-not-allowed"
                placeholder={canAccessBranding ? 'Your Business Name' : 'Upgrade to Pro to add'}
              />
              <p className="text-xs text-yapmate-slate-400 font-mono mt-1">
                {canAccessBranding
                  ? (invoiceLogoUrl ? 'Shown alongside your logo' : 'Shown as header if no logo uploaded')
                  : 'Upgrade to Pro to customize'}
              </p>
            </div>
          </div>

          {/* Default VAT */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <label className={`flex items-center justify-between ${canAccessVAT ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <span className="text-yapmate-white text-xs font-mono uppercase tracking-wide">
                Default VAT Enabled
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                  disabled={!canAccessVAT}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 border-2 border-yapmate-slate-700 peer-focus:border-yapmate-amber peer-checked:bg-yapmate-amber peer-checked:border-yapmate-amber peer-disabled:opacity-50 transition-colors duration-snap"></div>
                <div className="absolute left-1 top-1 w-6 h-6 bg-yapmate-white peer-checked:translate-x-6 transition-transform duration-snap"></div>
              </div>
            </label>
            <p className="text-xs text-yapmate-slate-300 mt-2 font-mono">
              {canAccessVAT
                ? `New invoices start with VAT ${vatEnabled ? 'ON' : 'OFF'}`
                : 'Pro plan required'}
            </p>
          </div>

          {/* Default CIS - Only shown when Trade tier enabled */}
          {isTradeEnabled() && (
          <div className="border-b border-yapmate-slate-700 pb-6">
            <label className={`flex items-center justify-between ${canAccessCIS ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <span className="text-yapmate-white text-xs font-mono uppercase tracking-wide">
                Default CIS Enabled
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={cisEnabled}
                  onChange={(e) => setCisEnabled(e.target.checked)}
                  disabled={!canAccessCIS}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 border-2 border-yapmate-slate-700 peer-focus:border-yapmate-amber peer-checked:bg-yapmate-amber peer-checked:border-yapmate-amber peer-disabled:opacity-50 transition-colors duration-snap"></div>
                <div className="absolute left-1 top-1 w-6 h-6 bg-yapmate-white peer-checked:translate-x-6 transition-transform duration-snap"></div>
              </div>
            </label>
            <p className="text-xs text-yapmate-slate-300 mt-2 font-mono">
              {canAccessCIS
                ? `New invoices start with CIS ${cisEnabled ? 'ON' : 'OFF'}`
                : 'Trade plan required'}
            </p>
          </div>
          )}

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

          {/* Subscription Management (iOS Only) */}
          {isIOS() && (
            <div className="border-b border-yapmate-slate-700 pb-6">
              <h2 className="text-yapmate-white text-sm font-mono uppercase tracking-wide mb-4">
                Subscription Management
              </h2>

              {/* Current Subscription Status */}
              <div className="mb-4 p-4 bg-yapmate-slate-900 border border-yapmate-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono uppercase text-yapmate-slate-300">
                    Current Plan
                  </span>
                  <span className="text-sm font-mono font-bold text-yapmate-white uppercase">
                    {userPlan === 'trade' && !isTradeEnabled() ? 'Pro' : userPlan}
                  </span>
                </div>

                {subscriptionStatus && subscriptionStatus !== 'expired' && (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono uppercase text-yapmate-slate-300">
                        Status
                      </span>
                      <span className={`text-sm font-mono font-bold uppercase ${
                        subscriptionStatus === 'active' ? 'text-yapmate-status-green' :
                        subscriptionStatus === 'trialing' ? 'text-yapmate-amber' :
                        'text-yapmate-slate-400'
                      }`}>
                        {subscriptionStatus === 'trialing' ? 'Free Trial' : subscriptionStatus}
                      </span>
                    </div>

                    {subscriptionExpiry && (
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono uppercase text-yapmate-slate-300">
                          {willRenew ? 'Renews' : 'Expires'}
                        </span>
                        <span className="text-sm font-mono text-yapmate-white">
                          {new Date(subscriptionExpiry).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {(!subscriptionStatus || subscriptionStatus === 'expired') && userPlan === 'free' && (
                  <p className="text-xs font-mono text-yapmate-slate-400 mt-1">
                    No active subscription
                  </p>
                )}
              </div>

              {/* Restore Purchases Button */}
              <button
                onClick={handleRestorePurchases}
                disabled={isRestoring}
                className="w-full h-12 border-2 border-yapmate-amber text-yapmate-amber font-mono font-bold uppercase tracking-wide bg-transparent transition-colors duration-snap active:bg-yapmate-amber active:text-yapmate-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoring ? 'Restoring...' : 'Restore Purchases'}
              </button>
              <p className="text-xs text-yapmate-slate-400 font-mono mt-2">
                Restore your subscription from a previous purchase
              </p>
            </div>
          )}

          {/* Account Deletion */}
          <div className="border-b border-yapmate-slate-700 pb-6">
            <h2 className="text-yapmate-white text-sm font-mono uppercase tracking-wide mb-4">
              Delete Account
            </h2>
            <p className="text-xs text-yapmate-slate-400 font-mono mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <p className="text-xs text-yapmate-slate-400 font-mono mb-4">
              This will delete:
            </p>
            <ul className="text-xs text-yapmate-slate-400 font-mono mb-4 ml-4 space-y-1">
              <li>• All invoices and customer records</li>
              <li>• Your subscription and payment history</li>
              <li>• All preferences and settings</li>
              <li>• Your account permanently</li>
            </ul>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="w-full h-12 border-2 border-yapmate-status-red text-yapmate-status-red font-mono font-bold uppercase tracking-wide bg-transparent transition-colors duration-snap active:bg-yapmate-status-red active:text-yapmate-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>

          {/* Logout */}
          <div className="pt-4">
            <button
              onClick={handleLogout}
              className="w-full h-12 border-2 border-yapmate-slate-700 text-yapmate-slate-300 font-mono font-bold uppercase tracking-wide bg-transparent transition-colors duration-snap active:bg-yapmate-slate-700 active:text-yapmate-white"
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
