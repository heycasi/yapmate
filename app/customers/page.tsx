'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    checkAuth()
    fetchCustomers()
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

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, invoices!customer_id(id)')
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
                  Customers are automatically created when you record invoices with customer names
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map((customer) => {
                  const invoiceCount = customer.invoices?.length || 0
                  return (
                    <Link
                      key={customer.id}
                      href={`/customers/detail?id=${customer.id}`}
                      className="bg-black/20 rounded-lg p-4 flex items-center gap-4 hover:bg-black/30 transition-colors cursor-pointer block"
                    >
                      {/* Customer Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-base mb-1">
                          {customer.name}
                        </h3>
                        <p className="text-yapmate-slate-400 text-sm mb-2">
                          {invoiceCount} {invoiceCount === 1 ? 'invoice' : 'invoices'}
                        </p>
                        {customer.email && (
                          <div className="flex items-center gap-2 text-yapmate-slate-400 text-sm mb-1">
                            <span>📧</span>
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-yapmate-slate-400 text-sm">
                            <span>📞</span>
                            <span>{customer.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Chevron */}
                      <div className="text-yapmate-slate-400 text-2xl flex-shrink-0">
                        ›
                      </div>
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
