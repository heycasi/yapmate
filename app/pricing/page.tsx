'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppStoreBadge from '@/components/AppStoreBadge'
import Footer from '@/components/Footer'
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
  getBillingNotConfiguredMessage,
  isTradeEnabled
} from '@/lib/runtime-config'

export default function PricingPage() {
  // Feature Flags
  // App Review Mode: When enabled, Trade plan is always shown as purchasable
  // This allows Apple App Review to test the purchase flow even if Trade IAP is pending approval
  const isAppReviewMode = process.env.NEXT_PUBLIC_APP_REVIEW_MODE === 'true'

  // Trade Tier: Disabled for v1.0 App Store submission (ships with Free + Pro only)
  // Set NEXT_PUBLIC_ENABLE_TRADE_TIER=true to re-enable
  const tradeEnabled = isTradeEnabled()

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false)
  const [offerings, setOfferings] = useState<IAPOffering[]>([])
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [isTradeAvailable, setIsTradeAvailable] = useState(false)

  useEffect(() => {
    checkUserPlan()
    if (isIAPAvailable()) {
      loadOfferings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      console.log('[Pricing] App Review Mode:', isAppReviewMode)
      console.log('[Pricing] Trade Tier Enabled:', tradeEnabled)

      // Check if Trade product is available (only if Trade tier is enabled)
      // Trade disabled for v1.0 - ships with Free + Pro only
      if (tradeEnabled) {
        let tradeFound = false
        loadedOfferings.forEach((offering) => {
          offering.availablePackages.forEach((pkg) => {
            if (pkg.product.identifier === IAP_PRODUCTS.TRADE_MONTHLY) {
              tradeFound = true
            }
          })
        })
        setIsTradeAvailable(tradeFound)
        console.log('[Pricing] Trade plan available:', tradeFound)
        console.log('[Pricing] Trade plan will show as purchasable:', tradeFound || isAppReviewMode)
      } else {
        setIsTradeAvailable(false)
        console.log('[Pricing] Trade tier disabled via feature flag')
      }

      // Debug: Log all offerings and their packages
      loadedOfferings.forEach((offering, idx) => {
        console.log(`[Pricing] Offering ${idx + 1}:`, offering.identifier)
        console.log(`  - Packages: ${offering.availablePackages.length}`)
        offering.availablePackages.forEach((pkg) => {
          console.log(`    • ${pkg.identifier} → ${pkg.product.identifier}`)
        })
      })

      if (loadedOfferings.length === 0) {
        console.warn('[Pricing] ⚠️ No offerings available from RevenueCat')
      }
    } catch (error) {
      console.error('[Pricing] Failed to load offerings:', error)
    } finally {
      setIsLoadingOfferings(false)
    }
  }

  // Computed: Trade should be shown as purchasable if:
  // 1. Trade tier feature flag is enabled, AND
  // 2. (It's actually available in RevenueCat offerings OR App Review Mode is enabled)
  const shouldShowTradeAsPurchasable = tradeEnabled && (isAppReviewMode || isTradeAvailable)

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

    // [GUIDELINE 5.1.1] Allow purchases without login
    // User will be prompted to create account after purchase
    console.log('[Pricing] Starting purchase flow (logged in:', isLoggedIn, ')')
    console.log('[Pricing] Current offerings state:', offerings.length, 'offerings')

    // CRITICAL FIX: Wait for offerings to load before allowing purchase
    if (isLoadingOfferings) {
      console.warn('[Pricing] ⚠️ Offerings still loading, waiting...')
      setPurchaseError('Loading subscription options, please wait...')
      setTimeout(() => setPurchaseError(null), 3000)
      return
    }

    // CRITICAL FIX: If no offerings loaded, try to reload them
    // In App Review mode, allow purchase to proceed (will fail gracefully if product not found)
    if (offerings.length === 0 && !isAppReviewMode) {
      console.warn('[Pricing] ⚠️ No offerings available, reloading...')
      setPurchaseError('Loading subscription options, please try again...')

      // Retry loading offerings
      await loadOfferings()

      setTimeout(() => setPurchaseError(null), 3000)
      return
    }

    // App Review Mode: Log that we're proceeding even without offerings
    if (isAppReviewMode && offerings.length === 0) {
      console.log('[Pricing] ⚠️ App Review Mode: Proceeding with purchase despite no offerings')
      console.log('[Pricing] Purchase will be attempted, may fail gracefully if product not found')
    }

    // Debug: Log offerings and packages before purchase
    console.log('[Pricing] Available packages:')
    offerings.forEach((offering) => {
      offering.availablePackages.forEach((pkg) => {
        console.log(`  - ${pkg.identifier}: ${pkg.product.identifier} (${pkg.product.priceString})`)
      })
    })

    setIsPurchasing(true)

    try {
      // Purchase via RevenueCat
      const productId = plan === 'pro' ? IAP_PRODUCTS.PRO_MONTHLY : IAP_PRODUCTS.TRADE_MONTHLY

      console.log('[Pricing] Attempting purchase:', productId)
      console.log('[Pricing] Expected product:', plan === 'pro' ? 'Pro Monthly' : 'Trade Monthly')

      const result = await purchaseProduct(productId)

      if (!result.success) {
        // Don't show error if user cancelled
        if (!result.userCancelled) {
          console.error('[Pricing] Purchase failed:', result.error)

          // Provide more helpful error messages
          let errorMessage = result.error || 'Purchase failed'

          if (errorMessage.includes('not found')) {
            errorMessage = 'Subscription not available. Please contact support with error: Product not found'
          } else if (errorMessage.includes('not configured')) {
            errorMessage = 'Billing system not ready. Please try again or contact support.'
          }

          setPurchaseError(errorMessage)
          setTimeout(() => setPurchaseError(null), 8000)
        } else {
          console.log('[Pricing] Purchase cancelled by user')
        }
        return
      }

      console.log('[Pricing] Purchase successful')

      // If logged in, sync to Supabase
      if (isLoggedIn && result.customerInfo) {
        console.log('[Pricing] Syncing to Supabase...')
        const syncResult = await syncSubscription(result.customerInfo)

        if (syncResult.success) {
          setPurchaseSuccess(true)

          // Reload user plan after successful sync
          await checkUserPlan()

          setTimeout(() => {
            setPurchaseSuccess(false)
          }, 3000)
        } else {
          console.warn('[Pricing] Sync failed but purchase succeeded')
          setPurchaseError('Purchase succeeded but sync failed. Please contact support.')
          setTimeout(() => setPurchaseError(null), 5000)
        }
      } else {
        // Not logged in - redirect to finish setup page
        console.log('[Pricing] Purchase successful, redirecting to /finish-setup...')
        window.location.href = '/finish-setup?plan=' + plan
      }
    } catch (error: any) {
      console.error('[Pricing] Purchase error:', error)

      let errorMessage = error.message || 'Purchase failed'

      // Add helpful context for debugging
      if (errorMessage.includes('not found')) {
        errorMessage += '. Error code: PRODUCT_NOT_FOUND. Please contact support.'
      }

      setPurchaseError(errorMessage)
      setTimeout(() => setPurchaseError(null), 8000)
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
            className="px-6 py-2 border border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black font-semibold rounded transition-all uppercase tracking-wide text-sm"
          >
            ← Home
          </Link>
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-yapmate-gray-dark text-white border border-gray-800 hover:border-yapmate-amber/50 font-medium rounded transition-all uppercase tracking-wide text-sm"
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
            {tradeEnabled
              ? '7-day free trial included with Pro & Trade plans'
              : '7-day free trial included with Pro plan'}
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
          <div className="bg-yapmate-gray-dark border border-yapmate-amber rounded-xl p-6 text-center">
            <p className="text-white font-semibold mb-4">
              Download YapMate on iOS to start your free trial
            </p>
            <a
              href="https://apps.apple.com/us/app/yapmate/id6756750891"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-yapmate-amber text-yapmate-black font-bold rounded-lg hover:bg-yapmate-amber/80 transition-all uppercase tracking-wide text-sm"
            >
              Open in App Store
            </a>
          </div>
        </div>
      )}

      {/* Current Plan Display */}
      {isLoggedIn && currentPlan && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-4 text-center">
            <span className="text-yapmate-gray-light text-sm uppercase tracking-wide mr-2">Current Plan:</span>
            <span className="text-yapmate-amber font-bold uppercase tracking-wide">
              {getPlanDisplayName(currentPlan)}
            </span>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <div className={`grid ${tradeEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8`}>
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
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest"><strong>3 invoices total</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Voice to invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">PDF download</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
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
                className="w-full px-8 py-4 border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="w-full px-8 py-4 border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm"
              >
                Start Free
              </Link>
            )}
          </div>

          {/* PRO Plan - Most Popular */}
          <div className="bg-yapmate-gray-dark border border-yapmate-amber rounded-xl p-8 flex flex-col relative">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-yapmate-amber text-yapmate-black px-4 py-1 text-xs font-bold uppercase tracking-wide rounded">
                Recommended
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-2 text-yapmate-amber uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Pro
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono text-white">£15</span>
              <span className="text-yapmate-gray-lightest text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest"><strong>Unlimited invoices</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Voice to invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">VAT + Reverse Charge</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Customer list</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
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
            ) : (
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={isPurchasing || isLoadingOfferings}
                className="w-full px-8 py-4 bg-yapmate-amber text-yapmate-black font-bold rounded-lg hover:bg-yapmate-amber/80 transition-all text-center uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : isWeb() ? 'Download App' : 'Start Free Trial'}
              </button>
            )}
          </div>

          {/* TRADE Plan - Only shown when feature flag enabled */}
          {tradeEnabled && (
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 flex flex-col relative">
            {/* Coming Soon Badge (only show if not in App Review mode AND not available) */}
            {isIOS() && !shouldShowTradeAsPurchasable && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-yapmate-gray-light text-yapmate-black px-4 py-1 text-xs font-bold uppercase tracking-wide rounded">
                  Coming Soon
                </span>
              </div>
            )}

            <h2 className="text-2xl font-bold mb-2 text-white uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Trade
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£25</span>
              <span className="text-yapmate-gray-lightest text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest"><strong>Everything in Pro</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">CIS deduction</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Bank details on invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-amber mr-3 text-lg">✓</span>
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
            ) : isIOS() && !shouldShowTradeAsPurchasable ? (
              <div className="w-full px-8 py-4 border border-gray-800 text-yapmate-gray-light font-semibold rounded-lg text-center uppercase tracking-wide text-sm">
                Coming Soon
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade('trade')}
                disabled={isPurchasing || isLoadingOfferings || (isIOS() && !shouldShowTradeAsPurchasable)}
                className="w-full px-8 py-4 border-2 border-yapmate-amber text-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : isWeb() ? 'Download App' : 'Start Free Trial'}
              </button>
            )}
          </div>
          )}
        </div>
      </section>

      {/* Terms & Privacy Links (Apple Guideline 3.1.2) */}
      <section className="px-6 pb-8 max-w-4xl mx-auto">
        <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-6">
          <div className="flex flex-col items-center space-y-4 text-sm">
            {/* App Store Badge */}
            <AppStoreBadge className="w-32" />

            <div className="flex items-center space-x-4">
              <Link
                href="/terms"
                className="text-yapmate-amber hover:underline font-medium"
              >
                Terms of Use
              </Link>
              <span className="text-yapmate-gray-light">•</span>
              <Link
                href="/privacy"
                className="text-yapmate-amber hover:underline font-medium"
              >
                Privacy Policy
              </Link>
            </div>
            {isIOS() && (
              <button
                onClick={async () => {
                  setPurchaseError(null)
                  setPurchaseSuccess(false)
                  try {
                    const { restorePurchases } = await import('@/lib/iap')
                    const result = await restorePurchases()
                    if (result.success) {
                      setPurchaseSuccess(true)
                      await checkUserPlan()
                      setTimeout(() => setPurchaseSuccess(false), 3000)
                    } else if (!result.userCancelled) {
                      setPurchaseError(result.error || 'Failed to restore purchases')
                      setTimeout(() => setPurchaseError(null), 5000)
                    }
                  } catch (err: any) {
                    setPurchaseError(err.message || 'Failed to restore purchases')
                    setTimeout(() => setPurchaseError(null), 5000)
                  }
                }}
                className="text-yapmate-gray-light hover:text-yapmate-amber transition-colors"
              >
                Restore Purchases
              </button>
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
              <span className="text-yapmate-amber text-xl">{openFaq === 0 ? '−' : '+'}</span>
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
              <span className="text-yapmate-amber text-xl">{openFaq === 1 ? '−' : '+'}</span>
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
              <span className="text-yapmate-amber text-xl">{openFaq === 2 ? '−' : '+'}</span>
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
              <span className="text-yapmate-amber text-xl">{openFaq === 3 ? '−' : '+'}</span>
            </button>
            {openFaq === 3 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest text-sm leading-relaxed">
                On iOS: Settings → Apple ID → Subscriptions → YapMate → Cancel. You&apos;ll retain access until the end of your billing period.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  )
}
