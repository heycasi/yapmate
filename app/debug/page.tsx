'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { getUserPlan } from '@/lib/plan-access'
import {
  hasSupabaseConfig,
  hasRevenueCatKey,
  isIOS,
  isWeb,
  isBillingEnabled
} from '@/lib/runtime-config'
import { isIAPAvailable, getCustomerInfo } from '@/lib/iap'

interface DebugInfo {
  platform: string
  supabaseConfigured: boolean
  revenueCatKeyPresent: boolean
  iapAvailable: boolean
  billingEnabled: boolean
  userId: string | null
  userEmail: string | null
  currentPlan: string | null
  lastSubscription: {
    provider: string | null
    status: string | null
    currentPeriodEnd: string | null
  } | null
}

function DebugContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const debugParam = searchParams.get('debug')
    if (debugParam !== '1') {
      router.push('/dashboard')
      return
    }

    loadDebugInfo()
  }, [searchParams, router])

  const loadDebugInfo = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()

      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      let currentPlan: string | null = null
      let lastSub = null

      if (session?.user) {
        // Get user plan
        currentPlan = await getUserPlan(session.user.id)

        // Get last subscription record
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('provider, status, current_period_end')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (subData) {
          lastSub = {
            provider: (subData as any).provider,
            status: (subData as any).status,
            currentPeriodEnd: (subData as any).current_period_end
          }
        }
      }

      const info: DebugInfo = {
        platform: isIOS() ? 'iOS' : isWeb() ? 'Web' : 'Unknown',
        supabaseConfigured: hasSupabaseConfig(),
        revenueCatKeyPresent: hasRevenueCatKey(),
        iapAvailable: isIOS() && isIAPAvailable(),
        billingEnabled: isBillingEnabled(),
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
        currentPlan: currentPlan,
        lastSubscription: lastSub
      }

      setDebugInfo(info)
    } catch (err: any) {
      console.error('[Debug] Error loading info:', err)
      setError(err.message || 'Failed to load debug info')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-yapmate-black text-white flex items-center justify-center">
        <div className="text-yapmate-gray-light font-mono">Loading debug info...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-yapmate-black text-white flex items-center justify-center">
        <div className="text-yapmate-status-red font-mono">Error: {error}</div>
      </main>
    )
  }

  if (!debugInfo) {
    return null
  }

  const InfoRow = ({ label, value, status }: { label: string; value: string; status?: 'ok' | 'warn' | 'error' }) => {
    const valueColor = status === 'ok' ? 'text-yapmate-status-green' :
                      status === 'warn' ? 'text-yapmate-amber' :
                      status === 'error' ? 'text-yapmate-status-red' :
                      'text-yapmate-gray-lightest'

    return (
      <div className="flex justify-between items-start py-2 border-b border-yapmate-slate-700">
        <span className="text-sm font-mono text-yapmate-gray-light uppercase">{label}</span>
        <span className={`text-sm font-mono font-bold ${valueColor}`}>{value}</span>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-yapmate-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            🛠️ Debug Diagnostics
          </h1>
          <p className="text-sm text-yapmate-gray-light font-mono">
            Internal diagnostics view - not for production use
          </p>
        </div>

        {/* Platform Info */}
        <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Platform
          </h2>
          <InfoRow label="Platform" value={debugInfo.platform} />
          <InfoRow
            label="Supabase Config"
            value={debugInfo.supabaseConfigured ? 'OK' : 'Missing'}
            status={debugInfo.supabaseConfigured ? 'ok' : 'error'}
          />
          <InfoRow
            label="RevenueCat Key"
            value={debugInfo.revenueCatKeyPresent ? 'Present' : 'Missing'}
            status={debugInfo.revenueCatKeyPresent ? 'ok' : 'warn'}
          />
          <InfoRow
            label="IAP Available"
            value={debugInfo.iapAvailable ? 'Yes' : 'No'}
            status={debugInfo.iapAvailable ? 'ok' : undefined}
          />
          <InfoRow
            label="Billing Enabled"
            value={debugInfo.billingEnabled ? 'Yes' : 'No'}
            status={debugInfo.billingEnabled ? 'ok' : 'warn'}
          />
        </div>

        {/* User Info */}
        <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            User
          </h2>
          <InfoRow label="User ID" value={debugInfo.userId || 'Not logged in'} />
          <InfoRow label="Email" value={debugInfo.userEmail || 'N/A'} />
          <InfoRow
            label="Current Plan"
            value={debugInfo.currentPlan?.toUpperCase() || 'N/A'}
            status={debugInfo.currentPlan === 'free' ? undefined : 'ok'}
          />
        </div>

        {/* Subscription Info */}
        <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Last Subscription
          </h2>
          {debugInfo.lastSubscription ? (
            <>
              <InfoRow
                label="Provider"
                value={debugInfo.lastSubscription.provider?.toUpperCase() || 'N/A'}
              />
              <InfoRow
                label="Status"
                value={debugInfo.lastSubscription.status?.toUpperCase() || 'N/A'}
                status={debugInfo.lastSubscription.status === 'active' ? 'ok' : undefined}
              />
              <InfoRow
                label="Period End"
                value={debugInfo.lastSubscription.currentPeriodEnd
                  ? new Date(debugInfo.lastSubscription.currentPeriodEnd).toLocaleDateString('en-GB')
                  : 'N/A'
                }
              />
            </>
          ) : (
            <p className="text-sm font-mono text-yapmate-gray-light">No subscription found</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 px-6 py-3 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all uppercase tracking-wide text-sm"
          >
            Back to Dashboard
          </button>
          <button
            onClick={loadDebugInfo}
            className="flex-1 px-6 py-3 bg-yapmate-gray-dark border border-gray-800 hover:border-yapmate-yellow/50 text-white font-medium rounded-lg transition-all uppercase tracking-wide text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  )
}

export default function DebugPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-yapmate-black text-white flex items-center justify-center">
          <div className="text-yapmate-gray-light font-mono">Loading debug info...</div>
        </main>
      }
    >
      <DebugContent />
    </Suspense>
  )
}
