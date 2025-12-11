import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'
import { calculateInvoiceTotals } from '@/lib/tax'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceId, recipientEmail, message } = body

    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { error: 'Invoice ID and recipient email are required' },
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

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} calculations={calculations} />
    )

    // Send email with PDF attachment
    const emailResult = await resend.emails.send({
      from: 'invoices@yapmate.co.uk',
      to: recipientEmail,
      subject: `Invoice from ${session.user.email}`,
      html: `
        <h2>Invoice</h2>
        <p>${message || 'Please find attached your invoice.'}</p>
        <p><strong>Job Summary:</strong> ${invoice.job_summary}</p>
        <p><strong>Total Due:</strong> £${calculations.grandTotal.toFixed(2)}</p>
        ${
          invoice.stripe_payment_link
            ? `<p><a href="${invoice.stripe_payment_link}">Pay Invoice Online</a></p>`
            : ''
        }
        <p>Thank you for your business.</p>
      `,
      attachments: [
        {
          filename: `invoice-${invoiceId}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoiceId)
      .eq('user_id', session.user.id)

    return NextResponse.json({ success: true, emailId: emailResult.data?.id })
  } catch (error: any) {
    console.error('Error sending invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    )
  }
}
