import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Singleton browser client to avoid multiple instances
let browserClient: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (browserClient) {
    return browserClient
  }
  browserClient = createClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

export async function createServerClient() {
  const { cookies } = await import('next/headers')
  return createServerComponentClient({ cookies })
}

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          customer_id: string | null
          customer_name: string | null
          job_summary: string
          labour_hours: number | null
          labour_rate: number
          cis_job: boolean
          cis_rate: number
          vat_registered: boolean
          vat_rate: number
          stripe_payment_link: string | null
          status: 'draft' | 'sent' | 'paid' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id?: string | null
          customer_name?: string | null
          job_summary: string
          labour_hours?: number | null
          labour_rate?: number
          cis_job?: boolean
          cis_rate?: number
          vat_registered?: boolean
          vat_rate?: number
          stripe_payment_link?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string | null
          customer_name?: string | null
          job_summary?: string
          labour_hours?: number | null
          labour_rate?: number
          cis_job?: boolean
          cis_rate?: number
          vat_registered?: boolean
          vat_rate?: number
          stripe_payment_link?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      materials: {
        Row: {
          id: string
          invoice_id: string
          description: string
          cost: number
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          cost: number
          quantity?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          cost?: number
          quantity?: number
          created_at?: string
        }
      }
    }
  }
}
