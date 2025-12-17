'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/tax'
import { PageShell } from '@/components/ui/PageShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomCTA } from '@/components/ui/BottomCTA'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!response.ok) {
        console.error('Fetch invoice failed:', response.status, response.statusText)
        throw new Error(`Failed to fetch invoice: ${response.status}`)
      }
      const data = await response.json()
      if (!data.invoice) {
        throw new Error('Invoice data not found in response')
      }
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
      <>
        <PageShell title="Loading...">
          <div className="text-yapmate-slate-400 text-center py-12">
            Loading invoice...
          </div>
        </PageShell>
        <Navigation />
      </>
    )
  }

  if (!invoice) {
    return (
      <>
        <PageShell title="Not Found">
          <div className="text-yapmate-slate-400 text-center py-12">
            Invoice not found
          </div>
        </PageShell>
        <Navigation />
      </>
    )
  }

  const calculations = calculateInvoiceTotals(
    invoice.labour_hours,
    invoice.labour_rate,
    materials.map((m) => ({ cost: m.cost, quantity: m.quantity })),
    invoice.cis_job ?? false, // Treat null as false for calculations only
    invoice.cis_rate,
    invoice.vat_registered ?? false, // Treat null as false for calculations only
    invoice.vat_rate
  )

  return (
    <>
      <PageShell
        title="Edit Invoice"
        action={
          <button
            onClick={() => router.push('/dashboard')}
            className="text-yapmate-slate-400 active:text-yapmate-slate-200 text-sm font-semibold"
          >
            ← Back
          </button>
        }
      >
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* AI Draft Warning */}
        {(!invoice.customer_name || invoice.labour_hours === null || invoice.cis_job === null || invoice.vat_registered === null || materials.some(m => m.cost === null)) && (
          <div className="bg-yapmate-amber-500/20 border border-yapmate-amber-500/50 rounded-xl p-4 mb-4">
            <p className="text-yapmate-amber-400 text-sm font-semibold mb-1">
              ⚠️ AI Draft - Please Review
            </p>
            <p className="text-yapmate-amber-200 text-xs">
              Some fields couldn&apos;t be extracted. Highlighted fields need confirmation.
            </p>
          </div>
        )}

        <div className="space-y-4 mb-32">
          {/* Customer Details */}
          <Card>
            <label className="block text-yapmate-slate-400 text-label mb-2">
              Customer Name
              {!invoice.customer_name && (
                <span className="ml-2 text-yapmate-amber-400">⚠️ Required</span>
              )}
            </label>
            <input
              type="text"
              value={invoice.customer_name || ''}
              onChange={(e) =>
                setInvoice({ ...invoice, customer_name: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg bg-yapmate-slate-900 border ${
                !invoice.customer_name
                  ? 'border-yapmate-amber-500/70 ring-2 ring-yapmate-amber-500/30'
                  : 'border-yapmate-slate-700'
              } text-white placeholder-yapmate-slate-500 focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500`}
              placeholder="Customer name"
            />
          </Card>

          {/* Job Summary */}
          <Card>
            <label className="block text-yapmate-slate-400 text-label mb-2">
              Job Summary
            </label>
            <textarea
              value={invoice.job_summary}
              onChange={(e) =>
                setInvoice({ ...invoice, job_summary: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-yapmate-slate-900 border border-yapmate-slate-700 text-white placeholder-yapmate-slate-500 focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500"
            />
          </Card>

          {/* Labour */}
          <Card>
            <h3 className="text-white font-semibold mb-4">Labour</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-yapmate-slate-400 text-label mb-2">
                  Hours
                  {invoice.labour_hours === null && (
                    <span className="ml-2 text-yapmate-amber-400">⚠️</span>
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
                  className={`w-full px-4 py-3 rounded-lg bg-yapmate-slate-900 border ${
                    invoice.labour_hours === null
                      ? 'border-yapmate-amber-500/70 ring-2 ring-yapmate-amber-500/30'
                      : 'border-yapmate-slate-700'
                  } text-white placeholder-yapmate-slate-500 focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500`}
                  placeholder="Hours"
                />
              </div>
              <div>
                <label className="block text-yapmate-slate-400 text-label mb-2">
                  Rate (£/hr)
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
                  className="w-full px-4 py-3 rounded-lg bg-yapmate-slate-900 border border-yapmate-slate-700 text-white placeholder-yapmate-slate-500 focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500"
                />
              </div>
            </div>
          </Card>

          {/* Materials */}
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Materials</h3>
              <button
                onClick={addMaterial}
                className="text-yapmate-amber-500 active:text-yapmate-amber-600 text-sm font-semibold"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {materials.map((material, index) => (
                <div key={index} className="flex gap-2 items-center bg-yapmate-slate-900 p-2 rounded-lg">
                  <input
                    type="text"
                    value={material.description}
                    onChange={(e) =>
                      updateMaterial(index, 'description', e.target.value)
                    }
                    placeholder="Description"
                    className="flex-1 px-3 py-2 rounded bg-yapmate-black border border-yapmate-slate-700 text-white placeholder-yapmate-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500"
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
                    className="w-16 px-2 py-2 rounded bg-yapmate-black border border-yapmate-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={material.cost ?? ''}
                    onChange={(e) =>
                        updateMaterial(
                        index,
                        'cost',
                        e.target.value === '' ? null : parseFloat(e.target.value)
                        )
                    }
                    placeholder="£"
                    className={`w-20 px-2 py-2 rounded border text-white text-sm focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500 ${
                        material.cost === null
                        ? 'bg-yapmate-amber-500/10 border-yapmate-amber-500'
                        : 'bg-yapmate-black border-yapmate-slate-700'
                    }`}
                  />
                  <button
                    onClick={() => removeMaterial(index)}
                    className="w-8 h-8 bg-red-500/20 active:bg-red-500/30 text-red-400 rounded transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Tax Settings */}
          <div className="grid grid-cols-2 gap-4">
            {/* CIS Job */}
            <Card className="p-3">
              <label className="block text-yapmate-slate-400 text-xs mb-2 uppercase tracking-wide">
                CIS Job ({invoice.cis_rate}%)
                {invoice.cis_job === null && (
                  <span className="ml-1 text-yapmate-amber-400">⚠️</span>
                )}
              </label>
              <div className={`flex gap-2 p-1 rounded-lg ${
                invoice.cis_job === null
                  ? 'bg-yapmate-amber-500/10'
                  : 'bg-yapmate-slate-900'
              }`}>
                <button
                  onClick={() => setInvoice({ ...invoice, cis_job: true })}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    invoice.cis_job === true
                      ? 'bg-green-600 text-white'
                      : 'bg-yapmate-slate-800 text-yapmate-slate-300 active:bg-yapmate-slate-700'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setInvoice({ ...invoice, cis_job: false })}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    invoice.cis_job === false
                      ? 'bg-yapmate-slate-600 text-white'
                      : 'bg-yapmate-slate-800 text-yapmate-slate-300 active:bg-yapmate-slate-700'
                  }`}
                >
                  No
                </button>
              </div>
            </Card>

            {/* VAT Registered */}
            <Card className="p-3">
              <label className="block text-yapmate-slate-400 text-xs mb-2 uppercase tracking-wide">
                VAT Registered ({invoice.vat_rate}%)
                {invoice.vat_registered === null && (
                  <span className="ml-1 text-yapmate-amber-400">⚠️</span>
                )}
              </label>
              <div className={`flex gap-2 p-1 rounded-lg ${
                invoice.vat_registered === null
                  ? 'bg-yapmate-amber-500/10'
                  : 'bg-yapmate-slate-900'
              }`}>
                <button
                  onClick={() => setInvoice({ ...invoice, vat_registered: true })}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    invoice.vat_registered === true
                      ? 'bg-green-600 text-white'
                      : 'bg-yapmate-slate-800 text-yapmate-slate-300 active:bg-yapmate-slate-700'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setInvoice({ ...invoice, vat_registered: false })}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    invoice.vat_registered === false
                      ? 'bg-yapmate-slate-600 text-white'
                      : 'bg-yapmate-slate-800 text-yapmate-slate-300 active:bg-yapmate-slate-700'
                  }`}
                >
                  No
                </button>
              </div>
            </Card>
          </div>

          {/* Notes */}
          <Card>
            <label className="block text-yapmate-slate-400 text-label mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={invoice.notes || ''}
              onChange={(e) =>
                setInvoice({ ...invoice, notes: e.target.value })
              }
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-yapmate-slate-900 border border-yapmate-slate-700 text-white placeholder-yapmate-slate-500 focus:outline-none focus:ring-2 focus:ring-yapmate-amber-500"
              placeholder="Payment terms, additional info..."
            />
          </Card>

          {/* Totals Summary */}
          <Card elevated>
            <h3 className="text-white font-semibold mb-4">Invoice Total</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-yapmate-slate-300">
                <span>Labour</span>
                <span className="currency">{formatCurrency(calculations.labourSubtotal)}</span>
              </div>
              <div className="flex justify-between text-yapmate-slate-300">
                <span>Materials</span>
                <span className="currency">{formatCurrency(calculations.materialsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-white font-semibold pt-2 border-t border-yapmate-slate-700">
                <span>Subtotal</span>
                <span className="currency">{formatCurrency(calculations.subtotal)}</span>
              </div>
              {invoice.cis_job && (
                <div className="flex justify-between text-red-400">
                  <span>CIS Deduction ({invoice.cis_rate}%)</span>
                  <span className="currency">-{formatCurrency(calculations.cisDeduction)}</span>
                </div>
              )}
              {invoice.vat_registered && (
                <div className="flex justify-between text-yapmate-slate-300">
                  <span>VAT ({invoice.vat_rate}%)</span>
                  <span className="currency">{formatCurrency(calculations.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white text-2xl font-bold pt-3 border-t border-yapmate-slate-700">
                <span>TOTAL</span>
                <span className="currency">{formatCurrency(calculations.grandTotal)}</span>
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-yapmate-slate-700">
              <Button
                variant="secondary"
                onClick={handleGeneratePDF}
                className="flex-1"
              >
                PDF
              </Button>
              {!invoice.stripe_payment_link && (
                <Button
                  variant="secondary"
                  onClick={handleGeneratePaymentLink}
                  className="flex-1"
                >
                  Payment Link
                </Button>
              )}
            </div>

            {invoice.stripe_payment_link && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mt-4">
                <p className="text-green-400 text-xs font-semibold mb-1">Payment Link Generated:</p>
                <a
                  href={invoice.stripe_payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-300 text-xs break-all underline"
                >
                  {invoice.stripe_payment_link}
                </a>
              </div>
            )}
          </Card>
        </div>

        {/* Fixed Bottom Action */}
        <BottomCTA>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="large"
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save & Continue'}
          </Button>
        </BottomCTA>
      </PageShell>
      <Navigation />
    </>
  )
}
