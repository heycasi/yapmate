'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { getUserPlan, getPlanDisplayName, type PricingPlan } from '@/lib/plan-access'

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false)

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

  const handleUpgrade = () => {
    setShowUpgradeMessage(true)
    setTimeout(() => setShowUpgradeMessage(false), 5000)
  }

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F2F2F2]">
      {/* Navigation Header */}
      <nav className="border-b border-[#2A2A2A]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="px-6 py-2 border border-[#F97316] text-[#F97316] hover:bg-[#F97316] hover:text-[#0B0B0B] font-semibold rounded-[4px] transition-all uppercase tracking-wide text-sm"
          >
            ← Home
          </Link>
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-[#2A2A2A] text-[#F2F2F2] border border-[#3A3A3A] hover:border-[#8A8A8A] font-medium rounded-[4px] transition-all uppercase tracking-wide text-sm"
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
        <p className="text-xl md:text-2xl text-[#8A8A8A] max-w-2xl mx-auto">
          Simple plans for UK trades. Start free. Upgrade when it saves you time.
        </p>
      </section>

      {/* Upgrade Message */}
      {showUpgradeMessage && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-[#2A2A2A] border border-[#F97316] rounded-[6px] p-6 text-center">
            <p className="text-[#F2F2F2] font-semibold mb-2">
              Subscriptions are coming soon.
            </p>
            <p className="text-[#8A8A8A] text-sm mb-4">
              Join early access to get notified when paid plans launch.
            </p>
            <Link
              href="/waitlist"
              className="inline-block px-6 py-2 bg-[#F97316] text-[#0B0B0B] font-semibold rounded-[4px] uppercase tracking-wide text-sm"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      )}

      {/* Current Plan Display */}
      {isLoggedIn && currentPlan && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] p-4 text-center">
            <span className="text-[#8A8A8A] text-sm uppercase tracking-wide mr-2">Current Plan:</span>
            <span className="text-[#F97316] font-bold uppercase tracking-wide">
              {getPlanDisplayName(currentPlan)}
            </span>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {/* FREE Plan */}
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] p-8 flex flex-col">
            <h2 className="text-2xl font-bold mb-2 text-[#F2F2F2] uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Free
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£0</span>
              <span className="text-[#8A8A8A] text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Up to 3 invoices</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Voice to invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">PDF download</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Yapmate branding</span>
              </li>
              <li className="flex items-start text-[#8A8A8A]">
                <span className="mr-3 text-lg">✗</span>
                <span>No VAT, Reverse Charge, or CIS</span>
              </li>
            </ul>

            {currentPlan === 'free' ? (
              <div className="w-full px-8 py-4 border border-[#3A3A3A] text-[#8A8A8A] font-semibold rounded-[4px] text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : (
              <Link
                href="/signup"
                className="w-full px-8 py-4 border-2 border-[#F97316] text-[#F97316] hover:bg-[#F97316] hover:text-[#0B0B0B] font-bold rounded-[4px] transition-all text-center uppercase tracking-wide text-sm"
              >
                Start Free
              </Link>
            )}
          </div>

          {/* PRO Plan - Most Popular */}
          <div className="bg-[#2A2A2A] border-2 border-[#F97316] rounded-[6px] p-8 flex flex-col relative">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-[#F97316] text-[#0B0B0B] px-4 py-1 text-xs font-bold uppercase tracking-wide rounded-[4px]">
                Recommended
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-2 text-[#F97316] uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Pro
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono text-[#F2F2F2]">£15</span>
              <span className="text-[#8A8A8A] text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]"><strong>Unlimited invoices</strong></span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Voice to invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">VAT + Reverse Charge</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Customer list</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Clean PDFs</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#8A8A8A] mr-3 text-lg">•</span>
                <span className="text-[#8A8A8A] text-xs">For sole traders</span>
              </li>
            </ul>

            {currentPlan === 'pro' ? (
              <div className="w-full px-8 py-4 bg-[#3A3A3A] text-[#8A8A8A] font-semibold rounded-[4px] text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                className="w-full px-8 py-4 bg-[#F97316] text-[#0B0B0B] font-bold rounded-[4px] hover:bg-[#ea6a0a] transition-all text-center uppercase tracking-wide text-sm active:scale-98"
              >
                Upgrade
              </button>
            )}
          </div>

          {/* TRADE Plan */}
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] p-8 flex flex-col">
            <h2 className="text-2xl font-bold mb-2 text-[#F2F2F2] uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Trade
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£30</span>
              <span className="text-[#8A8A8A] text-lg"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow text-sm">
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Everything in Pro</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">CIS deductions + statements</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Saved job templates</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Repeat invoice autofill</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-3 text-lg">✓</span>
                <span className="text-[#F2F2F2]">Auto reminders</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#8A8A8A] mr-3 text-lg">•</span>
                <span className="text-[#8A8A8A] text-xs">For busy tradespeople</span>
              </li>
            </ul>

            {currentPlan === 'trade' ? (
              <div className="w-full px-8 py-4 bg-[#3A3A3A] text-[#8A8A8A] font-semibold rounded-[4px] text-center uppercase tracking-wide text-sm">
                Current Plan
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                className="w-full px-8 py-4 border-2 border-[#F97316] text-[#F97316] hover:bg-[#F97316] hover:text-[#0B0B0B] font-bold rounded-[4px] transition-all text-center uppercase tracking-wide text-sm active:scale-98"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] p-8 text-center">
          <h3 className="text-xl font-bold mb-4 text-[#F2F2F2] uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Built for Speed
          </h3>
          <p className="text-[#8A8A8A] max-w-2xl mx-auto">
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
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] overflow-hidden">
            <button
              onClick={() => toggleFaq(0)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-[#1A1A1A] transition-colors"
            >
              <span className="font-semibold text-[#F2F2F2]">
                What happens when I hit the free plan limit?
              </span>
              <span className="text-[#F97316] text-xl">
                {openFaq === 0 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 0 && (
              <div className="px-6 pb-4 text-[#8A8A8A] border-t border-[#3A3A3A] pt-4">
                After 3 invoices, you&apos;ll see an upgrade prompt. Your existing invoices stay accessible.
                Upgrade to Pro for unlimited invoices.
              </div>
            )}
          </div>

          {/* FAQ 2 */}
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] overflow-hidden">
            <button
              onClick={() => toggleFaq(1)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-[#1A1A1A] transition-colors"
            >
              <span className="font-semibold text-[#F2F2F2]">
                Is VAT added to what the customer pays?
              </span>
              <span className="text-[#F97316] text-xl">
                {openFaq === 1 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 1 && (
              <div className="px-6 pb-4 text-[#8A8A8A] border-t border-[#3A3A3A] pt-4">
                Yes, VAT adds to the invoice total if enabled. The invoice shows the subtotal, VAT amount,
                and total clearly separated.
              </div>
            )}
          </div>

          {/* FAQ 3 */}
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] overflow-hidden">
            <button
              onClick={() => toggleFaq(2)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-[#1A1A1A] transition-colors"
            >
              <span className="font-semibold text-[#F2F2F2]">
                How does CIS work?
              </span>
              <span className="text-[#F97316] text-xl">
                {openFaq === 2 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 2 && (
              <div className="px-6 pb-4 text-[#8A8A8A] border-t border-[#3A3A3A] pt-4">
                CIS is withheld from labour only and shown separately. The customer pays the invoice total,
                and the net payment (after CIS deduction) is what you receive.
              </div>
            )}
          </div>

          {/* FAQ 4 */}
          <div className="bg-[#2A2A2A] border border-[#3A3A3A] rounded-[6px] overflow-hidden">
            <button
              onClick={() => toggleFaq(3)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-[#1A1A1A] transition-colors"
            >
              <span className="font-semibold text-[#F2F2F2]">
                Does it work with accents?
              </span>
              <span className="text-[#F97316] text-xl">
                {openFaq === 3 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 3 && (
              <div className="px-6 pb-4 text-[#8A8A8A] border-t border-[#3A3A3A] pt-4">
                Built to handle UK accents including Glasgow, Scouse, Geordie, and Manc.
                If it struggles, you can re-record or edit the invoice manually.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-[#8A8A8A] text-sm border-t border-[#2A2A2A] mt-16">
        <p className="font-mono uppercase tracking-wide">Built for speed. Built for trades.</p>
        <p className="mt-2">© {new Date().getFullYear()} YapMate</p>
      </footer>
    </main>
  )
}
