import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Default beta settings
const DEFAULT_DAYS = 7
const DEFAULT_PLAN: 'pro' | 'trade' = 'pro'

export async function POST(request: NextRequest) {
  try {
    // Check environment variables
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase config:', {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_KEY
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (!RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_DAYS)

    // Check if already exists
    const { data: existing, error: selectError } = await supabase
      .from('beta_invites')
      .select('id, email, expires_at')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (selectError) {
      console.error('Beta invite select error:', selectError)
      return NextResponse.json({ error: 'Database error: ' + selectError.message }, { status: 500 })
    }

    if (existing) {
      // Check if still active
      if (new Date(existing.expires_at) > new Date()) {
        return NextResponse.json({
          error: 'You already have active beta access! Check your email for instructions.',
          alreadyActive: true
        }, { status: 400 })
      }

      // Expired - update it
      const { error: updateError } = await supabase
        .from('beta_invites')
        .update({
          plan: DEFAULT_PLAN,
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Beta invite update error:', updateError)
        return NextResponse.json({ error: 'Database error: ' + updateError.message }, { status: 500 })
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('beta_invites')
        .insert({
          email: normalizedEmail,
          plan: DEFAULT_PLAN,
          expires_at: expiresAt.toISOString(),
        })

      if (insertError) {
        console.error('Beta invite insert error:', insertError)
        return NextResponse.json({ error: 'Database error: ' + insertError.message }, { status: 500 })
      }
    }

    // Send welcome email
    const planName = DEFAULT_PLAN === 'trade' ? 'Trade' : 'Pro'
    const expiryFormatted = expiresAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const emailHtml = generateWelcomeEmail(normalizedEmail, planName, DEFAULT_DAYS, expiryFormatted)
    const emailText = generateWelcomeText(normalizedEmail, planName, DEFAULT_DAYS, expiryFormatted)

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Connor from YapMate <hello@yapmate.co.uk>',
        to: [normalizedEmail],
        reply_to: 'support@yapmate.co.uk',
        subject: `Your YapMate ${planName} access is ready`,
        html: emailHtml,
        text: emailText,
      }),
    })

    if (!emailResponse.ok) {
      console.error('Resend error:', await emailResponse.text())
      // Still return success - they got beta access even if email failed
    }

    return NextResponse.json({
      success: true,
      message: 'Beta access granted! Check your email.',
      days: DEFAULT_DAYS,
      plan: planName,
    })

  } catch (error) {
    console.error('Beta invite error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function generateWelcomeEmail(email: string, planName: string, days: number, expiryFormatted: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f8fafc;">

  <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px 20px; text-align: center;">
    <img src="https://www.yapmate.co.uk/email/yapmate-logo.png" alt="YapMate" style="height: 50px; width: auto;" />
    <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">Voice-to-Invoice for Tradespeople</p>
  </div>

  <div style="max-width: 560px; margin: 0 auto; padding: 30px 20px; background: #ffffff;">

    <p style="font-size: 16px;">Hi there,</p>

    <p style="font-size: 16px;">Thanks for your interest in YapMate! I've set you up with <strong>${days} days of free ${planName} access</strong> - no card needed, no trial that auto-charges.</p>

    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px 24px; margin: 25px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 700; color: #92400e; font-size: 15px;">YOUR ACCESS DETAILS</p>
      <table style="width: 100%; font-size: 15px;">
        <tr>
          <td style="padding: 4px 0; color: #78350f;"><strong>Plan:</strong></td>
          <td style="padding: 4px 0; color: #78350f;">${planName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #78350f;"><strong>Access until:</strong></td>
          <td style="padding: 4px 0; color: #78350f;">${expiryFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #78350f;"><strong>Features:</strong></td>
          <td style="padding: 4px 0; color: #78350f;">Unlimited invoices${planName === 'Trade' ? ', VAT, CIS' : ', VAT support'}</td>
        </tr>
      </table>
    </div>

    <h2 style="color: #1e293b; font-size: 18px; margin-top: 30px; margin-bottom: 15px;">Getting Started</h2>

    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
      <p style="color: #f59e0b; font-weight: 700; margin: 0 0 5px 0; font-size: 14px;">STEP 1</p>
      <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">Download the app</p>
      <a href="https://apps.apple.com/gb/app/yapmate/id6756750891" style="display: inline-block;">
        <img src="https://www.yapmate.co.uk/email/appstore-badge.png" alt="Download on the App Store" style="height: 50px; width: auto;" />
      </a>
    </div>

    <table style="width: 100%; font-size: 15px;">
      <tr>
        <td style="vertical-align: top; padding: 8px 12px 8px 0; width: 30px;">
          <div style="background: #f59e0b; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold;">2</div>
        </td>
        <td style="padding: 8px 0;">
          <strong>Create an account</strong> using this email:<br>
          <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 14px; color: #475569;">${email}</code>
        </td>
      </tr>
      <tr>
        <td style="vertical-align: top; padding: 8px 12px 8px 0;">
          <div style="background: #f59e0b; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold;">3</div>
        </td>
        <td style="padding: 8px 0;">
          <strong>Start invoicing!</strong> Tap record, describe your job, done.
        </td>
      </tr>
    </table>

    <p style="font-size: 15px; margin-top: 25px;">Any questions or feedback? Just reply to this email - I read every message.</p>

    <p style="font-size: 15px;">
      Cheers,<br>
      <strong>Connor</strong><br>
      <span style="color: #64748b;">Founder, YapMate</span>
    </p>

  </div>

  <div style="text-align: center; padding: 25px 20px; background: #f1f5f9;">
    <p style="color: #64748b; font-size: 13px; margin: 0;">
      YapMate - Voice-powered invoicing for UK tradespeople<br>
      <a href="https://www.yapmate.co.uk" style="color: #f59e0b; text-decoration: none;">www.yapmate.co.uk</a>
    </p>
  </div>

</body>
</html>
`
}

function generateWelcomeText(email: string, planName: string, days: number, expiryFormatted: string): string {
  return `
Hi there,

Thanks for your interest in YapMate! I've set you up with ${days} days of free ${planName} access - no card needed, no trial that auto-charges.

YOUR ACCESS DETAILS:
- Plan: ${planName}
- Access until: ${expiryFormatted}
- Features: Unlimited invoices${planName === 'Trade' ? ', VAT, CIS deductions' : ', VAT support'}

GETTING STARTED:

1. Download YapMate from the App Store:
   https://apps.apple.com/gb/app/yapmate/id6756750891

2. Create an account using this email address:
   ${email}

3. Start invoicing! Tap record, describe your job, done.

Any questions or feedback? Just reply to this email - I read every message.

Cheers,
Connor
Founder, YapMate

---
YapMate - Voice-powered invoicing for UK tradespeople
https://www.yapmate.co.uk
`
}
