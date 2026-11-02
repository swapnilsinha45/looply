import { createClient } from 'npm:@supabase/supabase-js@2'

// Speech to text with automatic language detection (Groq Whisper). Auth is the student's Looply session token.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MAX_BYTES = 2 * 1024 * 1024
const PER_HOUR = 30

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const form = await req.formData()
    const token = String(form.get('token') ?? '')
    const file = form.get('file')
    if (!token || !(file instanceof File)) return json({ error: 'Missing audio or session' }, 400)
    if (file.size === 0 || file.size > MAX_BYTES) return json({ error: 'Audio is empty or too large' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: auth } = await db.from('student_auth').select('student_id').eq('token', token).maybeSingle()
    if (!auth) return json({ error: 'Session expired' }, 401)

    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await db.from('transcribe_log').select('id', { count: 'exact', head: true })
      .eq('student_id', auth.student_id).gte('created_at', since)
    if ((count ?? 0) >= PER_HOUR) return json({ error: 'Too many recordings this hour. Type your review instead.' }, 429)

    const { data: secret } = await db.from('app_secrets').select('value').eq('name', 'groq_api_key').maybeSingle()
    if (!secret) return json({ error: 'Transcription is not configured yet' }, 503)

    const out = new FormData()
    out.append('file', file, file.name || 'review.webm')
    out.append('model', 'whisper-large-v3-turbo')
    out.append('response_format', 'verbose_json')
    out.append('temperature', '0')
    // Transcribe, never translate: no `language` field (Whisper detects it) and no prompt, because an English
    // prompt can bias output toward English or romanised text. Each language is written in its own script.

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${secret.value}` }, body: out,
    })
    if (!res.ok) {
      console.error('groq error', res.status, await res.text())
      return json({ error: 'Transcription service failed. Please type your review.' }, 502)
    }
    const r = await res.json()
    await db.from('transcribe_log').insert({ student_id: auth.student_id, language: r.language ?? null })
    return json({ text: String(r.text ?? '').trim(), language: r.language ?? null })
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong' }, 500)
  }
})
