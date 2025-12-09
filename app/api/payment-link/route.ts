import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createPaymentLink } from '@/lib/payments'
import { calculateInvoiceTotals } from '@/lib/tax'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceId } = body

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
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
      .eq('id', invoiceId)
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

    // Create Stripe payment link
    const paymentLink = await createPaymentLink(
      invoiceId,
      calculations.grandTotal,
      invoice.job_summary
    )

    // Save payment link to invoice
    await supabase
      .from('invoices')
      .update({ stripe_payment_link: paymentLink })
      .eq('id', invoiceId)
      .eq('user_id', session.user.id)

    return NextResponse.json({ paymentLink })
  } catch (error: any) {
    console.error('Error creating payment link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment link' },
      { status: 500 }
    )
  }
}
