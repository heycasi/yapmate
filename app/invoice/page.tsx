'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/tax'
import { pdf } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'

function InvoiceEditContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
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

      await (supabase.from('materials') as any).delete().eq('invoice_id', id)

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

  const handleDownloadPDF = async () => {
    if (!invoice) return

    setIsGeneratingPDF(true)
    setPdfError(null)

    try {
      const calculations = calculateInvoiceTotals(
        invoice.labour_hours,
        invoice.labour_rate,
        materials.map((m: any) => ({ cost: m.cost, quantity: m.quantity })),
        invoice.cis_job,
        invoice.cis_rate,
        invoice.vat_registered,
        invoice.vat_rate
      )

      const invoiceWithMaterials = {
        ...invoice,
        materials: materials,
      }

      const blob = await pdf(
        <InvoicePDF invoice={invoiceWithMaterials} calculations={calculations} />
      ).toBlob()

      const fileName = `invoice-${invoice.customer_name || 'draft'}-${new Date().toISOString().split('T')[0]}.pdf`

      // Check if running in Capacitor (iOS/Android)
      const isCapacitor = typeof (window as any).Capacitor !== 'undefined'

      if (isCapacitor) {
        // iOS/Android: Use Capacitor Filesystem + Share
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')

        // Convert blob to base64
        const reader = new FileReader()
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1]
            resolve(base64)
          }
          reader.readAsDataURL(blob)
        })

        // Write to cache directory
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        })

        // Share using native share sheet
        await Share.share({
          title: 'Invoice PDF',
          text: `Invoice for ${invoice.customer_name || 'customer'}`,
          url: writeResult.uri,
          dialogTitle: 'Share Invoice',
        })
      } else {
        // Web: Use download link
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()

        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      console.error('PDF generation error:', err)
      setPdfError(err.message || 'Failed to generate PDF')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <span className="font-mono text-sm text-yapmate-slate-300">{'/ / LOADING INVOICE'}</span>
        </div>
        <Navigation />
      </>
    )
  }

  if (!invoice) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <span className="font-mono text-sm text-yapmate-status-red">{'/ / INVOICE NOT FOUND'}</span>
            <button
              onClick={() => router.push('/dashboard')}
              className="block mt-4 mx-auto text-yapmate-amber hover:text-yapmate-status-yellow font-mono text-xs uppercase"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
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
      <main className="min-h-screen bg-yapmate-black pb-32">
        {/* Header */}
        <div className="border-b border-yapmate-slate-700 px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-yapmate-slate-300 active:text-yapmate-amber font-mono text-xs uppercase"
          >
            ← Back
          </button>
          <h1 className="font-mono text-base font-bold text-yapmate-white uppercase">
            Edit Invoice
          </h1>
          <div className="w-16" />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 border-2 border-yapmate-status-red bg-yapmate-status-red/10 p-4">
            <p className="text-yapmate-status-red text-sm font-mono">{error}</p>
          </div>
        )}

        <div className="p-4 space-y-6">
          {/* Customer */}
          <div className="border-b border-yapmate-slate-700 pb-4">
            <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
              Customer
            </label>
            <input
              type="text"
              value={invoice.customer_name || ''}
              onChange={(e) => setInvoice({ ...invoice, customer_name: e.target.value })}
              className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white text-lg font-bold focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
              placeholder="Customer name"
            />
          </div>

          {/* Job Summary */}
          <div className="border-b border-yapmate-slate-700 pb-4">
            <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
              Job Summary
            </label>
            <textarea
              value={invoice.job_summary || ''}
              onChange={(e) => setInvoice({ ...invoice, job_summary: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white focus:outline-none focus:border-yapmate-amber transition-colors duration-snap resize-none"
              placeholder="Job description"
            />
          </div>

          {/* Labour */}
          <div className="border-b border-yapmate-slate-700 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yapmate-slate-300 text-xs font-mono uppercase">Labour</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-yapmate-slate-300 text-xs font-mono mb-1">Hours</label>
                <input
                  type="number"
                  step="0.25"
                  value={invoice.labour_hours || ''}
                  onChange={(e) => setInvoice({ ...invoice, labour_hours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white text-xl font-mono font-bold focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
                />
              </div>
              <div>
                <label className="block text-yapmate-slate-300 text-xs font-mono mb-1">Rate (£/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoice.labour_rate || ''}
                  onChange={(e) => setInvoice({ ...invoice, labour_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white text-xl font-mono font-bold focus:outline-none focus:border-yapmate-amber transition-colors duration-snap"
                />
              </div>
            </div>
            {invoice.labour_hours > 0 && invoice.labour_rate > 0 && (
              <div className="mt-2 text-right">
                <span className="text-yapmate-amber font-mono text-lg font-bold">
                  {formatCurrency(calculations.labourSubtotal)}
                </span>
              </div>
            )}
          </div>

          {/* Materials */}
          <div className="border-b border-yapmate-slate-700 pb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-yapmate-slate-300 text-xs font-mono uppercase">Materials</span>
              <button
                onClick={addMaterial}
                className="text-yapmate-amber font-mono text-xs uppercase active:text-yapmate-status-yellow"
              >
                + Add
              </button>
            </div>
            <div className="space-y-3">
              {materials.map((material, index) => (
                <div key={index} className="border border-yapmate-slate-700 p-3">
                  <input
                    type="text"
                    value={material.description || ''}
                    onChange={(e) => updateMaterial(index, 'description', e.target.value)}
                    className="w-full mb-2 px-2 py-1 bg-yapmate-black border border-yapmate-slate-700 text-yapmate-white text-sm focus:outline-none focus:border-yapmate-amber"
                    placeholder="Description"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="1"
                      value={material.quantity || ''}
                      onChange={(e) => updateMaterial(index, 'quantity', parseInt(e.target.value) || 0)}
                      className="px-2 py-1 bg-yapmate-black border border-yapmate-slate-700 text-yapmate-white text-sm font-mono focus:outline-none focus:border-yapmate-amber"
                      placeholder="Qty"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={material.cost || ''}
                      onChange={(e) => updateMaterial(index, 'cost', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1 bg-yapmate-black border border-yapmate-slate-700 text-yapmate-white text-sm font-mono focus:outline-none focus:border-yapmate-amber"
                      placeholder="£"
                    />
                    <button
                      onClick={() => removeMaterial(index)}
                      className="text-yapmate-status-red font-mono text-xs uppercase active:bg-yapmate-status-red active:text-yapmate-black border border-yapmate-status-red"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CIS & VAT Toggles */}
          <div className="border-b border-yapmate-slate-700 pb-4 space-y-4">
            <div>
              <label className="flex items-center justify-between">
                <span className="text-yapmate-white text-xs font-mono uppercase">CIS Job</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={invoice.cis_job ?? false}
                    onChange={(e) => setInvoice({ ...invoice, cis_job: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 border-2 border-yapmate-slate-700 peer-checked:bg-yapmate-amber peer-checked:border-yapmate-amber"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-yapmate-white peer-checked:translate-x-6 transition-transform duration-snap"></div>
                </div>
              </label>
              <p className="text-yapmate-slate-400 text-xs font-mono mt-1">
                Contractor withholds {invoice.cis_rate}% from labour only
              </p>
            </div>

            <div>
              <label className="flex items-center justify-between">
                <span className="text-yapmate-white text-xs font-mono uppercase">Add VAT</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={invoice.vat_registered ?? false}
                    onChange={(e) => setInvoice({ ...invoice, vat_registered: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 border-2 border-yapmate-slate-700 peer-checked:bg-yapmate-amber peer-checked:border-yapmate-amber"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-yapmate-white peer-checked:translate-x-6 transition-transform duration-snap"></div>
                </div>
              </label>
              <p className="text-yapmate-slate-400 text-xs font-mono mt-1">
                Adds {invoice.vat_rate}% VAT to invoice total (customer pays)
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="border-b border-yapmate-slate-700 pb-4">
            <label className="block text-yapmate-slate-300 text-xs font-mono uppercase mb-2">
              Notes / Payment Terms
            </label>
            <textarea
              value={invoice.notes || ''}
              onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-yapmate-black border-2 border-yapmate-slate-700 text-yapmate-white text-sm focus:outline-none focus:border-yapmate-amber transition-colors duration-snap resize-none"
              placeholder="Payment due in 14 days..."
            />
          </div>

          {/* Totals */}
          <div className="border-2 border-yapmate-amber p-4">
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-yapmate-slate-300">Subtotal (Labour + Materials)</span>
                <span className="text-yapmate-white font-bold">{formatCurrency(calculations.subtotal)}</span>
              </div>

              {invoice.vat_registered && (
                <div className="flex justify-between">
                  <span className="text-yapmate-slate-300">VAT ({invoice.vat_rate}%)</span>
                  <span className="text-yapmate-white font-bold">{formatCurrency(calculations.vatAmount)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t-2 border-yapmate-white text-lg">
                <span className="text-yapmate-white font-bold">INVOICE TOTAL</span>
                <span className="text-yapmate-amber font-bold">{formatCurrency(calculations.grandTotal)}</span>
              </div>
              <p className="text-yapmate-slate-400 text-xs">Customer pays this amount</p>

              {invoice.cis_job && (
                <>
                  <div className="flex justify-between pt-2 border-t border-yapmate-slate-700 text-yapmate-status-orange">
                    <span>CIS withheld ({invoice.cis_rate}% of labour)</span>
                    <span className="font-bold">{formatCurrency(calculations.cisDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-base">
                    <span className="text-yapmate-white font-bold">NET PAYMENT</span>
                    <span className="text-yapmate-status-green font-bold">{formatCurrency(calculations.grandTotal - calculations.cisDeduction)}</span>
                  </div>
                  <p className="text-yapmate-slate-400 text-xs">You receive this amount</p>
                </>
              )}
            </div>

            {/* PDF Button */}
            <div className="mt-4 pt-4 border-t border-yapmate-slate-700">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="w-full h-12 border-2 border-yapmate-white text-yapmate-white font-mono font-bold uppercase bg-transparent transition-colors duration-snap active:bg-yapmate-white active:text-yapmate-black disabled:opacity-50"
              >
                {isGeneratingPDF ? 'GENERATING...' : 'DOWNLOAD PDF'}
              </button>
              {pdfError && (
                <p className="mt-2 text-xs text-yapmate-status-red font-mono">{pdfError}</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Save Button */}
      <div className="fixed bottom-0 left-0 right-0 pb-safe" style={{ bottom: '68px' }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bar-button h-14"
        >
          {isSaving ? 'SAVING...' : 'SAVE & RETURN'}
        </button>
      </div>

      <Navigation />
    </>
  )
}

export default function InvoiceEditPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-sm text-yapmate-slate-300">{'/ / LOADING'}</span>
      </div>
    }>
      <InvoiceEditContent />
    </Suspense>
  )
}
