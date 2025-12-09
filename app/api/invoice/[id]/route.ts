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
