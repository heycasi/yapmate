import { createBrowserClient } from './supabase'

/**
 * Ensures a customer record exists for the given customer name.
 * If a customer with this name already exists, returns their ID.
 * If not, creates a new customer record and returns the new ID.
 *
 * @param userId - The authenticated user's ID
 * @param customerName - The customer name from the invoice
 * @returns The customer ID (existing or newly created), or null if customerName is empty
 */
export async function ensureCustomer(
  userId: string,
  customerName: string | null
): Promise<string | null> {
  if (!customerName || customerName.trim() === '') {
    return null
  }

  const supabase = createBrowserClient()
  const normalizedName = customerName.trim()

  // Check if customer already exists (case-insensitive match on name)
  const { data: existingCustomers, error: searchError } = await (supabase
    .from('customers') as any)
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', normalizedName)
    .limit(1)

  if (searchError) {
    console.error('Error searching for customer:', searchError)
    throw searchError
  }

  // If customer exists, return their ID
  if (existingCustomers && existingCustomers.length > 0) {
    return existingCustomers[0].id
  }

  // Customer doesn't exist, create new record
  const { data: newCustomer, error: createError } = await (supabase
    .from('customers') as any)
    .insert({
      user_id: userId,
      name: normalizedName,
    })
    .select('id')
    .single()

  if (createError) {
    console.error('Error creating customer:', createError)
    throw createError
  }

  return newCustomer.id
}
