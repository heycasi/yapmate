import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role to bypass RLS for insertion
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Try to get current user session (optional - waitlist works without auth)
    let userId: string | null = null
    const authHeader = req.headers.get('authorization')

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim()

    // Insert into waitlist_signups table
    const { data, error } = await supabase
      .from('waitlist_signups')
      .insert({
        email: normalizedEmail,
        user_id: userId,
      })
      .select()
      .single()

    // Handle duplicate email (unique constraint violation)
    if (error) {
      // PostgreSQL unique violation error code
      if (error.code === '23505') {
        return NextResponse.json(
          {
            ok: true,
            message: "You're already on the list! We'll be in touch soon."
          },
          { status: 200 }
        )
      }

      console.error('Waitlist signup error:', error)
      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        message: "You're on the list! We'll be in touch soon."
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Waitlist API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
