import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLEANING_SYSTEM_PROMPT = `You convert UK tradesperson speech with Scottish and Northern English dialects into clean written English.

CRITICAL RULES - YOU MUST NOT CHANGE:
- Person names (e.g., "Mrs Smith", "John Dahl", "Campbell")
- Company names (e.g., "Oak Tree Builders", "Acme Plumbing")
- Street/road names and house numbers (e.g., "24 Oak Street", "15 High Road")
- Postcodes (e.g., "G12 8QQ", "NE1 4ST")
- Money amounts (e.g., "£180", "45 quid", "a hundred and twenty pounds")
- Hour counts (e.g., "3 hours", "an hour and a half")

YOU MAY NORMALISE:
- Slang: "aye" → "yes", "naw/nae" → "no", "mibby" → "maybe", "an hoor" → "an hour", "hunner" → "hundred", "quid" → "pounds"
- Filler words: "like", "ken", "ye know", "innit", "um", "uh", "er"
- Casual grammar: "I done" → "I did", "we was" → "we were"

YOU MUST REMOVE:
- Garbage tokens that are NOT valid English words AND NOT numbers, currency, postcodes, names, or addresses
- Examples of garbage to remove: random consonant clusters, transcription artifacts, nonsense syllables
- ONLY remove if you are certain it is garbage - when in doubt, keep it

CRITICAL: CIS AND VAT PHRASE NORMALISATION

CIS phrases - normalise to clear statements:
- "aye it's CIS", "it's a CIS job", "CIS is on", "aye CIS", "CIS applies" → "This is a CIS job."
- "naw/no CIS", "no CIS on it", "not a CIS job" → "This is not a CIS job."

VAT phrases - normalise to clear statements:
- "I'm VAT registered", "plus VAT", "VAT to be added", "VAT is charged" → "VAT is charged."
- "naw/no VAT", "nae VAT", "no VAT on it", "others nae VAT", "no VAT to add", "VAT not applicable" → "No VAT is charged."

If both CIS and VAT are mentioned in one messy sentence, split them into two clear sentences.

PRESERVE ALL FACTUAL CONTENT. Output only the cleaned transcript with no preamble.`

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Get request body
    const { rawTranscript } = await req.json()

    if (!rawTranscript || typeof rawTranscript !== 'string') {
      return new Response(JSON.stringify({ error: 'No transcript provided' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Validate length (max 2000 chars to prevent abuse)
    if (rawTranscript.length > 2000) {
      return new Response(JSON.stringify({ error: 'Transcript too long' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Call OpenAI with server-side key
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: CLEANING_SYSTEM_PROMPT },
          { role: 'user', content: rawTranscript },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI error:', error)
      return new Response(
        JSON.stringify({ error: 'Cleaning failed' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    const completion = await openaiResponse.json()
    const cleanedTranscript = completion.choices[0]?.message?.content?.trim() || rawTranscript

    // Log usage
    await supabase.from('api_usage').insert({
      user_id: user.id,
      endpoint: 'clean_transcript',
      count: 1,
    })

    return new Response(JSON.stringify({ cleanedTranscript }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Clean transcript function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
