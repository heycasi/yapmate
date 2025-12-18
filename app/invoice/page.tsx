'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/tax'
import { PageShell } from '@/components/ui/PageShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomCTA } from '@/components/ui/BottomCTA'

function InvoiceEditContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const router = useRouter()
  // const supabase = createBrowserClient() - Removed
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [invoice, setInvoice] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      checkAuth()
      fetchInvoice(id)
    } else {
        setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchInvoice = async (invoiceId: string) => {
    try {
      const { data, error } = await (supabase
        .from('invoices') as any)
        .select('*, materials(*)')
        .eq('id', invoiceId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Invoice not found')

      setInvoice(data)
      setMaterials((data as any).materials || [])
    } catch (error) {
      console.error('Error fetching invoice:', error)
      setError('Failed to load invoice')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!id || !invoice) return
    setIsSaving(true)
    setError(null)

    try {
        // 1. Update Invoice
        const { error: invoiceError } = await (supabase
            .from('invoices') as any)
            .update({
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
            })
            .eq('id', id)
        
        if (invoiceError) throw invoiceError

        // 2. Handle Materials (Delete existing and re-insert simplistic approach for now, or Upsert)
        // For simplicity in this prototype, we'll upsert if they have IDs, or insert if new. 
        // Actually simpler: Delete all for this invoice and re-insert is risky but easiest for prototype.
        // Better: Upsert.
        
        const materialsToUpsert = materials.map(m => ({
            ...m,
            invoice_id: id,
            id: m.id || undefined // Let Postgres generate ID if missing
        }))
        
        // Handling deletions is tricky without tracking deleted IDs. 
        // For now, we will just upsert modified/new ones. Deleted ones won't be removed in this logic 
        // without more complex state tracking.
        // FIX: First delete all materials for this invoice, then insert all current ones.
        // This is "Nuclear" but ensures sync.
        
        await (supabase.from('materials') as any).delete().eq('invoice_id', id)
        
        // Remove IDs from materials so they get new ones (safest for "Delete & Re-insert" strategy)
        const materialsToInsert = materials.map(m => {
            const { id: _id, ...rest } = m
            return { ...rest, invoice_id: id }
        })

        if (materialsToInsert.length > 0) {
            const { error: materialsError } = await (supabase
                .from('materials') as any)
                .insert(materialsToInsert)
            
            if (materialsError) throw materialsError
        }

      router.push('/dashboard')
    } catch (err: any) {
      console.error(err)
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
            Invoice not found or invalid ID.
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
    invoice.cis_job ?? false,
    invoice.cis_rate,
    invoice.vat_registered ?? false,
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
    </>
  )
}

export default function InvoiceEditPage() {
  return (
    <Suspense fallback={<div className="text-center p-12 text-gray-500">Loading editor...</div>}>
      <InvoiceEditContent />
    </Suspense>
  )
}
