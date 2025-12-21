'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <main className="min-h-screen bg-yapmate-black text-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="px-6 py-2 border border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-semibold rounded transition-all"
          >
            ← HOME
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="px-6 py-16 md:py-20 max-w-4xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 uppercase tracking-tight">
          PRICING
        </h1>
        <p className="text-xl md:text-2xl text-yapmate-gray-lightest max-w-2xl mx-auto">
          Simple plans for UK trades. Start free. Upgrade when it saves you time.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {/* FREE Plan */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-xl p-8 flex flex-col">
            <h2 className="text-3xl font-bold mb-2 text-yapmate-yellow uppercase tracking-tight">
              FREE
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£0</span>
            </div>
            <p className="text-yapmate-gray-lightest mb-6 font-mono text-sm uppercase tracking-wide">
              5 invoices / month
            </p>

            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">Voice → invoice</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">PDF export</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">Basic customer list (auto-created)</span>
              </li>
            </ul>

            <Link
              href="/signup"
              className="w-full px-8 py-4 border-2 border-yapmate-yellow text-yapmate-yellow hover:bg-yapmate-yellow hover:text-yapmate-black font-bold rounded-lg transition-all text-center uppercase tracking-wide"
            >
              START FREE
            </Link>
          </div>

          {/* SOLO Plan - Most Popular */}
          <div className="bg-yapmate-gray-dark border-2 border-yapmate-yellow rounded-xl p-8 flex flex-col relative">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-yapmate-yellow text-yapmate-black px-4 py-1 text-xs font-bold uppercase tracking-wide rounded">
                MOST POPULAR
              </span>
            </div>

            <h2 className="text-3xl font-bold mb-2 text-yapmate-yellow uppercase tracking-tight">
              SOLO
            </h2>
            <div className="mb-6">
              <span className="text-5xl font-bold font-mono">£10</span>
              <span className="text-yapmate-gray-lightest text-xl"> / month</span>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">Unlimited invoices</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">Voice → invoice + edit</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">Customers + invoice history</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">VAT + CIS support</span>
              </li>
              <li className="flex items-start">
                <span className="text-yapmate-yellow mr-2">✓</span>
                <span className="text-yapmate-gray-lightest">Bank details on invoices</span>
              </li>
            </ul>

            <Link
              href="/signup"
              className="w-full px-8 py-4 bg-gradient-to-br from-yapmate-gold to-yapmate-gold-dark text-yapmate-black font-bold rounded-lg hover:from-yapmate-gold-dark hover:to-yapmate-gold-darker transition-all shadow-yapmate-button text-center uppercase tracking-wide"
            >
              GET SOLO
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 uppercase tracking-tight">
          FAQ
        </h2>

        <div className="space-y-4">
          {/* FAQ 1 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFaq(0)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-900 transition-colors"
            >
              <span className="font-semibold text-yapmate-yellow">
                Is VAT added to what the customer pays?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 0 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 0 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                Yes, VAT adds to the invoice total if enabled. The invoice will show the subtotal, VAT amount, and total clearly separated.
              </div>
            )}
          </div>

          {/* FAQ 2 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFaq(1)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-900 transition-colors"
            >
              <span className="font-semibold text-yapmate-yellow">
                How does CIS work?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 1 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 1 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                CIS is withheld from labour only and shown separately. The customer pays the invoice total, and the net payment (after CIS deduction) is what the tradie receives.
              </div>
            )}
          </div>

          {/* FAQ 3 */}
          <div className="bg-yapmate-gray-dark border border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFaq(2)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-900 transition-colors"
            >
              <span className="font-semibold text-yapmate-yellow">
                Does it work with accents?
              </span>
              <span className="text-yapmate-yellow text-xl">
                {openFaq === 2 ? '−' : '+'}
              </span>
            </button>
            {openFaq === 2 && (
              <div className="px-6 pb-4 text-yapmate-gray-lightest border-t border-gray-800 pt-4">
                Built to handle UK accents including Glasgow, Scouse, Geordie, and Manc. If it struggles, you can re-record or edit the invoice manually.
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
