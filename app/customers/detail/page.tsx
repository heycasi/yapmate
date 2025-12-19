'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/tax'

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function CustomerDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const customerId = searchParams.get('id')
  const supabase = createBrowserClient()

  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
      const { data: customerData, error: customerError } = await (supabase
        .from('customers') as any)
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError
      if (!customerData) throw new Error('Customer not found')

      setCustomer(customerData)

      // Initialize edit form with current values
      setEditForm({
        name: customerData.name || '',
        email: customerData.email || '',
        phone: customerData.phone || '',
        address: customerData.address || '',
      })

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

  const handleEditClick = () => {
    setIsEditMode(true)
    setValidationErrors({})
    setSuccessMessage(null)
    setError(null)
  }

  const handleCancelEdit = () => {
    // Revert to last saved state
    setEditForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    })
    setIsEditMode(false)
    setValidationErrors({})
    setError(null)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Name is required
    if (!editForm.name.trim()) {
      errors.name = 'Name is required'
    }

    // Email format validation if provided
    if (editForm.email.trim() && !EMAIL_REGEX.test(editForm.email.trim())) {
      errors.email = 'Invalid email format'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const normalizePhone = (phone: string): string => {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '')
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Prepare update data
      const updateData: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
      }

      // Update customer by ID
      const { error: updateError } = await (supabase
        .from('customers') as any)
        .update(updateData)
        .eq('id', customerId)

      if (updateError) throw updateError

      // Update local state
      setCustomer({ ...customer, ...updateData })
      setIsEditMode(false)
      setSuccessMessage('Customer updated')

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err: any) {
      console.error('Error updating customer:', err)
      setError(err.message || 'Failed to update customer')
      // Stay in edit mode on error
    } finally {
      setIsSaving(false)
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

  if (error && !customer) {
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

        {/* Success Toast */}
        {successMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-yapmate-status-green text-yapmate-black px-6 py-3 rounded-lg font-mono text-sm font-bold shadow-lg">
            ✓ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && customer && (
          <div className="mx-4 mt-4 border-2 border-yapmate-status-red bg-yapmate-status-red/10 p-4">
            <p className="text-yapmate-status-red text-sm font-mono">{error}</p>
          </div>
        )}

        {/* Customer Profile Header */}
        <div className="p-6 border-b border-yapmate-slate-700">
          <div className="flex items-center gap-4 mb-6">
            {/* Large Avatar */}
            <div className="w-20 h-20 rounded-full bg-yapmate-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-yapmate-black font-bold text-3xl">
                {getInitials(isEditMode ? editForm.name : customer.name)}
              </span>
            </div>

            {/* Name and Invoice Count */}
            <div className="flex-1">
              {isEditMode ? (
                <div>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={`w-full text-2xl font-bold bg-yapmate-black border-2 ${
                      validationErrors.name ? 'border-yapmate-status-red' : 'border-yapmate-slate-700'
                    } text-white px-3 py-2 focus:outline-none focus:border-yapmate-amber transition-colors`}
                    placeholder="Customer name"
                  />
                  {validationErrors.name && (
                    <p className="text-yapmate-status-red text-xs mt-1 font-mono">
                      {validationErrors.name}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-1">{customer.name}</h2>
                  <p className="text-yapmate-slate-400 text-sm font-mono">
                    {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
                  </p>
                </>
              )}
            </div>

            {/* Edit/Save/Cancel Buttons */}
            {!isEditMode ? (
              <button
                onClick={handleEditClick}
                className="text-yapmate-amber font-mono text-xs uppercase active:text-yapmate-status-yellow px-4 py-2 border border-yapmate-amber hover:bg-yapmate-amber hover:text-yapmate-black transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="text-yapmate-black bg-yapmate-amber font-mono text-xs uppercase px-4 py-2 active:bg-yapmate-status-yellow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="text-yapmate-slate-300 border border-yapmate-slate-700 font-mono text-xs uppercase px-4 py-2 active:bg-yapmate-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-center gap-3 text-yapmate-slate-300">
              <span className="text-xl">📧</span>
              <div className="flex-1">
                <p className="text-xs text-yapmate-slate-400 font-mono uppercase mb-1">
                  Email
                </p>
                {isEditMode ? (
                  <div>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className={`w-full text-sm bg-yapmate-black border-2 ${
                        validationErrors.email ? 'border-yapmate-status-red' : 'border-yapmate-slate-700'
                      } text-white px-3 py-2 focus:outline-none focus:border-yapmate-amber transition-colors`}
                      placeholder="email@example.com"
                    />
                    {validationErrors.email && (
                      <p className="text-yapmate-status-red text-xs mt-1 font-mono">
                        {validationErrors.email}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">
                    {customer.email || (
                      <span className="text-yapmate-slate-500 italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 text-yapmate-slate-300">
              <span className="text-xl">📞</span>
              <div className="flex-1">
                <p className="text-xs text-yapmate-slate-400 font-mono uppercase mb-1">
                  Phone
                </p>
                {isEditMode ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full text-sm bg-yapmate-black border-2 border-yapmate-slate-700 text-white px-3 py-2 focus:outline-none focus:border-yapmate-amber transition-colors"
                    placeholder="07700 900000"
                  />
                ) : (
                  <p className="text-sm">
                    {customer.phone || (
                      <span className="text-yapmate-slate-500 italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-center gap-3 text-yapmate-slate-300">
              <span className="text-xl">📍</span>
              <div className="flex-1">
                <p className="text-xs text-yapmate-slate-400 font-mono uppercase mb-1">
                  Address
                </p>
                {isEditMode ? (
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    rows={3}
                    className="w-full text-sm bg-yapmate-black border-2 border-yapmate-slate-700 text-white px-3 py-2 focus:outline-none focus:border-yapmate-amber transition-colors resize-none"
                    placeholder="Full address"
                  />
                ) : (
                  <p className="text-sm">
                    {customer.address || (
                      <span className="text-yapmate-slate-500 italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            </div>
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
