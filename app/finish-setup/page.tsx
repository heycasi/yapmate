'use client'

/**
 * Post-purchase onboarding page (Guideline 5.1.1 compliance)
 *
 * Shown to users who purchased a subscription without creating an account.
 * Prompts them to create an account to save invoices and sync across devices.
 */

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCustomerInfo, getSubscriptionStatus } from '@/lib/iap'

function FinishSetupContent() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'pro'
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    setIsLoading(true)
    try {
      const customerInfo = await getCustomerInfo()

      if (customerInfo) {
        const status = getSubscriptionStatus(customerInfo)
        setSubscriptionPlan(status.plan)
        console.log('[FinishSetup] Subscription verified:', status.plan)
      } else {
        console.warn('[FinishSetup] No customer info found')
      }
    } catch (error) {
      console.error('[FinishSetup] Failed to check subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-yapmate-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-block w-20 h-20 bg-yapmate-yellow rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-yapmate-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1
            className="text-4xl font-bold mb-3 uppercase tracking-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Trial Started
          </h1>
          <p className="text-yapmate-gray-lightest text-lg">
            Your {subscriptionPlan || plan} plan is active. You can start creating invoices right
            away.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 mb-8">
          <h2
            className="text-xl font-bold mb-4 text-white uppercase tracking-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Finish your setup
          </h2>
          <p className="text-yapmate-gray-lightest text-sm leading-relaxed mb-6">
            Create an account to save your invoices to the cloud and access them on any device. Your
            subscription is already active and will transfer to your account.
          </p>

          <div className="space-y-3 text-sm">
            <div className="flex items-start">
              <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
              <span className="text-yapmate-gray-lightest">
                Save invoices across all your devices
              </span>
            </div>
            <div className="flex items-start">
              <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
              <span className="text-yapmate-gray-lightest">
                Automatic cloud backup of all your work
              </span>
            </div>
            <div className="flex items-start">
              <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
              <span className="text-yapmate-gray-lightest">Keep your customer list synced</span>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-4">
          <Link
            href="/signup"
            className="block w-full px-8 py-4 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button text-center uppercase tracking-wide text-sm"
          >
            Create Account
          </Link>

          <Link
            href="/login"
            className="block w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm"
          >
            Log In
          </Link>

          <Link
            href="/record"
            className="block w-full px-8 py-4 bg-yapmate-gray-dark border border-gray-800 text-yapmate-gray-lightest hover:border-yapmate-yellow/50 font-medium rounded-lg transition-all text-center uppercase tracking-wide text-sm"
          >
            Not Now - Start Using
          </Link>
        </div>

        {/* Footer Note */}
        <p className="text-yapmate-gray-light text-xs text-center mt-8">
          You can create your account anytime. Your subscription and purchases are safe.
        </p>
      </div>
    </main>
  )
}

export default function FinishSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-yapmate-black text-white flex items-center justify-center">
          <div className="text-yapmate-gray-lightest">Loading...</div>
        </main>
      }
    >
      <FinishSetupContent />
    </Suspense>
  )
}
