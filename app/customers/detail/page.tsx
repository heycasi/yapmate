'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/tax'

function CustomerDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const customerId = searchParams.get('id')
  const supabase = createBrowserClient()

  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customerId) {
      checkAuth()
      fetchCustomerAndInvoices()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchCustomerAndInvoices = async () => {
    if (!customerId) {
      setError('No customer ID provided')
      setIsLoading(false)
      return
    }

    try {
      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError
      if (!customerData) throw new Error('Customer not found')

      setCustomer(customerData)

      // Fetch invoices for this customer with materials
      const { data: invoicesData, error: invoicesError } = await (supabase
        .from('invoices') as any)
        .select('*, materials(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (invoicesError) throw invoicesError

      setInvoices(invoicesData || [])
    } catch (err: any) {
      console.error('Error fetching customer data:', err)
      setError(err.message || 'Failed to load customer')
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (name: string): string => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      draft: 'bg-yapmate-slate-700 text-yapmate-slate-300',
      sent: 'bg-blue-900 text-blue-300',
      paid: 'bg-green-900 text-green-300',
      cancelled: 'bg-red-900 text-red-300',
    }
    const colorClass = statusColors[status] || statusColors.draft

    return (
      <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${colorClass}`}>
        {status}
      </span>
    )
  }

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
        <Navigation />
      </>
    )
  }

  if (error || !customer) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-yapmate-status-red text-xl mb-4">
              {error || 'Customer not found'}
            </p>
            <Link
              href="/customers"
              className="text-yapmate-amber hover:text-yapmate-status-yellow font-mono text-sm uppercase"
            >
              ← Back to Customers
            </Link>
          </div>
        </div>
        <Navigation />
      </>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-yapmate-black pb-24">
        {/* Header with Back Button */}
        <div className="border-b border-yapmate-slate-700 px-4 py-4 flex items-center justify-between">
          <Link
            href="/customers"
            className="text-yapmate-slate-300 active:text-yapmate-amber font-mono text-xs uppercase"
          >
            ← Back
          </Link>
          <h1 className="font-mono text-base font-bold text-yapmate-white uppercase">
            Customer
          </h1>
          <div className="w-16" />
        </div>

        {/* Customer Profile Header */}
        <div className="p-6 border-b border-yapmate-slate-700">
          <div className="flex items-center gap-4 mb-6">
            {/* Large Avatar */}
            <div className="w-20 h-20 rounded-full bg-yapmate-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-yapmate-black font-bold text-3xl">
                {getInitials(customer.name)}
              </span>
            </div>

            {/* Name */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{customer.name}</h2>
              <p className="text-yapmate-slate-400 text-sm font-mono">
                {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-yapmate-slate-300">
              <span className="text-xl">📧</span>
              <div>
                <p className="text-xs text-yapmate-slate-400 font-mono uppercase mb-1">
                  Email
                </p>
                <p className="text-sm">
                  {customer.email || (
                    <span className="text-yapmate-slate-500 italic">Not set</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-yapmate-slate-300">
              <span className="text-xl">📞</span>
              <div>
                <p className="text-xs text-yapmate-slate-400 font-mono uppercase mb-1">
                  Phone
                </p>
                <p className="text-sm">
                  {customer.phone || (
                    <span className="text-yapmate-slate-500 italic">Not set</span>
                  )}
                </p>
              </div>
            </div>

            {customer.address && (
              <div className="flex items-center gap-3 text-yapmate-slate-300">
                <span className="text-xl">📍</span>
                <div>
                  <p className="text-xs text-yapmate-slate-400 font-mono uppercase mb-1">
                    Address
                  </p>
                  <p className="text-sm">{customer.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoices Section */}
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-4 font-mono uppercase">
            Invoices
          </h3>

          {invoices.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center">
              <p className="text-gray-400">No invoices yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => {
                // Calculate invoice total
                const calculations = calculateInvoiceTotals(
                  invoice.labour_hours,
                  invoice.labour_rate,
                  invoice.materials?.map((m: any) => ({ cost: m.cost, quantity: m.quantity })) || [],
                  invoice.cis_job ?? false,
                  invoice.cis_rate,
                  invoice.vat_registered ?? false,
                  invoice.vat_rate
                )

                return (
                  <Link
                    key={invoice.id}
                    href={`/invoice?id=${invoice.id}`}
                    className="bg-white/10 backdrop-blur-lg rounded-lg p-4 flex items-center justify-between hover:bg-white/15 transition-colors block"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-yapmate-slate-400 text-sm font-mono">
                          {formatDate(invoice.created_at)}
                        </p>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <p className="text-white text-base mb-1">{invoice.job_summary}</p>
                      {invoice.notes && (
                        <p className="text-yapmate-slate-400 text-sm">{invoice.notes}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-yapmate-amber font-bold text-lg font-mono">
                        {formatCurrency(calculations.invoiceTotal)}
                      </p>
                      <p className="text-yapmate-slate-400 text-xs mt-1">›</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Navigation />
    </>
  )
}

export default function CustomerDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="font-mono text-sm text-yapmate-slate-300">
            {'/ / LOADING'}
          </span>
        </div>
      }
    >
      <CustomerDetailContent />
    </Suspense>
  )
}
