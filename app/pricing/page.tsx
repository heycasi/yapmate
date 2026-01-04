'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { getUserPlan, getPlanDisplayName, type PricingPlan } from '@/lib/plan-access'
import {
  isIAPAvailable,
  purchaseProduct,
  getOfferings,
  IAP_PRODUCTS,
  type IAPOffering
} from '@/lib/iap'
import { syncSubscription } from '@/lib/iap-sync'
import {
  isIOS,
  isWeb,
  isBillingEnabled,
  getBillingNotConfiguredMessage
} from '@/lib/runtime-config'

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false)
  const [offerings, setOfferings] = useState<IAPOffering[]>([])
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)

  useEffect(() => {
    checkUserPlan()
    if (isIAPAvailable()) {
      loadOfferings()
    }
  }, [])

  const checkUserPlan = async () => {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      setIsLoggedIn(true)
      const plan = await getUserPlan(session.user.id)
      setCurrentPlan(plan)
    }
  }

  const loadOfferings = async () => {
    setIsLoadingOfferings(true)
    try {
      const loadedOfferings = await getOfferings()
      setOfferings(loadedOfferings)
      console.log('[Pricing] Loaded offerings:', loadedOfferings.length)
    } catch (error) {
      console.error('[Pricing] Failed to load offerings:', error)
    } finally {
      setIsLoadingOfferings(false)
    }
  }

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const handleUpgrade = async (plan: 'pro' | 'trade') => {
    // Clear previous states
    setPurchaseError(null)
    setPurchaseSuccess(false)

    // Web: Always show waitlist
    if (isWeb()) {
      setShowUpgradeMessage(true)
      setTimeout(() => setShowUpgradeMessage(false), 5000)
      return
    }

    // iOS: Check if billing is enabled
    if (!isBillingEnabled()) {
      setPurchaseError(getBillingNotConfiguredMessage())
      setTimeout(() => setPurchaseError(null), 5000)
      return
    }

    // iOS: Check if IAP is available
    if (!isIAPAvailable()) {
      setPurchaseError('In-app purchases not available. Please try again.')
      setTimeout(() => setPurchaseError(null), 5000)
      return
    }

    // iOS: check if logged in first
    if (!isLoggedIn) {
      setPurchaseError('Please log in to purchase a subscription')
      setTimeout(() => setPurchaseError(null), 5000)
      return
    }

    setIsPurchasing(true)

    try {
      // Purchase via RevenueCat
      const productId = plan === 'pro' ? IAP_PRODUCTS.PRO_MONTHLY : IAP_PRODUCTS.TRADE_MONTHLY

      console.log('[Pricing] Starting purchase:', productId)
      const result = await purchaseProduct(productId)

      if (!result.success) {
        // Don't show error if user cancelled
        if (!result.userCancelled) {
          setPurchaseError(result.error || 'Purchase failed')
          setTimeout(() => setPurchaseError(null), 5000)
        }
        return
      }

      console.log('[Pricing] Purchase successful, syncing to Supabase...')

      // Sync to Supabase
      if (result.customerInfo) {
        const syncResult = await syncSubscription(result.customerInfo)

        if (syncResult.success) {
          setPurchaseSuccess(true)

          // Reload user plan after successful sync
          await checkUserPlan()

          setTimeout(() => {
            setPurchaseSuccess(false)
          }, 3000)
        } else {
          setPurchaseError('Purchase succeeded but sync failed. Please contact support.')
          setTimeout(() => setPurchaseError(null), 5000)
        }
      }
    } catch (error: any) {
      console.error('[Pricing] Purchase error:', error)
      setPurchaseError(error.message || 'Purchase failed')
      setTimeout(() => setPurchaseError(null), 5000)
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
    <main className="min-h-screen bg-yapmate-black text-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="px-6 py-2 border border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-semibold rounded transition-all uppercase tracking-wide text-sm"
          >
            ← Home
          </Link>
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-yapmate-gray-dark text-white border border-gray-800 hover:border-yapmate-yellow/50 font-medium rounded transition-all uppercase tracking-wide text-sm"
            >
              Dashboard
            </Link>
          )}
        </div>
      </nav>

      {/* Header */}
      <section className="px-6 py-16 md:py-20 max-w-4xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Pricing
        </h1>
        <p className="text-xl md:text-2xl text-yapmate-gray-lightest max-w-2xl mx-auto">
          Simple plans for UK trades. Start free. Upgrade when it saves you time.
        </p>
        {isIOS() && (
          <p className="text-sm text-yapmate-gray-light mt-4">
            7-day free trial included with Pro & Trade plans
          </p>
        )}
      </section>

      {/* Purchase Success */}
      {purchaseSuccess && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-yapmate-gray-dark border-2 border-yapmate-status-green rounded-xl p-6 text-center">
            <p className="text-yapmate-status-green font-semibold mb-2 uppercase tracking-wide">
              Subscription Active
            </p>
            <p className="text-yapmate-gray-lightest text-sm">
              Your plan has been updated. Enjoy your new features!
            </p>
          </div>
        </div>
      )}

      {/* Purchase Error */}
      {purchaseError && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-yapmate-gray-dark border-2 border-yapmate-status-red rounded-xl p-6 text-center">
            <p className="text-yapmate-status-red font-semibold mb-2 uppercase tracking-wide">
              Purchase Failed
            </p>
            <p className="text-yapmate-gray-lightest text-sm">
              {purchaseError}
            </p>
          </div>
        </div>
      )}

      {/* Upgrade Message (Web Only) */}
      {showUpgradeMessage && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-yapmate-gray-dark border border-yapmate-yellow rounded-xl p-6 text-center">
            <p className="text-white font-semibold mb-2">
              Paid plans launch soon.
            </p>
            <p className="text-yapmate-gray-lightest text-sm mb-4">
              Join early access to get priority when subscriptions go live.
            </p>
            <Link
              href="/waitlist"
              className="inline-block px-6 py-2 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button uppercase tracking-wide text-sm"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      )}

      {/* Current Plan Display */}
      {isLoggedIn && currentPlan && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-4 text-center">
            <span className="text-yapmate-gray-light text-sm uppercase tracking-wide mr-2">Current Plan:</span>
            <span className="text-yapmate-yellow font-bold uppercase tracking-wide">
              {getPlanDisplayName(currentPlan)}
            </span>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {/* FREE Plan */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 flex flex-col">
            <h2 className="text-2xl font-bold mb-2 text-white uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Free
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£0</span>
              <span className="text-yapmate-gray-lightest text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest"><strong>3 invoices total</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Voice to invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">PDF download</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Yapmate branding</span>
              </li>
              <li className="flex items-start text-yapmate-gray-light">
                <span className="mr-3 text-lg">✗</span>
                <span>No VAT, Reverse Charge, or CIS</span>
              </li>
            </ul>

            {currentPlan === 'free' ? (
              <div className="w-full px-8 py-4 border border-gray-800 text-yapmate-gray-light font-semibold rounded-lg text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : isLoggedIn ? (
              <Link
                href="/dashboard"
                className="w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm"
              >
                Start Free
              </Link>
            )}
          </div>

          {/* PRO Plan - Most Popular */}
          <div className="bg-yapmate-gray-dark border-2 border-yapmate-yellow rounded-xl p-8 flex flex-col relative">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-yapmate-yellow text-yapmate-black px-4 py-1 text-xs font-bold uppercase tracking-wide rounded">
                Recommended
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-2 text-yapmate-yellow uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Pro
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono text-white">£15</span>
              <span className="text-yapmate-gray-lightest text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest"><strong>Unlimited invoices</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Voice to invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">VAT + Reverse Charge</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Customer list</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Clean PDFs</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-gray-light mr-3 text-lg">•</span>
                <span className="text-yapmate-gray-light text-xs">For sole traders</span>
              </li>
            </ul>

            {currentPlan === 'pro' ? (
              <div className="w-full px-8 py-4 bg-yapmate-gray-dark border border-gray-800 text-yapmate-gray-light font-semibold rounded-lg text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : isLoggedIn ? (
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={isPurchasing || isLoadingOfferings}
                className="w-full px-8 py-4 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button text-center uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : isWeb() ? 'Join Waitlist' : 'Start Free Trial'}
              </button>
            ) : (
              <Link
                href="/signup"
                className="w-full px-8 py-4 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button text-center uppercase tracking-wide text-sm"
              >
                Sign Up to Upgrade
              </Link>
            )}
          </div>

          {/* TRADE Plan */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 flex flex-col">
            <h2 className="text-2xl font-bold mb-2 text-white uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Trade
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£25</span>
              <span className="text-yapmate-gray-lightest text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest"><strong>Everything in Pro</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">CIS deduction</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Bank details on invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Priority support</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-gray-light mr-3 text-lg">•</span>
                <span className="text-yapmate-gray-light text-xs">For CIS contractors</span>
              </li>
            </ul>

            {currentPlan === 'trade' ? (
              <div className="w-full px-8 py-4 border border-gray-800 text-yapmate-gray-light font-semibold rounded-lg text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : isLoggedIn ? (
              <button
                onClick={() => handleUpgrade('trade')}
                disabled={isPurchasing || isLoadingOfferings}
                className="w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : isWeb() ? 'Join Waitlist' : 'Start Free Trial'}
              </button>
            ) : (
              <Link
                href="/signup"
                className="w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm"
              >
                Sign Up to Upgrade
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {/* FAQ Item 1 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleFaq(0)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-800/30 transition-colors"
            >
              <span className="font-semibold">Can I try before I buy?</span>
              <span className="text-yapmate-yellow text-xl">{openFaq === 0 ? '−' : '+'}</span>
            </button>
            {openFaq === 0 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest text-sm leading-relaxed">
                Yes. All paid plans include a 7-day free trial on iOS. Cancel anytime during the trial period at no cost.
              </div>
            )}
          </div>

          {/* FAQ Item 2 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleFaq(1)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-800/30 transition-colors"
            >
              <span className="font-semibold">What happens after my free trial?</span>
              <span className="text-yapmate-yellow text-xl">{openFaq === 1 ? '−' : '+'}</span>
            </button>
            {openFaq === 1 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest text-sm leading-relaxed">
                After 7 days, you&apos;ll be charged the monthly rate unless you cancel. You can cancel anytime via your iOS subscription settings.
              </div>
            )}
          </div>

          {/* FAQ Item 3 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleFaq(2)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-800/30 transition-colors"
            >
              <span className="font-semibold">Can I upgrade or downgrade later?</span>
              <span className="text-yapmate-yellow text-xl">{openFaq === 2 ? '−' : '+'}</span>
            </button>
            {openFaq === 2 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest text-sm leading-relaxed">
                Yes. You can change plans anytime via your subscription settings. Changes take effect immediately.
              </div>
            )}
          </div>

          {/* FAQ Item 4 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleFaq(3)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-800/30 transition-colors"
            >
              <span className="font-semibold">How do I cancel my subscription?</span>
              <span className="text-yapmate-yellow text-xl">{openFaq === 3 ? '−' : '+'}</span>
            </button>
            {openFaq === 3 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest text-sm leading-relaxed">
                On iOS: Settings → Apple ID → Subscriptions → YapMate → Cancel. You&apos;ll retain access until the end of your billing period.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
