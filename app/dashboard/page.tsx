'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import { formatCurrency, calculateInvoiceTotals } from '@/lib/tax'
import { PageShell } from '@/components/ui/PageShell'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/Skeleton'

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkUser()
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const getStatusType = (status: string): 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue' => {
    if (status === 'paid') return 'paid'
    if (status === 'sent') return 'sent'
    if (status === 'cancelled') return 'cancelled'
    return 'draft'
  }

  // Calculate summary stats
  const totalAmount = invoices.reduce((sum, inv) => {
    const calc = calculateInvoiceTotals(
      inv.labour_hours,
      inv.labour_rate,
      inv.materials?.map((m: any) => ({ cost: m.cost, quantity: m.quantity })) || [],
      inv.cis_job,
      inv.cis_rate,
      inv.vat_registered,
      inv.vat_rate
    )
    return sum + calc.grandTotal
  }, 0)

  const paidAmount = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => {
      const calc = calculateInvoiceTotals(
        inv.labour_hours,
        inv.labour_rate,
        inv.materials?.map((m: any) => ({ cost: m.cost, quantity: m.quantity })) || [],
        inv.cis_job,
        inv.cis_rate,
        inv.vat_registered,
        inv.vat_rate
      )
      return sum + calc.grandTotal
    }, 0)

  const dueAmount = totalAmount - paidAmount

  if (isLoading) {
    return (
      <>
        <PageShell title="Dashboard">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <SkeletonList count={2} />
            </div>
            <SkeletonList count={3} />
          </div>
        </PageShell>
        <Navigation />
      </>
    )
  }

  return (
    <>
      <PageShell
        title="Dashboard"
        description={user?.email}
      >
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <p className="text-yapmate-slate-400 text-sm mb-1 uppercase tracking-wide">
              Outstanding
            </p>
            <p className="text-2xl font-bold text-white currency">
              {formatCurrency(dueAmount)}
            </p>
          </Card>
          <Card>
            <p className="text-yapmate-slate-400 text-sm mb-1 uppercase tracking-wide">
              Paid This Month
            </p>
            <p className="text-2xl font-bold text-green-400 currency">
              {formatCurrency(paidAmount)}
            </p>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card elevated className="mb-24">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Recent Invoices</h2>
            <Link
              href="/customers"
              className="text-yapmate-amber-500 text-sm font-semibold"
            >
              View All
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-yapmate-slate-700 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧾</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No invoices yet
              </h3>
              <p className="text-yapmate-slate-400 mb-6 text-sm">
                Tap the button below to create your first invoice
              </p>
              <div className="animate-bounce text-yapmate-amber-500 text-2xl">
                ↓
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice) => {
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
                  >
                    <Card interactive className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold mb-1 truncate">
                            {invoice.customer_name || 'Unnamed Customer'}
                          </h3>
                          <p className="text-yapmate-slate-400 text-sm truncate">
                            {invoice.job_summary}
                          </p>
                          <p className="text-yapmate-slate-500 text-xs mt-1">
                            {new Date(invoice.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-white font-bold currency mb-2">
                            {formatCurrency(calculations.grandTotal)}
                          </p>
                          <StatusPill status={getStatusType(invoice.status)} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        {/* Floating Action Button */}
        <Link
          href="/record"
          className="fixed bottom-24 right-4 w-16 h-16 bg-yapmate-amber-500 rounded-full shadow-amber-glow flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Create new invoice"
        >
          <span className="text-3xl text-yapmate-black">🎤</span>
        </Link>
      </PageShell>
      <Navigation />
    </>
  )
}
