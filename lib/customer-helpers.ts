import { createBrowserClient } from './supabase'

/**
 * Normalizes phone number for UK matching and storage
 * - Strips all non-digits
 * - If starts with 44 and length is 12 (UK mobile: 44 + 10 digits), converts to leading 0
 * - Returns normalized value for consistent matching
 */
function normalizePhone(phone: string): string {
  // Strip all non-digits
  const digitsOnly = phone.replace(/\D/g, '')

  // Convert UK international format (44...) to local format (0...)
  // UK mobiles: 44 7XXX XXXXXX (12 digits) → 0 7XXX XXXXXX (11 digits)
  // UK landlines: 44 1XXX XXXXXX or 44 20XX XXXXXX (11-12 digits) → 0 1XXX XXXXXX (11 digits)
  if (digitsOnly.startsWith('44') && digitsOnly.length >= 11 && digitsOnly.length <= 13) {
    return '0' + digitsOnly.substring(2)
  }

  return digitsOnly
}

/**
 * Ensures a customer record exists with improved matching priority.
 * Matching priority:
 *   1. Email (exact match, case-insensitive, trimmed)
 *   2. Phone (normalized digits only)
 *   3. Name (case-insensitive, trimmed) - only if email and phone not provided
 *
 * @param userId - The authenticated user's ID
 * @param customerName - The customer name (required for creation if no match found)
 * @param email - Optional email for matching
 * @param phone - Optional phone for matching
 * @returns The customer ID (existing or newly created), or null if customerName is empty
 */
export async function ensureCustomer(
  userId: string,
  customerName: string | null,
  email?: string | null,
  phone?: string | null
): Promise<string | null> {
  // Return null if no customer name provided
  if (!customerName || customerName.trim() === '') {
    return null
  }

  const supabase = createBrowserClient()
  const normalizedName = customerName.trim()
  const normalizedEmail = email?.trim().toLowerCase() || null
  const normalizedPhone = phone ? normalizePhone(phone.trim()) : null

  try {
    // Priority 1: Try to match by email (if provided)
    if (normalizedEmail) {
      const { data: emailMatches, error: emailError } = await (supabase
        .from('customers') as any)
        .select('id')
        .eq('user_id', userId)
        .ilike('email', normalizedEmail)
        .limit(1)

      if (emailError) throw emailError

      if (emailMatches && emailMatches.length > 0) {
        return emailMatches[0].id
      }
    }

    // Priority 2: Try to match by phone (if provided and email match failed)
    if (normalizedPhone && normalizedPhone.length > 0) {
      // Fetch all customers with phones and match normalized digits
      const { data: customers, error: customersError } = await (supabase
        .from('customers') as any)
        .select('id, phone')
        .eq('user_id', userId)
        .not('phone', 'is', null)

      if (customersError) throw customersError

      if (customers && customers.length > 0) {
        // Find matching phone by normalized digits
        const phoneMatch = customers.find((c: any) =>
          normalizePhone(c.phone || '') === normalizedPhone
        )

        if (phoneMatch) {
          return phoneMatch.id
        }
      }
    }

    // Priority 3: Try to match by name (only if email and phone not provided or didn't match)
    if (!normalizedEmail && !normalizedPhone) {
      const { data: nameMatches, error: nameError } = await (supabase
        .from('customers') as any)
        .select('id')
        .eq('user_id', userId)
        .ilike('name', normalizedName)
        .limit(1)

      if (nameError) throw nameError

      if (nameMatches && nameMatches.length > 0) {
        return nameMatches[0].id
      }
    }

    // No match found - create new customer record
    const { data: newCustomer, error: createError } = await (supabase
      .from('customers') as any)
      .insert({
        user_id: userId,
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone || null, // Save normalized phone for consistent matching
      })
      .select('id')
      .single()

    if (createError) throw createError

    return newCustomer.id
  } catch (error) {
    console.error('Error in ensureCustomer:', error)
    throw error
  }
}
