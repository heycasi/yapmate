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
