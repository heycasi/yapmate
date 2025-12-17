'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import { formatCurrency, calculateInvoiceTotals } from '@/lib/tax'

type FilterType = 'ALL' | 'UNPAID' | 'PAID'

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkAuth()
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
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

  const getStatusBadgeClass = (status: string) => {
    if (status === 'paid') return 'status-paid'
    if (status === 'sent') return 'status-sent'
    return 'status-draft'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'paid') return 'PAID'
    if (status === 'sent') return 'SENT'
    return 'DRAFT'
  }

  // Filter invoices based on selected filter
  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === 'PAID') return invoice.status === 'paid'
    if (filter === 'UNPAID') return invoice.status !== 'paid'
    return true // ALL
  })

  const formatInvoiceDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    return `${day}/${month}`
  }

  const formatInvoiceId = (id: string) => {
    // Extract numeric part if id is UUID, otherwise use last 4 chars
    const numericId = id.split('-').pop() || id
    return `#${numericId.slice(-4).toUpperCase()}`
  }

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <span className="font-mono text-sm">{'/ / LOADING RECORDS'}</span>
        </div>
        <Navigation />
      </>
    )
  }

  return (
    <>
      {/* FILTER BAR - Sticky Top */}
      <div className="sticky top-0 z-10 bg-yapmate-black border-b border-yapmate-slate-700 dark:border-yapmate-slate-700">
        <div className="flex h-12">
          {(['ALL', 'UNPAID', 'PAID'] as FilterType[]).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`flex-1 font-mono text-xs font-semibold tracking-wide transition-colors duration-snap ${
                filter === filterOption
                  ? 'bg-yapmate-amber text-yapmate-black border-r-2 border-yapmate-black'
                  : 'bg-yapmate-black text-yapmate-white border-r border-yapmate-slate-700 active:bg-yapmate-slate-900'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      {/* MANIFEST DATA GRID - Full Bleed */}
      <main className="min-h-screen">
        {filteredInvoices.length === 0 ? (
          // EMPTY STATE
          <div className="flex items-center justify-center py-24">
            <span className="font-mono text-sm text-yapmate-slate-300">
              {'/ / NO RECORDS FOUND'}
            </span>
          </div>
        ) : (
          // DATA ROWS
          <div className="data-grid">
            {filteredInvoices.map((invoice) => {
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
                  className="block"
                >
                  <div className="h-20 flex items-center px-4 border-b border-yapmate-slate-700 dark:border-yapmate-slate-700 transition-colors duration-0 active:bg-yapmate-amber active:text-yapmate-black">
                    {/* LEFT: Date + Invoice ID */}
                    <div className="w-16 flex-shrink-0">
                      <div className="data-label text-[0.625rem]">
                        {formatInvoiceDate(invoice.created_at)}
                      </div>
                      <div className="font-mono text-xs mt-0.5">
                        {formatInvoiceId(invoice.id)}
                      </div>
                    </div>

                    {/* CENTER: Client Name + Status */}
                    <div className="flex-1 min-w-0 px-4">
                      <div className="font-sans font-bold text-base truncate">
                        {invoice.customer_name || 'UNNAMED'}
                      </div>
                      <div className={getStatusBadgeClass(invoice.status)}>
                        {getStatusLabel(invoice.status)}
                      </div>
                    </div>

                    {/* RIGHT: Amount */}
                    <div className="w-28 flex-shrink-0 text-right">
                      <div className="font-mono text-xl font-bold tabular-nums">
                        {formatCurrency(calculations.grandTotal)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Spacer for Navigation */}
        <div className="h-20" />
      </main>

      {/* BOTTOM ACTION - Create New */}
      <div className="fixed bottom-0 left-0 right-0 pb-safe">
        <Link href="/record" className="bar-button h-14">
          CREATE NEW RECORD
        </Link>
      </div>

      <Navigation />
    </>
  )
}
