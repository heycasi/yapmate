#!/usr/bin/env npx tsx
/**
 * Send beta welcome email to a user
 *
 * Usage:
 *   npx tsx scripts/send-beta-welcome.ts <email> [plan] [days]
 *
 * Examples:
 *   npx tsx scripts/send-beta-welcome.ts user@example.com
 *   npx tsx scripts/send-beta-welcome.ts user@example.com trade 30
 *
 * Environment:
 *   RESEND_API_KEY - Resend API key
 */

import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY not found in environment')
  process.exit(1)
}

// Parse arguments
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: npx tsx scripts/send-beta-welcome.ts <email> [plan] [days]

Arguments:
  email   Recipient email address (required)
  plan    Plan granted: 'pro' or 'trade' (default: 'pro')
  days    Number of days granted (default: 30)

Examples:
  npx tsx scripts/send-beta-welcome.ts user@example.com
  npx tsx scripts/send-beta-welcome.ts user@example.com trade 30
`)
  process.exit(0)
}

const recipientEmail = args[0]
const plan = args[1] || 'pro'
const days = parseInt(args[2] || '7', 10)

// Validate
if (!recipientEmail.includes('@')) {
  console.error('Error: Invalid email address')
  process.exit(1)
}

const planName = plan === 'trade' ? 'Trade' : 'Pro'

// Calculate expiry date
const expiryDate = new Date()
expiryDate.setDate(expiryDate.getDate() + days)
const expiryFormatted = expiryDate.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Email content
const subject = `Your YapMate ${planName} access is ready`

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f8fafc;">

  <!-- Header with logo -->
  <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px 20px; text-align: center;">
    <img src="https://www.yapmate.co.uk/email/yapmate-logo.png" alt="YapMate" style="height: 50px; width: auto;" />
    <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">Voice-to-Invoice for Tradespeople</p>
  </div>

  <!-- Main content -->
  <div style="max-width: 560px; margin: 0 auto; padding: 30px 20px; background: #ffffff;">

    <p style="font-size: 16px;">Hi there,</p>

    <p style="font-size: 16px;">Thanks for your interest in YapMate! I've set you up with <strong>${days} days of free ${planName} access</strong> - no card needed, no trial that auto-charges.</p>

    <!-- Access details box -->
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
          <td style="padding: 4px 0; color: #78350f;">Unlimited invoices${plan === 'trade' ? ', VAT, CIS' : ', VAT support'}</td>
        </tr>
      </table>
    </div>

    <h2 style="color: #1e293b; font-size: 18px; margin-top: 30px; margin-bottom: 15px;">Getting Started</h2>

    <!-- Step 1: Download - most prominent -->
    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
      <p style="color: #f59e0b; font-weight: 700; margin: 0 0 5px 0; font-size: 14px;">STEP 1</p>
      <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">Download the app</p>
      <a href="https://www.yapmate.co.uk/app" style="display: inline-block;">
        <img src="https://www.yapmate.co.uk/email/appstore-badge.png" alt="Download on the App Store" style="height: 50px; width: auto;" />
      </a>
    </div>

    <!-- Steps 2 & 3 -->
    <table style="width: 100%; font-size: 15px;">
      <tr>
        <td style="vertical-align: top; padding: 8px 12px 8px 0; width: 30px;">
          <div style="background: #f59e0b; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold;">2</div>
        </td>
        <td style="padding: 8px 0;">
          <strong>Create an account</strong> using this email:<br>
          <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 14px; color: #475569;">${recipientEmail}</code>
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

  <!-- Footer -->
  <div style="text-align: center; padding: 25px 20px; background: #f1f5f9;">
    <p style="color: #64748b; font-size: 13px; margin: 0;">
      YapMate - Voice-powered invoicing for UK tradespeople<br>
      <a href="https://www.yapmate.co.uk" style="color: #f59e0b; text-decoration: none;">www.yapmate.co.uk</a>
    </p>
  </div>

</body>
</html>
`

const textContent = `
Hi there,

Thanks for your interest in YapMate! I've set you up with ${days} days of free ${planName} access - no card needed, no trial that auto-charges.

YOUR ACCESS DETAILS:
- Plan: ${planName}
- Access until: ${expiryFormatted}
- Features: Unlimited invoices${plan === 'trade' ? ', VAT, CIS deductions' : ', VAT support'}

GETTING STARTED:

1. Download YapMate from the App Store:
   https://www.yapmate.co.uk/app

2. Create an account using this email address:
   ${recipientEmail}

3. Start invoicing! Tap record, describe your job, and YapMate creates a professional invoice in seconds.

If you have any questions or feedback, just reply to this email - I read every message.

Cheers,
Connor
Founder, YapMate

---
YapMate - Voice-powered invoicing for UK tradespeople
https://www.yapmate.co.uk
`

async function sendEmail() {
  console.log(`\nSending beta welcome email:`)
  console.log(`  To: ${recipientEmail}`)
  console.log(`  Plan: ${planName}`)
  console.log(`  Days: ${days}`)
  console.log(`  Expires: ${expiryFormatted}`)
  console.log('')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Connor from YapMate <hello@yapmate.co.uk>',
      to: [recipientEmail],
      reply_to: 'support@yapmate.co.uk',
      subject,
      html: htmlContent,
      text: textContent,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('Error sending email:', result)
    process.exit(1)
  }

  console.log('✅ Email sent successfully!')
  console.log(`   Resend ID: ${result.id}`)
}

sendEmail()
