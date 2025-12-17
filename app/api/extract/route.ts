import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { createClient } from '@supabase/supabase-js'
import type { Invoice } from '@/lib/invoice'

const SYSTEM_PROMPT = `You extract clean, structured invoice data from voice transcripts from UK tradespeople.

The user's trade will be provided to help you understand vocabulary and context. Use it ONLY for interpretation guidance - do NOT invent job details based on trade stereotypes.

TRADE VOCABULARY HINTS:
- Plumber: radiator, valve, boiler, pipe, trap, leak, washer, ballcock, cistern, copper, flux, solder
- Electrician: socket, switch, fuse, consumer unit, spur, rewire, cable, patress, backbox, breaker, rcd
- Joiner: skirting, architrave, stud, ply, mdf, hinge, lock, door, frame, joist, batten
- Painter & Decorator: emulsion, gloss, undercoat, primer, filler, caulk, masking, roller, cutting in
- Other: Use general trade context

You must output JSON that matches this EXACT TypeScript type:

Invoice {
  customerName: string | null;
  jobSummary: string; // REQUIRED: Never null
  labourHours: number | null;
  materials: { description: string; cost: number | null }[];
  cisJob: boolean | null; // true/false if mentioned, null if unknown
  vatRegistered: boolean | null; // true/false if mentioned, null if unknown
  notes: string | null;
}

CORE RULE (NON-NEGOTIABLE):
If you are unsure about a value, return null. NEVER guess.

FIELD RULES

1) customerName
- Extract EXACTLY as spoken in the transcript. Do NOT correct spelling.
- Look for phrases like: "job for Mrs Smith", "for John Campbell", "invoice for Acme Ltd"
- Strip leading filler ("job for", "work for", "invoice for").
- CRITICAL: Preserve names exactly - if transcript says "Dahl", use "Dahl" (not "Dow" or "Doll")
- If no customer name mentioned → null
- If confidence is low (e.g., unclear audio, multiple names) → null

2) jobSummary
- One short sentence (max 35 words) that sums up the work done.
- Use trade-friendly wording.
- Do NOT include prices, hours, addresses or payment terms here.
- Examples:
  - "Replaced leaking radiator valve and fitted new radiator in living room."
  - "Serviced boiler and replaced faulty pump."

3) labourHours
- Extract ONLY if explicitly stated with a clear number.
- Supported UK phrasing:
  - "an hour" / "an hoor" → 1
  - "hour and a half" / "hoor and a half" → 1.5
  - "couple of hours" / "couple of hoors" → 2
  - "half an hour" / "half an hoor" → 0.5
  - "two and a half hours" → 2.5
  - "three hours" → 3
- VAGUE phrases return null:
  - "wee while" → null
  - "most of the afternoon" → null
  - "quick job" → null
  - "bit of time" → null
- If no time mentioned → null

4) materials
- Each clearly separate part or material becomes one item.
- description:
  - Short, specific phrase:
    - "600mm double radiator"
    - "boiler valve kit"
    - "copper pipe and fittings"
  - Keep the description as stated (preserve terminology).
- cost:
  - ONLY extract if explicitly stated. NO guessing.
  - Supported UK money slang:
    - "quid" → pounds (e.g., "180 quid" → 180)
    - "hunner" → 100 (e.g., "a hunner and eighty quid" → 180)
    - "one fifty" → 150
    - "a hundred and twenty" → 120
  - Return numeric value only (no £ symbol).
  - If material mentioned with no price → cost: null
  - If no materials mentioned → []

5) cisJob (CRITICAL: Never guess)
- Return true ONLY if transcript contains explicit CIS confirmation:
  - "This is a CIS job"
  - "aye it's CIS"
  - "CIS applies"
  - "CIS job"
  - "CIS is on"
- Return false ONLY if transcript explicitly says NO to CIS:
  - "This is not a CIS job"
  - "no CIS"
  - "naw CIS"
  - "not a CIS job"
- Return null if CIS is NOT mentioned at all

6) vatRegistered (CRITICAL: Never guess)
- Return true ONLY if transcript contains explicit VAT confirmation:
  - "VAT is charged"
  - "I'm VAT registered"
  - "plus VAT"
  - "VAT to be added"
- Return false ONLY if transcript explicitly says NO to VAT:
  - "No VAT is charged"
  - "no VAT"
  - "naw VAT"
  - "nae VAT"
  - "not VAT registered"
- Return null if VAT is NOT mentioned at all

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

Example 3 (SUCCESS CRITERIA - Glaswegian plumber):
User trade: Plumber
Transcript:
"Job for Mrs Dahl at 24 Ashgill Road. Fitted a radiator, took a couple of hoors. Materials were a hunner and eighty quid. Aye it's CIS, naw VAT."

JSON:
{
  "customerName": "Mrs Dahl",
  "jobSummary": "Fitted a radiator.",
  "labourHours": 2,
  "materials": [
    { "description": "radiator materials", "cost": 180 }
  ],
  "cisJob": true,
  "vatRegistered": false,
  "notes": "Address: 24 Ashgill Road."
}

Example 4 (CIS/VAT not mentioned → null):
User trade: Electrician
Transcript:
"Fixed a socket for John. Took an hour."

JSON:
{
  "customerName": "John",
  "jobSummary": "Fixed a socket.",
  "labourHours": 1,
  "materials": [],
  "cisJob": null,
  "vatRegistered": null,
  "notes": null
}

Example 5 (Vague time phrase → null):
User trade: Joiner
Transcript:
"Fitted some skirting boards for wee while. Materials were one fifty."

JSON:
{
  "customerName": null,
  "jobSummary": "Fitted skirting boards.",
  "labourHours": null,
  "materials": [
    { "description": "skirting boards", "cost": 150 }
  ],
  "cisJob": null,
  "vatRegistered": null,
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
    const { transcript, trade } = body

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string' },
        { status: 400 }
      )
    }

    // Trade is optional but recommended for better context
    const tradeContext = trade ? `\n\nUser's trade: ${trade}` : ''

    // Call OpenAI to extract invoice data with temperature=0 for determinism
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Extract invoice data from this transcript:${tradeContext}\n\nTranscript:\n${transcript}`,
        },
      ],
      temperature: 0, // Maximum determinism - no creativity, no guessing
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
    // CIS/VAT values saved exactly as extracted (true/false/null)
    const { data: invoiceData, error: invoiceError } = await userSupabase
      .from('invoices')
      .insert({
        user_id: user.id,
        customer_name: extractedInvoice.customerName,
        job_summary: extractedInvoice.jobSummary,
        labour_hours: extractedInvoice.labourHours,
        labour_rate: 45.0, // Default rate
        cis_job: extractedInvoice.cisJob, // Saved as-is: true/false/null
        cis_rate: 20.0,
        vat_registered: extractedInvoice.vatRegistered, // Saved as-is: true/false/null
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
