import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_DAYS = 7
const DEFAULT_PLAN = 'pro'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Create admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
      console.error('Select error:', selectError)
      return new Response(
        JSON.stringify({ error: 'Database error: ' + selectError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existing) {
      // Check if still active
      if (new Date(existing.expires_at) > new Date()) {
        return new Response(
          JSON.stringify({ error: 'You already have active beta access! Check your email for instructions.', alreadyActive: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Expired - update it
      const { error: updateError } = await supabase
        .from('beta_invites')
        .update({ plan: DEFAULT_PLAN, expires_at: expiresAt.toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Database error: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('beta_invites')
        .insert({ email: normalizedEmail, plan: DEFAULT_PLAN, expires_at: expiresAt.toISOString() })

      if (insertError) {
        console.error('Insert error:', insertError)
        return new Response(
          JSON.stringify({ error: 'Database error: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Send welcome email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY) {
      const planName = DEFAULT_PLAN === 'trade' ? 'Trade' : 'Pro'
      const expiryFormatted = expiresAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      const emailHtml = generateWelcomeEmail(normalizedEmail, planName, DEFAULT_DAYS, expiryFormatted)

      try {
        await fetch('https://api.resend.com/emails', {
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
          }),
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
        // Don't fail the whole request if email fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Beta access granted! Check your email.', days: DEFAULT_DAYS, plan: DEFAULT_PLAN }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Something went wrong: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

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
