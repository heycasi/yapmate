'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { getUserPlan, getPlanDisplayName, type PricingPlan } from '@/lib/plan-access'
import { isIAPAvailable, purchaseProduct, IAP_PRODUCTS } from '@/lib/iap'

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)

  useEffect(() => {
    checkUserPlan()
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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const handleUpgrade = async (plan: 'pro' | 'trade') => {
    // Clear previous states
    setPurchaseError(null)
    setPurchaseSuccess(false)

    // Check if IAP is available (iOS only)
    if (!isIAPAvailable()) {
      // On web: show waitlist message
      setShowUpgradeMessage(true)
      setTimeout(() => setShowUpgradeMessage(false), 5000)
      return
    }

    // iOS: trigger native purchase flow
    if (!isLoggedIn) {
      setPurchaseError('Please log in to purchase a subscription')
      setTimeout(() => setPurchaseError(null), 5000)
      return
    }

    setIsPurchasing(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const productId = plan === 'pro' ? IAP_PRODUCTS.PRO_MONTHLY : IAP_PRODUCTS.TRADE_MONTHLY
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const accessToken = session.access_token

      const result = await purchaseProduct(productId, supabaseUrl, accessToken)

      if (result.success) {
        setPurchaseSuccess(true)
        setTimeout(() => {
          setPurchaseSuccess(false)
          // Reload user plan
          checkUserPlan()
        }, 3000)
      } else {
        // Only show error if it's not a user cancellation
        if (result.error !== 'Purchase cancelled') {
          setPurchaseError(result.error || 'Purchase failed')
          setTimeout(() => setPurchaseError(null), 5000)
        }
      }
    } catch (error: any) {
      console.error('Purchase error:', error)
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
            ) : (
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={isPurchasing}
                className="w-full px-8 py-4 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button text-center uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : 'Upgrade'}
              </button>
            )}
          </div>

          {/* TRADE Plan */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 flex flex-col">
            <h2 className="text-2xl font-bold mb-2 text-white uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Trade
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£30</span>
              <span className="text-yapmate-gray-lightest text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Everything in Pro</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">CIS deductions + statements</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Saved job templates</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Repeat invoice autofill</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-3 text-lg">✓</span>
                <span className="text-yapmate-gray-lightest">Auto reminders</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-gray-light mr-3 text-lg">•</span>
                <span className="text-yapmate-gray-light text-xs">For busy tradespeople</span>
              </li>
            </ul>

            {currentPlan === 'trade' ? (
              <div className="w-full px-8 py-4 bg-yapmate-gray-dark border border-gray-800 text-yapmate-gray-light font-semibold rounded-lg text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade('trade')}
                disabled={isPurchasing}
                className="w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : 'Upgrade'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold mb-4 text-yapmate-yellow uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Built for Speed
          </h3>
          <p className="text-yapmate-gray-lightest max-w-2xl mx-auto">
            Stop wasting 15 minutes per invoice. Voice-to-invoice means you&apos;re done in 30 seconds.
            Save hours every week on admin. Spend more time on jobs that pay.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          FAQ
        </h2>

        <div className="space-y-4">
          {/* FAQ 1 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden hover:border-yapmate-yellow/50 transition-colors">
            <button
              onClick={() => toggleFaq(0)}
              className="w-full px-6 py-4 flex justify-between items-center text-left"
            >
              <span className="font-semibold text-yapmate-yellow">
                What happens when I hit the free plan limit?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 0 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 0 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                After 3 invoices total, you&apos;ll see an upgrade prompt. Your existing invoices stay accessible.
                Upgrade to Pro for unlimited invoices.
              </div>
            )}
          </div>

          {/* FAQ 2 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden hover:border-yapmate-yellow/50 transition-colors">
            <button
              onClick={() => toggleFaq(1)}
              className="w-full px-6 py-4 flex justify-between items-center text-left"
            >
              <span className="font-semibold text-yapmate-yellow">
                Is VAT added to what the customer pays?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 1 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 1 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                Yes, VAT adds to the invoice total if enabled. The invoice shows the subtotal, VAT amount,
                and total clearly separated.
              </div>
            )}
          </div>

          {/* FAQ 3 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden hover:border-yapmate-yellow/50 transition-colors">
            <button
              onClick={() => toggleFaq(2)}
              className="w-full px-6 py-4 flex justify-between items-center text-left"
            >
              <span className="font-semibold text-yapmate-yellow">
                How does CIS work?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 2 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 2 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                CIS is withheld from labour only and shown separately. The customer pays the invoice total,
                and the net payment (after CIS deduction) is what you receive.
              </div>
            )}
          </div>

          {/* FAQ 4 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl overflow-hidden hover:border-yapmate-yellow/50 transition-colors">
            <button
              onClick={() => toggleFaq(3)}
              className="w-full px-6 py-4 flex justify-between items-center text-left"
            >
              <span className="font-semibold text-yapmate-yellow">
                Does it work with accents?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 3 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 3 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                Built to handle UK accents including Glasgow, Scouse, Geordie, and Manc.
                If it struggles, you can re-record or edit the invoice manually.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-yapmate-gray-light text-sm border-t border-gray-800 mt-16">
        <p className="font-mono uppercase tracking-wide">Built for speed. Built for trades.</p>
        <p className="mt-2">© {new Date().getFullYear()} YapMate</p>
      </footer>
    </main>
  )
}
