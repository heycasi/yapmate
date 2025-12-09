#!/bin/bash

set -e

echo "Creating remaining YapMate files..."

# Create necessary directories
mkdir -p app/api/extract
mkdir -p app/api/invoices
mkdir -p app/api/invoice/[id]
mkdir -p app/api/pdf/[id]
mkdir -p app/api/send-invoice
mkdir -p app/api/payment-link
mkdir -p app/dashboard
mkdir -p app/record
mkdir -p app/settings
mkdir -p app/customers
mkdir -p app/invoice/[id]
mkdir -p components
mkdir -p ios/App/App

echo "✓ Directories created"

# API Route: extract
cat << 'EOF' > app/api/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase'
import type { Invoice } from '@/lib/invoice'

const SYSTEM_PROMPT = `You are an AI assistant that extracts clean structured invoice data from unstructured voice transcripts from UK tradespeople (plumbers, electricians, joiners, gas engineers, builders). Return ONLY the fields defined in the Invoice type. If something is not clearly stated, return null rather than guessing. Do NOT hallucinate materials, costs, hours, or customer names. Output JSON that fits the Invoice type exactly.

Invoice type structure:
{
  "customerName": string | null,
  "jobSummary": string,
  "labourHours": number | null,
  "materials": [{ "description": string, "cost": number | null }],
  "cisJob": boolean,
  "vatRegistered": boolean,
  "notes": string | null
}

Rules:
- customerName: Only if explicitly mentioned, otherwise null
- jobSummary: Brief description of work done (always provide this)
- labourHours: Only exact numbers mentioned, otherwise null
- materials: Only items explicitly mentioned. If cost not stated, use null for cost
- cisJob: true only if CIS is explicitly mentioned, default false
- vatRegistered: true only if VAT registration explicitly mentioned, default false
- notes: Any additional context, payment terms, or follow-up items

Return ONLY valid JSON matching this structure.`

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { transcript } = body

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string' },
        { status: 400 }
      )
    }

    // Call OpenAI to extract invoice data
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Extract invoice data from this transcript:\n\n${transcript}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0]?.message?.content

    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    const extractedInvoice: Invoice = JSON.parse(responseContent)

    // Save invoice to database
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: session.user.id,
        customer_name: extractedInvoice.customerName,
        job_summary: extractedInvoice.jobSummary,
        labour_hours: extractedInvoice.labourHours,
        labour_rate: 45.0, // Default rate
        cis_job: extractedInvoice.cisJob,
        cis_rate: 20.0,
        vat_registered: extractedInvoice.vatRegistered,
        vat_rate: 20.0,
        status: 'draft',
        notes: extractedInvoice.notes,
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('Error saving invoice:', invoiceError)
      throw new Error('Failed to save invoice')
    }

    // Save materials
    if (extractedInvoice.materials.length > 0) {
      const materialsToInsert = extractedInvoice.materials
        .filter((m) => m.cost !== null)
        .map((material) => ({
          invoice_id: invoiceData.id,
          description: material.description,
          cost: material.cost!,
          quantity: 1,
        }))

      if (materialsToInsert.length > 0) {
        const { error: materialsError } = await supabase
          .from('materials')
          .insert(materialsToInsert)

        if (materialsError) {
          console.error('Error saving materials:', materialsError)
        }
      }
    }

    return NextResponse.json({
      invoice: extractedInvoice,
      invoiceId: invoiceData.id,
    })
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract invoice data' },
      { status: 500 }
    )
  }
}
EOF

echo "✓ Created app/api/extract/route.ts"

# API Route: invoices
cat << 'EOF' > app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch invoices with materials
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(
        `
        *,
        materials (*)
      `
      )
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ invoices })
  } catch (error: any) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}
EOF

echo "✓ Created app/api/invoices/route.ts"

# API Route: invoice/[id]
cat << 'EOF' > app/api/invoice/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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

    return NextResponse.json({ invoice })
  } catch (error: any) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    const body = await request.json()
    const { invoice, materials } = body

    // Update invoice
    const { error: invoiceError } = await supabase
      .from('invoices')
      .update(invoice)
      .eq('id', params.id)
      .eq('user_id', session.user.id)

    if (invoiceError) {
      throw invoiceError
    }

    // Delete existing materials
    await supabase.from('materials').delete().eq('invoice_id', params.id)

    // Insert new materials
    if (materials && materials.length > 0) {
      const materialsToInsert = materials.map((m: any) => ({
        invoice_id: params.id,
        description: m.description,
        cost: m.cost,
        quantity: m.quantity || 1,
      }))

      const { error: materialsError } = await supabase
        .from('materials')
        .insert(materialsToInsert)

      if (materialsError) {
        throw materialsError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
EOF

echo "✓ Created app/api/invoice/[id]/route.ts"

# API Route: payment-link
cat << 'EOF' > app/api/payment-link/route.ts
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
EOF

echo "✓ Created app/api/payment-link/route.ts"

# Component: InvoicePDF.tsx
cat << 'EOF' > components/InvoicePDF.tsx
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import { InvoiceCalculation, formatCurrency } from '@/lib/tax'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  companyInfo: {
    fontSize: 9,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  col1: {
    width: '60%',
  },
  col2: {
    width: '20%',
    textAlign: 'right',
  },
  col3: {
    width: '20%',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 11,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
})

interface InvoicePDFProps {
  invoice: any
  calculations: InvoiceCalculation
}

const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, calculations }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.companyInfo}>Invoice ID: {invoice.id}</Text>
          <Text style={styles.companyInfo}>
            Date: {new Date(invoice.created_at).toLocaleDateString('en-GB')}
          </Text>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text>{invoice.customer_name || 'Customer Name Not Provided'}</Text>
        </View>

        {/* Job Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text>{invoice.job_summary}</Text>
          {invoice.notes && <Text style={{ marginTop: 5 }}>{invoice.notes}</Text>}
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Description</Text>
              <Text style={styles.col2}>Qty</Text>
              <Text style={styles.col3}>Amount</Text>
            </View>

            {/* Labour */}
            {invoice.labour_hours && invoice.labour_hours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>
                  Labour ({invoice.labour_hours} hours @ £
                  {invoice.labour_rate.toFixed(2)}/hr)
                </Text>
                <Text style={styles.col2}>1</Text>
                <Text style={styles.col3}>
                  {formatCurrency(calculations.labourSubtotal)}
                </Text>
              </View>
            )}

            {/* Materials */}
            {invoice.materials.map((material: any, index: number) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.col1}>{material.description}</Text>
                <Text style={styles.col2}>{material.quantity}</Text>
                <Text style={styles.col3}>
                  {formatCurrency(material.cost * material.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(calculations.subtotal)}</Text>
          </View>

          {invoice.cis_job && calculations.cisDeduction > 0 && (
            <View style={styles.totalRow}>
              <Text>CIS Deduction ({invoice.cis_rate}%)</Text>
              <Text>-{formatCurrency(calculations.cisDeduction)}</Text>
            </View>
          )}

          {invoice.vat_registered && calculations.vatAmount > 0 && (
            <View style={styles.totalRow}>
              <Text>VAT ({invoice.vat_rate}%)</Text>
              <Text>{formatCurrency(calculations.vatAmount)}</Text>
            </View>
          )}

          <View style={styles.grandTotal}>
            <Text>TOTAL DUE</Text>
            <Text>{formatCurrency(calculations.grandTotal)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business</Text>
          <Text>Generated by YapMate</Text>
        </View>
      </Page>
    </Document>
  )
}

export default InvoicePDF
EOF

echo "✓ Created components/InvoicePDF.tsx"

# API Route: pdf/[id]
cat << 'EOF' > app/api/pdf/[id]/route.ts
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
EOF

echo "✓ Created app/api/pdf/[id]/route.ts"

# API Route: send-invoice
cat << 'EOF' > app/api/send-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'
import { calculateInvoiceTotals } from '@/lib/tax'

const resend = new Resend(process.env.RESEND_API_KEY)

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
EOF

echo "✓ Created app/api/send-invoice/route.ts"

# Page: dashboard
cat << 'EOF' > app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import { formatCurrency, calculateInvoiceTotals } from '@/lib/tax'

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkUser()
    fetchInvoices()
  }, [])

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    } else {
      setUser(session.user)
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/invoices')
      const data = await response.json()
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-300'
      case 'sent':
        return 'bg-blue-500/20 text-blue-300'
      case 'draft':
        return 'bg-gray-500/20 text-gray-300'
      case 'cancelled':
        return 'bg-red-500/20 text-red-300'
      default:
        return 'bg-gray-500/20 text-gray-300'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen p-8 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
              <p className="text-gray-300">
                Welcome back, {user?.email}
              </p>
            </div>
            <Link
              href="/record"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
            >
              + New Invoice
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-2">Total Invoices</p>
              <p className="text-3xl font-bold text-white">{invoices.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-2">Paid</p>
              <p className="text-3xl font-bold text-green-400">
                {invoices.filter((i) => i.status === 'paid').length}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-2">Pending</p>
              <p className="text-3xl font-bold text-blue-400">
                {invoices.filter((i) => i.status === 'sent').length}
              </p>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Invoices</h2>

            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No invoices yet</p>
                <Link
                  href="/record"
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
                >
                  Create Your First Invoice
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => {
                  const calculations = calculateInvoiceTotals(
                    invoice.labour_hours,
                    invoice.labour_rate,
                    invoice.materials?.map((m: any) => ({
                      cost: m.cost,
                      quantity: m.quantity,
                    })) || [],
                    invoice.cis_job,
                    invoice.cis_rate,
                    invoice.vat_registered,
                    invoice.vat_rate
                  )

                  return (
                    <Link
                      key={invoice.id}
                      href={`/invoice/${invoice.id}`}
                      className="block bg-black/20 rounded-lg p-4 hover:bg-black/30 transition-colors duration-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold mb-1">
                            {invoice.customer_name || 'Unnamed Customer'}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {invoice.job_summary}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-white font-bold text-lg">
                            {formatCurrency(calculations.grandTotal)}
                          </p>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${getStatusColor(
                              invoice.status
                            )}`}
                          >
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs">
                        {new Date(invoice.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <Navigation />
    </>
  )
}
EOF

echo "✓ Created app/dashboard/page.tsx"

# Page: record (with auth - updated version)
cat << 'EOF' > app/record/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import type { Invoice } from '@/lib/invoice'
import Navigation from '@/components/Navigation'

export default function RecordPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createBrowserClient()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    checkAuth()
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const startRecording = async () => {
    try {
      setError(null)
      setTranscript(null)
      setInvoice(null)
      setInvoiceId(null)
      setRecordingTime(0)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleTranscription(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= 60) {
            stopRecording()
            return 60
          }
          return newTime
        })
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to access microphone. Please grant permission and try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Transcription failed')
      }

      const data = await response.json()
      setTranscript(data.transcript)
      await handleExtraction(data.transcript)
    } catch (err: any) {
      console.error('Transcription error:', err)
      setError(err.message || 'Failed to transcribe audio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleExtraction = async (transcriptText: string) => {
    setIsExtracting(true)
    setError(null)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: transcriptText }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Extraction failed')
      }

      const data = await response.json()
      setInvoice(data.invoice)
      setInvoiceId(data.invoiceId)
    } catch (err: any) {
      console.error('Extraction error:', err)
      setError(err.message || 'Failed to extract invoice data')
    } finally {
      setIsExtracting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      <main className="min-h-screen p-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Record Your Job</h1>
            <p className="text-gray-300">
              Describe your job and we&apos;ll extract the invoice details
            </p>
          </div>

          {/* Recording Controls */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-6">
            <div className="flex flex-col items-center gap-6">
              <div className="text-5xl font-mono text-white">
                {formatTime(recordingTime)}
              </div>

              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isTranscribing || isExtracting}
                  className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200 shadow-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-white" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-gray-700 hover:bg-gray-800 flex items-center justify-center transition-colors duration-200 shadow-lg"
                >
                  <div className="w-8 h-8 bg-white" />
                </button>
              )}

              <div className="text-sm text-gray-300">
                {isRecording
                  ? 'Click to stop recording'
                  : isTranscribing
                    ? 'Transcribing...'
                    : isExtracting
                      ? 'Extracting invoice data...'
                      : 'Click to start recording (max 60 seconds)'}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {/* Transcript Display */}
          {transcript && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">Transcript</h2>
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-gray-200 leading-relaxed">{transcript}</p>
              </div>
            </div>
          )}

          {/* Invoice Preview */}
          {invoice && invoiceId && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Invoice Created!
              </h2>
              <div className="bg-black/20 rounded-lg p-6 space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Customer</p>
                  <p className="text-white font-semibold">
                    {invoice.customerName || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Job Summary</p>
                  <p className="text-white">{invoice.jobSummary}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => router.push(`/invoice/${invoiceId}`)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
                >
                  Edit Invoice
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
                >
                  Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Navigation />
    </>
  )
}
EOF

echo "✓ Created app/record/page.tsx"

# Page: settings
cat << 'EOF' > app/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    } else {
      setUser(session.user)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen p-8 pb-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Settings</h1>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
            {/* Account Info */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Account Information
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Email
                  </label>
                  <p className="text-white">{user.email}</p>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    User ID
                  </label>
                  <p className="text-white text-xs font-mono">{user.id}</p>
                </div>
              </div>
            </div>

            {/* Default Rates */}
            <div className="border-t border-white/20 pt-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Default Rates
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-white text-sm mb-2">
                    Labour Rate (£/hr)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue="45.00"
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-2">
                    CIS Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue="20.0"
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-2">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue="20.0"
                    className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Logout */}
            <div className="border-t border-white/20 pt-6">
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </main>
      <Navigation />
    </>
  )
}
EOF

echo "✓ Created app/settings/page.tsx"

# Page: customers
cat << 'EOF' > app/customers/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkAuth()
    fetchCustomers()
  }, [])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen p-8 pb-24">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Customers</h1>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            {customers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No customers yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  Customers will appear here as you create invoices
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="bg-black/20 rounded-lg p-4"
                  >
                    <h3 className="text-white font-semibold mb-2">
                      {customer.name}
                    </h3>
                    {customer.email && (
                      <p className="text-gray-400 text-sm">{customer.email}</p>
                    )}
                    {customer.phone && (
                      <p className="text-gray-400 text-sm">{customer.phone}</p>
                    )}
                    {customer.address && (
                      <p className="text-gray-400 text-sm">{customer.address}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Navigation />
    </>
  )
}
EOF

echo "✓ Created app/customers/page.tsx"

# Page: invoice/[id] - the big one with full editing
cat << 'EOF' > app/invoice/[id]/page.tsx
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

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-6">
            {/* Customer Name */}
            <div>
              <label className="block text-white text-sm mb-2">
                Customer Name
              </label>
              <input
                type="text"
                value={invoice.customer_name || ''}
                onChange={(e) =>
                  setInvoice({ ...invoice, customer_name: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-4 py-3 rounded-lg bg-black/20 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
EOF

echo "✓ Created app/invoice/[id]/page.tsx"

# iOS Info.plist
cat << 'EOF' > ios/App/App/Info.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>YapMate</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>armv7</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UIViewControllerBasedStatusBarAppearance</key>
    <true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>YapMate needs access to your microphone to record voice notes for invoice creation.</string>
    <key>NSCameraUsageDescription</key>
    <string>YapMate needs camera access for scanning receipts and documents.</string>
</dict>
</plist>
EOF

echo "✓ Created ios/App/App/Info.plist"

echo ""
echo "================================================"
echo "✅ ALL FILES CREATED SUCCESSFULLY!"
echo "================================================"
echo ""
echo "Summary:"
echo "  - 8 API routes created"
echo "  - 5 pages created (dashboard, record, settings, customers, invoice/[id])"
echo "  - 1 component (InvoicePDF.tsx)"
echo "  - 1 iOS configuration file (Info.plist)"
echo ""
echo "Next steps:"
echo "  1. Run: npm install"
echo "  2. Copy .env.local.example to .env.local and add your keys"
echo "  3. Set up Supabase and run the migration"
echo "  4. Run: npm run dev"
echo ""
