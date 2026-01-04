import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHISPER_PROMPT = `You are transcribing voice notes from UK tradespeople. Speech may include Glaswegian, Edinburgh, Geordie, Scouse, Mancunian and general Scottish/English dialects. Preserve names accurately. Pay special attention to common Scottish surnames such as: Dahl, McDonald, McDowell, Campbell, Robertson, O'Neill, Brown, Smith, Fraser. If the audio sounds like any of these names, prefer the exact spelled version rather than sounding alike alternatives such as Dow or Doll.

Examples:
- 'Conor Dahl' → Conor Dahl
- 'Job for Mrs Dahl' → Mrs Dahl

Dialect glossary:
- aye → yes
- naw / nae → no
- mibby → maybe
- an hoor / an hour → one hour
- a couple of hoors → two hours
- hunner → one hundred
- quid → GBP

Focus on accurately capturing:
- customer names
- addresses
- hours / labour time
- material descriptions and costs
- CIS / VAT statements

Return only the exact transcript text with no interpretation.`

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

    // Rate limiting: Max 10 transcriptions per hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count, error: countError } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('endpoint', 'transcribe')
      .gte('created_at', oneHourAgo)

    if (countError) {
      console.error('Rate limit check error:', countError)
    } else if (count !== null && count >= 10) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 10 recordings per hour.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Get audio from request
    const formData = await req.formData()
    const audioFile = formData.get('file')

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Validate file size (max 25MB for Whisper API)
    if (audioFile.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large. Max 25MB.' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Call OpenAI Whisper API with server-side key
    const openaiFormData = new FormData()
    openaiFormData.append('file', audioFile)
    openaiFormData.append('model', 'whisper-1')
    openaiFormData.append('language', 'en')
    openaiFormData.append('temperature', '0')
    openaiFormData.append('prompt', WHISPER_PROMPT)

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: openaiFormData,
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI error:', error)
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    const transcription = await openaiResponse.json()

    // Log usage
    await supabase.from('api_usage').insert({
      user_id: user.id,
      endpoint: 'transcribe',
      count: 1,
    })

    return new Response(JSON.stringify({ text: transcription.text }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Transcribe function error:', error)
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
