import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'
import { calculateInvoiceTotals } from '@/lib/tax'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch invoice with materials
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(
        `
        *,
        materials (*)
      `
      )
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single()

    if (error) {
      throw error
    }

    // Calculate totals
    const calculations = calculateInvoiceTotals(
      invoice.labour_hours,
      invoice.labour_rate,
      invoice.materials.map((m: any) => ({
        cost: m.cost,
        quantity: m.quantity,
      })),
      invoice.cis_job,
      invoice.cis_rate,
      invoice.vat_registered,
      invoice.vat_rate
    )

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} calculations={calculations} />
    )

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${params.id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
