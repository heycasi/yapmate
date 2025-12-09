import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createClient } from '@supabase/supabase-js'
import type { Invoice } from '@/lib/invoice'

const SYSTEM_PROMPT = `You extract clean, structured invoice data from messy voice transcripts from UK tradespeople (plumbers, sparkies, joiners, gas engineers, builders).

The transcript may contain Scottish or Northern English slang and normalised speech from regional UK accents (Glaswegian, Edinburgh, Geordie, Scouse, Mancunian, etc.).

You must output JSON that matches this EXACT TypeScript type:

Invoice {
  customerName: string | null;
  jobSummary: string;
  labourHours: number | null;
  materials: { description: string; cost: number | null }[];
  cisJob: boolean;
  vatRegistered: boolean;
  notes: string | null;
}

GENERAL RULES
- Work ONLY from the transcript text I give you.
- If something is not clearly stated, return null instead of guessing.
- Never invent customer names, hours, prices or materials.
- If you are not 90%+ confident in a value, use null.
- Always return valid JSON, no comments, no trailing commas.

FIELD RULES

1) customerName
- Look for a named person or company the job is for.
- Phrases to use:
  - "job for Mrs Smith"
  - "for John at Oak Tree Builders"
  - "for Acme Plumbing Ltd"
- Strip leading filler like "job for", "work for", "invoice for".
- If multiple names appear, pick the one that clearly sounds like the client.
- If no clear client is mentioned, use null.
- PRESERVE the name exactly as stated (e.g., "Dahl", "Campbell", "O'Neill").

2) jobSummary
- One short sentence (max 35 words) that sums up the work done.
- Use trade-friendly wording.
- Do NOT include prices, hours, addresses or payment terms here.
- Examples:
  - "Replaced leaking radiator valve and fitted new radiator in living room."
  - "Serviced boiler and replaced faulty pump."

3) labourHours
- Use the total time actually on site.
- Accept common spoken forms AND UK slang:
  - "3 hours", "three hours", "about 2 and a half hours", "couple of hours"
  - "an hour", "an hoor" (Scottish: an hour)
  - "couple of hoors", "a couple hours" (Scottish: couple of hours)
  - "half an hour", "half an hoor"
- Conversions:
  - "half an hour" / "half an hoor" → 0.5
  - "an hour and a half" / "an hoor and a half" → 1.5
  - "two and a half hours" → 2.5
  - "couple of hours" / "couple of hoors" → 2
- If they say a vague phrase with no clear number ("there for a wee while", "most of the afternoon", "a bit of time") → null.
- Ignore travel time unless they clearly say it is billable labour.

4) materials
- Each clearly separate part or material becomes one item.
- description:
  - Short, specific phrase:
    - "600mm double radiator"
    - "boiler valve kit"
    - "copper pipe and fittings"
  - Keep the description as stated (preserve terminology).
- cost:
  - Only use a number when an explicit price is spoken for that item.
  - Handle UK slang for money:
    - "quid" = pounds (e.g., "180 quid" → 180)
    - "pound(s)" (e.g., "45 pounds" → 45)
    - "hunner" / "hundred" (e.g., "a hunner and twenty quid" → 120)
    - "ninety pounds" → 90
  - Strip currency words; store numeric GBP value only (no £ symbol).
- If they mention a material with no price:
  - Set cost: null.
- If they give one total for several items:
  - Put that total on a single line item that best matches how they described it.
- Do not invent extra materials.

5) cisJob
- CRITICAL: Use explicit phrase matching for CIS status.

- Set cisJob: true ONLY if transcript contains phrases like:
  - "This is a CIS job"
  - "CIS job"
  - "aye it's CIS"
  - "it's a CIS job"
  - "CIS is on"
  - "CIS applies"
  - "CIS is applied"
  - "take 20 percent CIS off the labour"

- Set cisJob: false if transcript explicitly says:
  - "This is not a CIS job"
  - "no CIS"
  - "naw/no CIS"
  - "no CIS on it"
  - "not a CIS job"

- If CIS is NOT mentioned at all → default cisJob: false.

6) vatRegistered
- CRITICAL: Use explicit phrase matching for VAT status.

- Set vatRegistered: true ONLY if transcript contains phrases like:
  - "I'm VAT registered"
  - "VAT registered"
  - "charge VAT on this"
  - "plus VAT"
  - "VAT to be added"
  - "VAT is charged"

- Set vatRegistered: false if transcript explicitly says:
  - "No VAT is charged"
  - "no VAT on it"
  - "naw/no VAT"
  - "nae VAT"
  - "others nae VAT"
  - "no VAT to add"
  - "VAT not applicable"
  - "not VAT registered"

- If VAT status is unclear or never mentioned → default vatRegistered: false.

7) notes
- Short free-text field for any extra useful info that does not fit above:
  - payment terms: "payment due in 14 days"
  - address: "24 Oak Street, Glasgow"
  - extra context: "tenant will pay materials separately"
- Do NOT repeat the full job summary.
- If there is nothing useful to add → null.

EXAMPLES

Example 1 (Standard UK job):
Transcript:
"Job for a Mrs Smith at 24 Oak Street. I fitted a new radiator in the living room and replaced a leaking valve. Took about three hours. Radiator was 180 quid and the valve parts were 45. This is a CIS job, I'm VAT registered, payment due in 14 days."

JSON:
{
  "customerName": "Mrs Smith",
  "jobSummary": "Fitted a new radiator and replaced a leaking valve in the living room.",
  "labourHours": 3,
  "materials": [
    { "description": "radiator", "cost": 180 },
    { "description": "valve parts", "cost": 45 }
  ],
  "cisJob": true,
  "vatRegistered": true,
  "notes": "Address: 24 Oak Street. Payment due in 14 days."
}

Example 2 (No materials specified):
Transcript:
"Went out to a leak in the kitchen. Couldn't fully fix it today, isolated the pipe and will need to go back. Didn't charge for materials, only there for about an hour."

JSON:
{
  "customerName": null,
  "jobSummary": "Isolated leaking pipe in kitchen pending full repair.",
  "labourHours": 1,
  "materials": [],
  "cisJob": false,
  "vatRegistered": false,
  "notes": null
}

Example 3 (Scottish dialect with CIS yes, VAT no):
Transcript:
"Job for Conor Dahl at 24 Ashgill Road. Fitted a new radiator and replaced a leaking valve. Three hours labour. Materials were £180. This is a CIS job. No VAT is charged."

JSON:
{
  "customerName": "Conor Dahl",
  "jobSummary": "Fitted a new radiator and replaced a leaking valve.",
  "labourHours": 3,
  "materials": [
    { "description": "radiator and parts", "cost": 180 }
  ],
  "cisJob": true,
  "vatRegistered": false,
  "notes": "Address: 24 Ashgill Road."
}

Example 4 (No VAT mentioned):
Transcript:
"Job for Mrs Smith. Boiler service. Two hours. £120. No VAT is charged."

JSON:
{
  "customerName": "Mrs Smith",
  "jobSummary": "Boiler service.",
  "labourHours": 2,
  "materials": [
    { "description": "boiler parts", "cost": 120 }
  ],
  "cisJob": false,
  "vatRegistered": false,
  "notes": null
}

Example 5 (CIS and VAT both present):
Transcript:
"Job for John Campbell. Fixed the pipe. One and a half hours. This is a CIS job. VAT is charged."

JSON:
{
  "customerName": "John Campbell",
  "jobSummary": "Fixed the pipe.",
  "labourHours": 1.5,
  "materials": [],
  "cisJob": true,
  "vatRegistered": true,
  "notes": null
}

Always respond with ONLY the JSON object and nothing else.`

export async function POST(request: NextRequest) {
  try {
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

    // Get auth token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create a client with the user's session for RLS
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    )

    const body = await request.json()
    const { transcript } = body

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string' },
        { status: 400 }
      )
    }

    // Call OpenAI to extract invoice data with lower temperature for determinism
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Extract invoice data from this transcript:\n\n${transcript}`,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0]?.message?.content

    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    const extractedInvoice: Invoice = JSON.parse(responseContent)

    // Debug log to see how CIS and VAT are being extracted
    console.log('Extracted invoice from transcript:', {
      transcript,
      extractedInvoice,
    })

    // Save invoice to database
    const { data: invoiceData, error: invoiceError } = await userSupabase
      .from('invoices')
      .insert({
        user_id: user.id,
        customer_name: extractedInvoice.customerName,
        job_summary: extractedInvoice.jobSummary,
        labour_hours: extractedInvoice.labourHours,
        labour_rate: 45.0, // Default rate
        cis_job: extractedInvoice.cisJob,
        cis_rate: 20.0,
        vat_registered: extractedInvoice.vatRegistered,
        vat_rate: 20.0,
        status: 'draft',
        notes: extractedInvoice.notes,
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('Error saving invoice:', invoiceError)
      throw new Error('Failed to save invoice')
    }

    // Save materials
    if (extractedInvoice.materials.length > 0) {
      const materialsToInsert = extractedInvoice.materials
        .filter((m) => m.cost !== null)
        .map((material) => ({
          invoice_id: invoiceData.id,
          description: material.description,
          cost: material.cost!,
          quantity: 1,
        }))

      if (materialsToInsert.length > 0) {
        const { error: materialsError } = await userSupabase
          .from('materials')
          .insert(materialsToInsert)

        if (materialsError) {
          console.error('Error saving materials:', materialsError)
        }
      }
    }

    return NextResponse.json({
      invoice: extractedInvoice,
      invoiceId: invoiceData.id,
    })
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract invoice data' },
      { status: 500 }
    )
  }
}
