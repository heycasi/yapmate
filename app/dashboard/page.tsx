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
