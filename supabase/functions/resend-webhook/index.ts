import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { Webhook } from 'https://esm.sh/svix@1.15.0'

/**
 * Resend Webhook Handler
 *
 * Receives Resend email events and updates the Google Sheet:
 * - All events → logged to email_events tab
 * - bounced/complained → email added to email_blocklist tab
 * - All events → matched to leads tab via resend_id, updates last_event + timestamp columns
 *
 * Security: Verified via Resend webhook signing secret (svix).
 *
 * Required env vars:
 * - RESEND_WEBHOOK_SECRET: Webhook signing secret from Resend dashboard (whsec_...)
 * - GOOGLE_SHEETS_CREDENTIALS_JSON: Service account credentials JSON
 * - GOOGLE_SHEET_ID: Google Sheet ID
 */

// Google Sheets API helpers
// ============================================================================

interface SheetsAuth {
  accessToken: string
}

async function getGoogleAccessToken(credentialsJson: string): Promise<string> {
  const creds = JSON.parse(credentialsJson)
  const now = Math.floor(Date.now() / 1000)

  // Build JWT header and claim set
  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  // Base64url encode
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  const headerB64 = enc(header)
  const claimB64 = enc(claimSet)
  const signatureInput = `${headerB64}.${claimB64}`

  // Import private key and sign
  const pemBody = creds.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${signatureInput}.${signatureB64}`

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Google OAuth failed: ${err}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

async function sheetsAppendRow(
  accessToken: string,
  sheetId: string,
  tabName: string,
  values: string[]
): Promise<void> {
  const range = encodeURIComponent(`${tabName}!A:Z`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets append to ${tabName} failed: ${err}`)
  }
}

async function sheetsGetAllValues(
  accessToken: string,
  sheetId: string,
  tabName: string
): Promise<string[][]> {
  const range = encodeURIComponent(`${tabName}!A:ZZ`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    // If tab doesn't exist, return empty
    if (res.status === 400) return []
    const err = await res.text()
    throw new Error(`Sheets read ${tabName} failed: ${err}`)
  }

  const data = await res.json()
  return data.values || []
}

async function sheetsUpdateCell(
  accessToken: string,
  sheetId: string,
  tabName: string,
  cellRange: string,
  value: string
): Promise<void> {
  const range = encodeURIComponent(`${tabName}!${cellRange}`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [[value]] }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets update ${tabName}!${cellRange} failed: ${err}`)
  }
}

async function ensureTabExists(
  accessToken: string,
  sheetId: string,
  tabName: string,
  headers: string[]
): Promise<void> {
  // Try reading the tab first
  const range = encodeURIComponent(`${tabName}!A1:A1`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.ok) return // Tab exists

  // Create the tab
  const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: tabName },
          },
        },
      ],
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    // Tab might already exist (race condition) — that's fine
    if (!err.includes('already exists')) {
      throw new Error(`Failed to create tab ${tabName}: ${err}`)
    }
  }

  // Write headers
  await sheetsAppendRow(accessToken, sheetId, tabName, headers)
}

function colLetter(col: number): string {
  let result = ''
  let c = col
  while (c > 0) {
    const remainder = (c - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    c = Math.floor((c - 1) / 26)
  }
  return result
}

// Webhook event types we care about
const HANDLED_EVENTS = new Set([
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
])

// Map event type to leads tab column name
const EVENT_TO_TIMESTAMP_COL: Record<string, string> = {
  'email.opened': 'opened_at',
  'email.clicked': 'clicked_at',
  'email.bounced': 'bounced_at',
  'email.complained': 'complained_at',
}

// ============================================================================
// Main handler
// ============================================================================

serve(async (req) => {
  try {
    // Only accept POST
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type, svix-id, svix-timestamp, svix-signature, webhook-id, webhook-timestamp, webhook-signature',
        },
      })
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Read raw body for signature verification
    const rawBody = await req.text()

    // Verify webhook signature
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''
    if (!webhookSecret) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured')
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Resend uses svix for webhook signing
    // Headers can be svix-* or webhook-*
    const svixId = req.headers.get('svix-id') || req.headers.get('webhook-id') || ''
    const svixTimestamp = req.headers.get('svix-timestamp') || req.headers.get('webhook-timestamp') || ''
    const svixSignature = req.headers.get('svix-signature') || req.headers.get('webhook-signature') || ''

    try {
      const wh = new Webhook(webhookSecret)
      wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      })
    } catch (verifyErr) {
      console.error('[resend-webhook] Signature verification failed:', verifyErr)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse event payload
    const event = JSON.parse(rawBody)
    const eventType = event.type as string

    console.log(`[resend-webhook] Received event: ${eventType}`)

    if (!HANDLED_EVENTS.has(eventType)) {
      console.log(`[resend-webhook] Ignoring unhandled event type: ${eventType}`)
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Extract data from event
    const eventData = event.data || {}
    const resendEmailId = eventData.email_id || ''
    const toEmail = Array.isArray(eventData.to) ? eventData.to[0] : (eventData.to || '')
    const timestamp = event.created_at || new Date().toISOString()

    console.log(`[resend-webhook] Email ID: ${resendEmailId}, To: ${toEmail}`)

    // Get Google Sheets credentials
    const credsJson = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS_JSON') ?? ''
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID') ?? ''

    if (!credsJson || !sheetId) {
      console.error('[resend-webhook] Missing GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEET_ID')
      return new Response(JSON.stringify({ error: 'Google Sheets not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Authenticate with Google Sheets
    const accessToken = await getGoogleAccessToken(credsJson)

    // 1. Ensure email_events tab exists and log the event
    const eventsTab = 'email_events'
    const eventsHeaders = ['timestamp', 'resend_email_id', 'event_type', 'email_address', 'metadata']

    await ensureTabExists(accessToken, sheetId, eventsTab, eventsHeaders)
    await sheetsAppendRow(accessToken, sheetId, eventsTab, [
      timestamp,
      resendEmailId,
      eventType,
      toEmail,
      JSON.stringify({
        subject: eventData.subject || '',
        click_url: eventData.click?.url || '',
        bounce_type: eventData.bounce?.type || '',
      }),
    ])
    console.log(`[resend-webhook] Logged event to ${eventsTab}`)

    // 2. For bounced/complained: add to email_blocklist
    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      if (toEmail) {
        const blocklistTab = 'email_blocklist'
        const reason = eventType === 'email.bounced' ? 'bounced' : 'complained'

        // Check if already in blocklist to avoid duplicates
        const blocklistRows = await sheetsGetAllValues(accessToken, sheetId, blocklistTab)
        const alreadyBlocked = blocklistRows.some(
          (row) => row[0] && row[0].toLowerCase() === toEmail.toLowerCase()
        )

        if (!alreadyBlocked) {
          await sheetsAppendRow(accessToken, sheetId, blocklistTab, [
            toEmail.toLowerCase(),
            reason,
            new Date().toISOString(),
          ])
          console.log(`[resend-webhook] Added ${toEmail} to blocklist (${reason})`)
        } else {
          console.log(`[resend-webhook] ${toEmail} already in blocklist`)
        }
      }
    }

    // 3. Match resend_email_id to leads tab → update last_event + timestamp column
    if (resendEmailId) {
      const leadsTab = 'leads'
      const leadsRows = await sheetsGetAllValues(accessToken, sheetId, leadsTab)

      if (leadsRows.length >= 2) {
        const headers = leadsRows[0]
        const resendIdCol = headers.indexOf('resend_id')
        const lastEventCol = headers.indexOf('last_event')

        if (resendIdCol === -1) {
          console.log('[resend-webhook] resend_id column not found in leads tab')
        } else {
          // Find matching row
          for (let i = 1; i < leadsRows.length; i++) {
            const row = leadsRows[i]
            if (row[resendIdCol] === resendEmailId) {
              const rowNum = i + 1 // 1-based

              // Update last_event column (add if it doesn't exist)
              if (lastEventCol !== -1) {
                const cellRef = `${colLetter(lastEventCol + 1)}${rowNum}`
                await sheetsUpdateCell(accessToken, sheetId, leadsTab, cellRef, eventType)
              }

              // Update event-specific timestamp column
              const timestampColName = EVENT_TO_TIMESTAMP_COL[eventType]
              if (timestampColName) {
                const tsCol = headers.indexOf(timestampColName)
                if (tsCol !== -1) {
                  const cellRef = `${colLetter(tsCol + 1)}${rowNum}`
                  await sheetsUpdateCell(accessToken, sheetId, leadsTab, cellRef, timestamp)
                }
              }

              console.log(`[resend-webhook] Updated lead in row ${rowNum} with ${eventType}`)
              break
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, event: eventType }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('[resend-webhook] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
