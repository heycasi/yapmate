'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/tax'

export default function InvoiceEditPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createBrowserClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [invoice, setInvoice] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    fetchInvoice()
  }, [params.id])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoice/${params.id}`)
      const data = await response.json()
      setInvoice(data.invoice)
      setMaterials(data.invoice.materials || [])
    } catch (error) {
      console.error('Error fetching invoice:', error)
      setError('Failed to load invoice')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/invoice/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: {
            customer_name: invoice.customer_name,
            job_summary: invoice.job_summary,
            labour_hours: invoice.labour_hours,
            labour_rate: invoice.labour_rate,
            cis_job: invoice.cis_job,
            cis_rate: invoice.cis_rate,
            vat_registered: invoice.vat_registered,
            vat_rate: invoice.vat_rate,
            notes: invoice.notes,
            status: invoice.status,
          },
          materials: materials,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save invoice')
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to save invoice')
    } finally {
      setIsSaving(false)
    }
  }

  const addMaterial = () => {
    setMaterials([
      ...materials,
      { description: '', cost: 0, quantity: 1 },
    ])
  }

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index))
  }

  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...materials]
    updated[index] = { ...updated[index], [field]: value }
    setMaterials(updated)
  }

  const handleGeneratePDF = () => {
    window.open(`/api/pdf/${params.id}`, '_blank')
  }

  const handleGeneratePaymentLink = async () => {
    try {
      const response = await fetch('/api/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: params.id }),
      })

      const data = await response.json()
      
      if (data.paymentLink) {
        setInvoice({ ...invoice, stripe_payment_link: data.paymentLink })
        alert('Payment link generated!')
      }
    } catch (error) {
      console.error('Error generating payment link:', error)
      alert('Failed to generate payment link')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Invoice not found</div>
      </div>
    )
  }

  const calculations = calculateInvoiceTotals(
    invoice.labour_hours,
    invoice.labour_rate,
    materials.map((m) => ({ cost: m.cost, quantity: m.quantity })),
    invoice.cis_job,
    invoice.cis_rate,
    invoice.vat_registered,
    invoice.vat_rate
  )

  return (
    <>
      <main className="min-h-screen p-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Edit Invoice</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white"
            >
              ← Back
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {/* AI Draft Warning - Show if any critical fields are null/empty */}
          {(!invoice.customer_name || invoice.labour_hours === null) && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm font-semibold mb-1">
                ⚠️ AI Draft - Please Review
              </p>
              <p className="text-yellow-100 text-sm">
                Some fields couldn't be extracted from your recording. Highlighted fields need your confirmation before sending.
              </p>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
            {/* Customer Name */}
            <div>
              <label className="block text-white text-sm mb-2">
                Customer Name
                {!invoice.customer_name && (
                  <span className="ml-2 text-xs text-yellow-400">⚠️ Please confirm</span>
                )}
              </label>
              <input
                type="text"
                value={invoice.customer_name || ''}
                onChange={(e) =>
                  setInvoice({ ...invoice, customer_name: e.target.value })
                }
                className={`w-full px-4 py-3 rounded-lg bg-black/20 border ${
                  !invoice.customer_name
                    ? 'border-yellow-500/70 ring-2 ring-yellow-500/30'
                    : 'border-white/20'
                } text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="Customer name"
              />
            </div>

            {/* Job Summary */}
            <div>
              <label className="block text-white text-sm mb-2">
                Job Summary
              </label>
              <textarea
                value={invoice.job_summary}
                onChange={(e) =>
                  setInvoice({ ...invoice, job_summary: e.target.value })
                }
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Labour */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm mb-2">
                  Labour Hours
                  {invoice.labour_hours === null && (
                    <span className="ml-2 text-xs text-yellow-400">⚠️ Please confirm</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={invoice.labour_hours || ''}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labour_hours: parseFloat(e.target.value) || null,
                    })
                  }
                  className={`w-full px-4 py-3 rounded-lg bg-black/20 border ${
                    invoice.labour_hours === null
                      ? 'border-yellow-500/70 ring-2 ring-yellow-500/30'
                      : 'border-white/20'
                  } text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="Hours worked"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-2">
                  Labour Rate (£/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={invoice.labour_rate}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labour_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Materials */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-white text-sm">Materials</label>
                <button
                  onClick={addMaterial}
                  className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                >
                  + Add Material
                </button>
              </div>

              <div className="space-y-3">
                {materials.map((material, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      value={material.description}
                      onChange={(e) =>
                        updateMaterial(index, 'description', e.target.value)
                      }
                      placeholder="Description"
                      className="flex-1 px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      value={material.quantity}
                      onChange={(e) =>
                        updateMaterial(
                          index,
                          'quantity',
                          parseFloat(e.target.value) || 1
                        )
                      }
                      placeholder="Qty"
                      className="w-20 px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={material.cost}
                      onChange={(e) =>
                        updateMaterial(
                          index,
                          'cost',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="Cost"
                      className="w-28 px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => removeMaterial(index)}
                      className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors duration-200"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="cis"
                  checked={invoice.cis_job}
                  onChange={(e) =>
                    setInvoice({ ...invoice, cis_job: e.target.checked })
                  }
                  className="w-5 h-5 mr-3"
                />
                <label htmlFor="cis" className="text-white">
                  CIS Job ({invoice.cis_rate}%)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="vat"
                  checked={invoice.vat_registered}
                  onChange={(e) =>
                    setInvoice({ ...invoice, vat_registered: e.target.checked })
                  }
                  className="w-5 h-5 mr-3"
                />
                <label htmlFor="vat" className="text-white">
                  VAT Registered ({invoice.vat_rate}%)
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-white text-sm mb-2">Notes</label>
              <textarea
                value={invoice.notes || ''}
                onChange={(e) =>
                  setInvoice({ ...invoice, notes: e.target.value })
                }
                rows={2}
                className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Payment terms, additional info..."
              />
            </div>

            {/* Calculations Summary */}
            <div className="border-t border-white/20 pt-6 space-y-3">
              <div className="flex justify-between text-white">
                <span>Labour</span>
                <span>{formatCurrency(calculations.labourSubtotal)}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Materials</span>
                <span>{formatCurrency(calculations.materialsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-white font-semibold">
                <span>Subtotal</span>
                <span>{formatCurrency(calculations.subtotal)}</span>
              </div>
              {invoice.cis_job && (
                <div className="flex justify-between text-red-300">
                  <span>CIS Deduction ({invoice.cis_rate}%)</span>
                  <span>-{formatCurrency(calculations.cisDeduction)}</span>
                </div>
              )}
              {invoice.vat_registered && (
                <div className="flex justify-between text-white">
                  <span>VAT ({invoice.vat_rate}%)</span>
                  <span>{formatCurrency(calculations.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white text-xl font-bold pt-3 border-t border-white/20">
                <span>TOTAL</span>
                <span>{formatCurrency(calculations.grandTotal)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleGeneratePDF}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
              >
                PDF
              </button>
              {!invoice.stripe_payment_link && (
                <button
                  onClick={handleGeneratePaymentLink}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
                >
                  Payment Link
                </button>
              )}
            </div>

            {invoice.stripe_payment_link && (
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
                <p className="text-green-200 text-sm mb-2">Payment Link:</p>
                <a
                  href={invoice.stripe_payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 text-sm break-all"
                >
                  {invoice.stripe_payment_link}
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
      <Navigation />
    </>
  )
}
